import type { Rgba } from './image-analysis';

/**
 * Helpers around the U²-Netp salient-object model used for background
 * removal. Everything here is pure so it runs in the browser, in Node and in
 * tests; the actual model inference lives in `src/lib/segment.web.ts`.
 */

export const U2NET_SIZE = 320;
export const MASK_THRESHOLD = 0.5;
/** Background contact needed to drop a region, relative to sqrt(region area). */
const CONTACT_RATIO = 1.5;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/** RGBA pixels (already resized to size×size) → normalized NCHW float tensor data. */
export function toModelInput(rgba: Uint8ClampedArray, size = U2NET_SIZE): Float32Array {
  const n = size * size;
  let max = 1;
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    max = Math.max(max, rgba[j], rgba[j + 1], rgba[j + 2]);
  }
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    for (let c = 0; c < 3; c++) out[c * n + i] = (rgba[j + c] / max - MEAN[c]) / STD[c];
  }
  return out;
}

/** Min-max normalizes the raw model output to 0..1. */
export function normalizeOutput(raw: Float32Array): Float32Array {
  let mn = Infinity;
  let mx = -Infinity;
  for (const v of raw) {
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const range = mx - mn || 1;
  return raw.map((v) => (v - mn) / range);
}

/** Bilinear resize of a single-channel float mask. */
export function resizeMask(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  const out = new Float32Array(dw * dh);
  const sx = sw / dw;
  const sy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(sh - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const tx = fx - x0;
      const top = src[y0 * sw + x0] * (1 - tx) + src[y0 * sw + x1] * tx;
      const bottom = src[y1 * sw + x0] * (1 - tx) + src[y1 * sw + x1] * tx;
      out[y * dw + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

type Rgb = [number, number, number];

function dist2(a: Rgb, r: number, g: number, b: number) {
  const dr = a[0] - r;
  const dg = a[1] - g;
  const db = a[2] - b;
  return dr * dr + dg * dg + db * db;
}

/** Tiny deterministic k-means over sampled pixel colors. */
export function palette(colors: Rgb[], k = 5, iterations = 8): Rgb[] {
  if (colors.length === 0) return [];
  const centers: Rgb[] = [];
  for (let i = 0; i < k; i++) centers.push([...colors[Math.floor((i * colors.length) / k)]] as Rgb);
  for (let it = 0; it < iterations; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const c of colors) {
      let best = 0;
      let bestD = Infinity;
      for (let j = 0; j < centers.length; j++) {
        const d = dist2(centers[j], c[0], c[1], c[2]);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      const s = sums[best];
      s[0] += c[0];
      s[1] += c[1];
      s[2] += c[2];
      s[3]++;
    }
    for (let j = 0; j < centers.length; j++) {
      const s = sums[j];
      if (s[3] > 0) centers[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    }
  }
  return centers;
}

function nearest(pal: Rgb[], r: number, g: number, b: number) {
  let best = Infinity;
  for (const p of pal) best = Math.min(best, dist2(p, r, g, b));
  return Math.sqrt(best);
}

function sample(img: Rgba, prob: Float32Array, pick: (p: number) => boolean, max = 3000): Rgb[] {
  const { data, width: w, height: h } = img;
  const n = w * h;
  const idx: number[] = [];
  for (let i = 0; i < n; i++) if (pick(prob[i])) idx.push(i);
  const stride = Math.max(1, Math.floor(idx.length / max));
  const out: Rgb[] = [];
  for (let k = 0; k < idx.length; k += stride) {
    const j = idx[k] * 4;
    out.push([data[j], data[j + 1], data[j + 2]]);
  }
  return out;
}

/**
 * Turns the model's soft probability map into a clean alpha matte:
 * 1. threshold probabilities (soft masks leave the floor half-visible) and
 *    fill enclosed holes (the model is unsure on e.g. cream stripes);
 * 2. learn background vs garment colors from confident pixels and remove
 *    regions that look like background and run along it (e.g. floor strips
 *    next to trousers that the model kept) — but not stripes inside a shirt;
 * 3. remove thin structures and tiny disconnected blobs (hanger wire, specks);
 * 4. feather the edge by one pixel.
 */
export function refineAlpha(img: Rgba, prob: Float32Array): Uint8ClampedArray {
  const { data, width: w, height: h } = img;
  const n = w * h;
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) alpha[i] = prob[i] >= MASK_THRESHOLD ? 1 : 0;
  // Closing seals narrow notches at the garment edge so fillHoles can fill them.
  morphClose(alpha, w, h, Math.max(1, Math.round(Math.max(w, h) / 160)));
  fillHoles(alpha, w, h);

  const bgPal = palette(sample(img, prob, (p) => p < 0.1));
  const fgPal = palette(sample(img, prob, (p) => p > 0.9));

  if (bgPal.length > 0 && fgPal.length > 0) {
    // Candidates: kept by the model, but colored like the background.
    const candidate = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (prob[i] < 0.1) continue;
      const j = i * 4;
      const dBg = nearest(bgPal, data[j], data[j + 1], data[j + 2]);
      const dFg = nearest(fgPal, data[j], data[j + 1], data[j + 2]);
      if (dBg < 28 && dBg < dFg * 0.5) candidate[i] = 1;
    }
    // Remove a candidate region only if it hugs the background along a long
    // edge (a floor strip beside trousers). Stripes/patterns inside the
    // garment touch the background only at their narrow ends, so they stay.
    const region = new Int32Array(n).fill(-1);
    const stack: number[] = [];
    const members: number[] = [];
    for (let i = 0; i < n; i++) {
      if (!candidate[i] || region[i] !== -1) continue;
      members.length = 0;
      region[i] = i;
      stack.push(i);
      let contact = 0;
      while (stack.length) {
        const p = stack.pop()!;
        members.push(p);
        const x = p % w;
        let touchesBg = false;
        const visit = (q: number) => {
          if (prob[q] < 0.1) touchesBg = true;
          if (!candidate[q] || region[q] !== -1) return;
          region[q] = i;
          stack.push(q);
        };
        if (x > 0) visit(p - 1);
        if (x < w - 1) visit(p + 1);
        if (p >= w) visit(p - w);
        if (p < n - w) visit(p + w);
        if (touchesBg) contact++;
      }
      if (contact > 0 && contact >= CONTACT_RATIO * Math.sqrt(members.length)) {
        for (const p of members) alpha[p] = 0;
      }
    }
  }

  // Opening removes thin structures such as hanger wire or floor cracks.
  const radius = Math.max(1, Math.round(Math.max(w, h) / 320));
  morphOpen(alpha, w, h, radius);
  removeSmallBlobs(alpha, w, h);

  // 3×3 box feather on the edge only.
  const out = new Uint8ClampedArray(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = alpha[i];
      if (a === 0 || a === 1) {
        let edge = false;
        for (let dy = -1; dy <= 1 && !edge; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            if (alpha[yy * w + xx] !== a) {
              edge = true;
              break;
            }
          }
        if (!edge) {
          out[i] = a * 255;
          continue;
        }
      }
      let sum = 0;
      let cnt = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          sum += alpha[yy * w + xx];
          cnt++;
        }
      out[i] = Math.round((sum / cnt) * 255);
    }
  }
  return out;
}

/** Zeroes connected regions smaller than 2% of the largest one (in place). */
export function removeSmallBlobs(alpha: Float32Array, w: number, h: number) {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (alpha[i] < 0.5 || label[i] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    label[i] = id;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const visit = (q: number) => {
        if (label[q] !== -1 || alpha[q] < 0.5) return;
        label[q] = id;
        stack.push(q);
      };
      if (x > 0) visit(p - 1);
      if (x < w - 1) visit(p + 1);
      if (p >= w) visit(p - w);
      if (p < n - w) visit(p + w);
    }
    sizes.push(size);
  }
  if (sizes.length < 2) return;
  const largest = Math.max(...sizes);
  for (let i = 0; i < n; i++) {
    const l = label[i];
    if (l >= 0 && sizes[l] < largest * 0.02) alpha[i] = 0;
  }
}

/** Square erosion followed by dilation of a binary (0/1) mask, in place. */
export function morphOpen(alpha: Float32Array, w: number, h: number, r: number) {
  const pass = (src: Float32Array, keep: (v: number, cur: number) => number) => {
    // Separable min/max filter: horizontal then vertical.
    const tmp = new Float32Array(src.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let v = src[y * w + x];
        for (let d = -r; d <= r; d++) {
          const xx = Math.min(w - 1, Math.max(0, x + d));
          v = keep(v, src[y * w + xx]);
        }
        tmp[y * w + x] = v;
      }
    const out = new Float32Array(src.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let v = tmp[y * w + x];
        for (let d = -r; d <= r; d++) {
          const yy = Math.min(h - 1, Math.max(0, y + d));
          v = keep(v, tmp[yy * w + x]);
        }
        out[y * w + x] = v;
      }
    return out;
  };
  const eroded = pass(alpha, Math.min);
  const opened = pass(eroded, Math.max);
  alpha.set(opened);
}

/** Dilation followed by erosion (fills gaps narrower than 2r), in place. */
export function morphClose(alpha: Float32Array, w: number, h: number, r: number) {
  for (let i = 0; i < alpha.length; i++) alpha[i] = 1 - alpha[i];
  morphOpen(alpha, w, h, r);
  for (let i = 0; i < alpha.length; i++) alpha[i] = 1 - alpha[i];
}

/**
 * Fills background pixels that can't reach the image border without crossing
 * the garment — holes the model left inside the clothing. In place.
 */
export function fillHoles(alpha: Float32Array, w: number, h: number) {
  const n = w * h;
  const outside = new Uint8Array(n);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (alpha[i] < 0.5 && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < n - w) seed(p + w);
  }
  for (let i = 0; i < n; i++) if (alpha[i] < 0.5 && !outside[i]) alpha[i] = 1;
}
