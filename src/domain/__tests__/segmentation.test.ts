import { autoLevels, analyzeWithAlpha } from '../image-analysis';
import {
  fillHoles,
  morphClose,
  morphOpen,
  normalizeOutput,
  palette,
  refineAlpha,
  removeSmallBlobs,
  resizeMask,
  toModelInput,
} from '../segmentation';

function rgba(w: number, h: number, fill: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  return { data, width: w, height: h };
}

describe('model input/output', () => {
  it('normalizes pixels into planar NCHW with ImageNet mean/std', () => {
    const px = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 255]);
    const t = toModelInput(px, 2);
    expect(t).toHaveLength(12);
    expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229); // R of pixel 0
    expect(t[4 + 1]).toBeCloseTo((1 - 0.456) / 0.224); // G plane, pixel 1
    expect(t[8 + 3]).toBeCloseTo((0 - 0.406) / 0.225); // B plane, pixel 3
  });

  it('min-max normalizes raw output', () => {
    expect(Array.from(normalizeOutput(new Float32Array([-2, 0, 2])))).toEqual([0, 0.5, 1]);
  });

  it('resizes masks bilinearly', () => {
    const up = resizeMask(new Float32Array([0, 1, 0, 1]), 2, 2, 4, 2);
    expect(up[0]).toBe(0);
    expect(up[3]).toBe(1);
    expect(up[1]).toBeGreaterThan(0);
    expect(up[1]).toBeLessThan(1);
    const same = resizeMask(new Float32Array([0.2, 0.4, 0.6, 0.8]), 2, 2, 2, 2);
    expect(Array.from(same)).toEqual(Array.from(new Float32Array([0.2, 0.4, 0.6, 0.8])));
  });
});

describe('palette', () => {
  it('finds the dominant color clusters', () => {
    const colors: [number, number, number][] = [
      ...Array.from({ length: 50 }, () => [200, 150, 100] as [number, number, number]),
      ...Array.from({ length: 50 }, () => [20, 30, 40] as [number, number, number]),
    ];
    const p = palette(colors, 2);
    const sorted = p.map((c) => c.map(Math.round)).sort((a, b) => a[0] - b[0]);
    expect(sorted).toEqual([
      [20, 30, 40],
      [200, 150, 100],
    ]);
  });
});

describe('refineAlpha', () => {
  // 60×60 wood floor; a navy garment in the middle; the model also (wrongly)
  // keeps a floor strip on the left of the garment.
  const W = 60;
  const wood: [number, number, number] = [160, 110, 70];
  const navy: [number, number, number] = [30, 40, 90];
  const garment = (x: number, y: number) => x >= 20 && x < 40 && y >= 10 && y < 50;
  const img = () => rgba(W, W, (x, y) => (garment(x, y) ? navy : wood));
  const prob = new Float32Array(W * W);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      if (garment(x, y)) prob[y * W + x] = 0.95;
      else if (x >= 12 && x < 20 && y >= 10 && y < 50) prob[y * W + x] = 0.8; // floor strip kept by the model
      else prob[y * W + x] = 0.02;
    }

  it('removes background-colored regions the model kept, and keeps the garment', () => {
    const a = refineAlpha(img(), prob);
    expect(a[30 * W + 30]).toBe(255); // garment center
    expect(a[30 * W + 15]).toBe(0); // floor strip
    expect(a[5 * W + 5]).toBe(0); // background
  });

  it('feathers the garment edge', () => {
    const a = refineAlpha(img(), prob);
    const edge = a[30 * W + 20];
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
  });

  it('does not remove garment pixels that match the background but are not connected to it', () => {
    // Garment with a wood-colored logo in the middle.
    const withLogo = rgba(W, W, (x, y) =>
      garment(x, y) ? (x >= 28 && x < 32 && y >= 28 && y < 32 ? wood : navy) : wood
    );
    const a = refineAlpha(withLogo, prob);
    expect(a[30 * W + 30]).toBe(255);
  });
});

describe('hole filling', () => {
  it('fills enclosed holes but not gaps open to the border', () => {
    const w = 20;
    const alpha = new Float32Array(w * w);
    for (let y = 2; y < 18; y++) for (let x = 2; x < 18; x++) alpha[y * w + x] = 1;
    alpha[10 * w + 10] = 0; // enclosed hole
    for (let y = 10; y < 18; y++) alpha[y * w + 6] = 0; // slit open to the bottom edge
    fillHoles(alpha, w, w);
    expect(alpha[10 * w + 10]).toBe(1);
    expect(alpha[15 * w + 6]).toBe(0);
  });

  it('keeps the striped-shirt case intact: closing seals edge notches, then holes fill', () => {
    const w = 30;
    const alpha = new Float32Array(w * w);
    for (let y = 5; y < 25; y++) for (let x = 5; x < 25; x++) alpha[y * w + x] = 1;
    for (let x = 5; x < 15; x++) alpha[12 * w + x] = 0; // stripe the model missed, open at the left edge
    morphClose(alpha, w, w, 1);
    fillHoles(alpha, w, w);
    expect(alpha[12 * w + 5]).toBe(1);
    expect(alpha[12 * w + 10]).toBe(1);
    expect(alpha[2 * w + 2]).toBe(0);
  });
});

describe('morphology', () => {
  it('opening removes thin lines but keeps solid shapes', () => {
    const w = 30;
    const alpha = new Float32Array(w * w);
    for (let y = 5; y < 20; y++) for (let x = 5; x < 20; x++) alpha[y * w + x] = 1; // block
    for (let y = 0; y < w; y++) alpha[y * w + 25] = 1; // 1px vertical line
    morphOpen(alpha, w, w, 1);
    expect(alpha[12 * w + 12]).toBe(1);
    expect(alpha[12 * w + 25]).toBe(0);
  });

  it('removes tiny blobs relative to the largest region', () => {
    const w = 40;
    const alpha = new Float32Array(w * w);
    for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) alpha[y * w + x] = 1; // 900 px
    alpha[35 * w + 35] = 1; // speck
    for (let y = 32; y < 40; y++) for (let x = 0; x < 8; x++) alpha[y * w + x] = 1; // second shoe-sized blob: 64 px
    removeSmallBlobs(alpha, w, w);
    expect(alpha[35 * w + 35]).toBe(0);
    expect(alpha[35 * w + 3]).toBe(1);
  });
});

describe('analyzeWithAlpha + autoLevels', () => {
  it('applies the matte and reports the garment box and color', () => {
    const img = rgba(40, 40, (x, y) => (x >= 10 && x < 30 && y >= 5 && y < 35 ? [200, 40, 50] : [240, 240, 240]));
    const alpha = new Uint8ClampedArray(40 * 40);
    for (let y = 5; y < 35; y++) for (let x = 10; x < 30; x++) alpha[y * 40 + x] = 255;
    const a = analyzeWithAlpha(img, alpha);
    expect(a.backgroundRemoved).toBe(true);
    expect(a.bbox).toEqual({ x: 10, y: 5, width: 20, height: 30 });
    expect(a.colorKey).toBe('red');
    expect(img.data[3]).toBe(0);
  });

  it('treats an empty matte as a failed cut-out and leaves pixels alone', () => {
    const img = rgba(20, 20, () => [10, 20, 30]);
    const a = analyzeWithAlpha(img, new Uint8ClampedArray(400));
    expect(a.backgroundRemoved).toBe(false);
    expect(img.data[3]).toBe(255);
  });

  it('stretches a dim garment toward full range', () => {
    const img = rgba(10, 10, (x) => [60 + x * 8, 60 + x * 8, 60 + x * 8]);
    autoLevels(img, 1);
    expect(img.data[0]).toBeLessThan(10);
    expect(img.data[(9 * 4) as number]).toBeGreaterThan(245);
  });

  it('leaves a flat single-color garment alone', () => {
    const img = rgba(10, 10, () => [120, 30, 30]);
    autoLevels(img, 1);
    expect(Array.from(img.data.slice(0, 3))).toEqual([120, 30, 30]);
  });
});
