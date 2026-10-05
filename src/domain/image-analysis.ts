import { nearestColorKey } from './colors';
import type { Category } from './types';

/**
 * Pure pixel-level helpers for turning a clothing photo into a clean card.
 * They operate on RGBA buffers so they run anywhere (canvas on web, tests in Node).
 *
 * The garment matte normally comes from the U²-Netp model (see
 * `segmentation.ts`); `findBackground` is a flood-fill fallback used when the
 * model can't load. It works for clothes on a plain floor or wall.
 */

export interface Rgba {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Analysis {
  /** Whether background pixels were whitened. */
  backgroundRemoved: boolean;
  /** Bounding box of the garment (whole image if removal failed). */
  bbox: Box;
  /** Fraction of pixels that belong to the garment. */
  foregroundRatio: number;
  /** The garment touches the image edge — probably cut off. */
  touchesEdge: boolean;
  /** Variance of the Laplacian; low values mean a blurry photo. */
  sharpness: number;
  colorKey: string;
  categoryGuess: Category;
}

export const BLUR_THRESHOLD = 60;

function dist2(d: Uint8ClampedArray, i: number, r: number, g: number, b: number) {
  const dr = d[i] - r;
  const dg = d[i + 1] - g;
  const db = d[i + 2] - b;
  return dr * dr + dg * dg + db * db;
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Marks background pixels (connected to the border and close to the border color). */
export function findBackground(img: Rgba, tolerance = 42): Uint8Array {
  const { data, width: w, height: h } = img;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const pushBorder = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  };
  for (let x = 0; x < w; x++) {
    pushBorder(x, 0);
    pushBorder(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushBorder(0, y);
    pushBorder(w - 1, y);
  }
  const br = median(rs);
  const bg = median(gs);
  const bb = median(bs);
  const tol2 = tolerance * tolerance;
  const step2 = 24 * 24;

  const mask = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const p = y * w + x;
    if (!mask[p] && dist2(data, p * 4, br, bg, bb) <= tol2) {
      mask[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    const i = p * 4;
    const visit = (q: number) => {
      if (mask[q]) return;
      const j = q * 4;
      // Grow through pixels close to the background color, or close to the
      // current pixel (handles soft shadows / gradients on the floor).
      const near = dist2(data, j, br, bg, bb) <= tol2;
      const smooth =
        dist2(data, j, data[i], data[i + 1], data[i + 2]) <= step2 &&
        dist2(data, j, br, bg, bb) <= tol2 * 2.5;
      if (near || smooth) {
        mask[q] = 1;
        stack.push(q);
      }
    };
    if (x > 0) visit(p - 1);
    if (x < w - 1) visit(p + 1);
    if (y > 0) visit(p - w);
    if (y < h - 1) visit(p + w);
  }
  return mask;
}

export function laplacianVariance(img: Rgba): number {
  const { data, width: w, height: h } = img;
  const gray = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const lap = gray[p - 1] + gray[p + 1] + gray[p - w] + gray[p + w] - 4 * gray[p];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function guessCategory(bbox: Box, foregroundRatio: number, imageArea: number): Category {
  const aspect = bbox.height / Math.max(bbox.width, 1);
  const boxRatio = (bbox.width * bbox.height) / imageArea;
  if (aspect >= 1.5) return 'bottom';
  if (aspect <= 0.75 && boxRatio < 0.5) return 'shoes';
  if (foregroundRatio < 0.06) return 'accessory';
  return 'top';
}

/**
 * Flood-fill fallback (no AI model): makes a plain background transparent in
 * place and analyzes the garment.
 */
export function analyzeAndClean(img: Rgba): Analysis {
  const mask = findBackground(img);
  const alpha = new Uint8ClampedArray(mask.length);
  for (let i = 0; i < mask.length; i++) alpha[i] = mask[i] ? 0 : 255;
  return analyzeWithAlpha(img, alpha);
}

/**
 * Applies a garment alpha matte (0 = background, 255 = garment) to the image
 * in place and returns what the registration screen needs: bbox for
 * cropping, dominant color, a category guess and photo-quality signals.
 * If the matte covers almost nothing or almost everything it is treated as a
 * failed cut-out and the photo is left untouched.
 */
export function analyzeWithAlpha(img: Rgba, alpha: Uint8ClampedArray): Analysis {
  const { data, width: w, height: h } = img;
  const sharpness = laplacianVariance(img);
  const isFg = (p: number) => alpha[p] >= 128;

  let fg = 0;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isFg(y * w + x)) continue;
      fg++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const ratio = fg / (w * h);
  const backgroundRemoved = ratio > 0.02 && ratio < 0.95;

  const bbox: Box = backgroundRemoved
    ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : { x: 0, y: 0, width: w, height: h };

  let touchesEdge = false;
  if (backgroundRemoved) {
    const margin = 2;
    let edgeFg = 0;
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < margin; y++) {
        if (isFg(y * w + x)) edgeFg++;
        if (isFg((h - 1 - y) * w + x)) edgeFg++;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < margin; x++) {
        if (isFg(y * w + x)) edgeFg++;
        if (isFg(y * w + (w - 1 - x))) edgeFg++;
      }
    }
    touchesEdge = edgeFg / (2 * margin * (w + h)) > 0.05;
  }

  // Dominant color over garment pixels (sampled for speed).
  const counts = new Map<string, number>();
  const total = backgroundRemoved ? fg : w * h;
  const stride = Math.max(1, Math.floor(total / 6000));
  let seen = 0;
  for (let p = 0; p < w * h; p++) {
    if (backgroundRemoved && !isFg(p)) continue;
    if (seen++ % stride !== 0) continue;
    const i = p * 4;
    const key = nearestColorKey([data[i], data[i + 1], data[i + 2]]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let colorKey = 'etc';
  let best = 0;
  for (const [k, v] of counts) {
    if (v > best) {
      best = v;
      colorKey = k;
    }
  }

  if (backgroundRemoved) {
    for (let p = 0; p < w * h; p++) data[p * 4 + 3] = alpha[p];
  }

  return {
    backgroundRemoved,
    bbox,
    foregroundRatio: ratio,
    touchesEdge,
    sharpness,
    colorKey,
    categoryGuess: guessCategory(bbox, ratio, w * h),
  };
}

/**
 * Gentle "product photo" tone correction: stretches the garment's brightness
 * range (dim phone photos look washed out) without touching hue. `strength`
 * blends between the original (0) and a full stretch (1).
 */
export function autoLevels(img: Rgba, strength = 0.6) {
  const { data } = img;
  const n = data.length / 4;
  const hist = new Uint32Array(256);
  let count = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (data[i + 3] < 128) continue;
    const l = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[l]++;
    count++;
  }
  if (count === 0) return;
  const pct = (q: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= count * q) return v;
    }
    return 255;
  };
  const lo = pct(0.01);
  const hi = pct(0.99);
  // Already well exposed, or nearly flat (single-color item): leave it.
  if (hi - lo > 220 || hi - lo < 20) return;
  const scale = 255 / (hi - lo);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    for (let c = 0; c < 3; c++) {
      const v = data[i + c];
      const stretched = (v - lo) * scale;
      data[i + c] = Math.round(v + (stretched - v) * strength);
    }
  }
}

/** Square crop around the garment with padding, clamped to the image. */
export function squareCropAround(bbox: Box, imgW: number, imgH: number, padding = 0.08): Box {
  const side = Math.max(bbox.width, bbox.height) * (1 + padding * 2);
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  return {
    x: Math.round(cx - side / 2),
    y: Math.round(cy - side / 2),
    width: Math.round(side),
    height: Math.round(side),
  };
}

export function qualityWarnings(a: Analysis, width: number, height: number): string[] {
  const w: string[] = [];
  if (Math.min(width, height) < 300) w.push('사진 해상도가 낮아요. 조금 더 가까이에서 찍어주세요.');
  if (a.sharpness < BLUR_THRESHOLD) w.push('사진이 흐려요. 흔들리지 않게 다시 찍어주세요.');
  if (a.touchesEdge) w.push('옷이 사진 밖으로 잘린 것 같아요. 옷 전체가 나오게 찍어주세요.');
  if (!a.backgroundRemoved)
    w.push('배경을 지우지 못했어요. 단색 바닥이나 벽 앞에서 찍으면 더 깔끔해요.');
  return w;
}
