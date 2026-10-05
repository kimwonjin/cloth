// Generates synthetic "clothes on the floor" photos for E2E tests (no external assets).
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('./photos/', import.meta.url);
mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function png(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

/** Renders polygons (garment) on a slightly noisy floor with a soft vertical shadow. */
function photo(name, polys, color, { size = 600, floor = [214, 206, 196] } = {}) {
  const buf = Buffer.alloc(size * size * 3);
  const inside = (x, y, poly) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      const px = x / size;
      const py = y / size;
      const garment = polys.some((p) => inside(px, py, p));
      if (garment) {
        // Fabric texture: stripes + noise, so the photo reads as sharp.
        const t = ((x + y) % 6 < 2 ? 18 : 0) + Math.round(rand() * 14);
        buf[i] = Math.min(255, color[0] + t);
        buf[i + 1] = Math.min(255, color[1] + t);
        buf[i + 2] = Math.min(255, color[2] + t);
      } else {
        const shade = Math.round(py * 14) + Math.round(rand() * 4);
        buf[i] = floor[0] - shade;
        buf[i + 1] = floor[1] - shade;
        buf[i + 2] = floor[2] - shade;
      }
    }
  }
  writeFileSync(new URL(`${name}.png`, OUT), png(size, size, buf));
}

const tshirt = [
  [
    [0.32, 0.2], [0.42, 0.16], [0.58, 0.16], [0.68, 0.2], [0.85, 0.34], [0.77, 0.43],
    [0.68, 0.37], [0.68, 0.8], [0.32, 0.8], [0.32, 0.37], [0.23, 0.43], [0.15, 0.34],
  ],
];
const jacket = [
  [
    [0.3, 0.15], [0.42, 0.12], [0.58, 0.12], [0.7, 0.15], [0.86, 0.75], [0.76, 0.78],
    [0.68, 0.4], [0.68, 0.85], [0.32, 0.85], [0.32, 0.4], [0.24, 0.78], [0.14, 0.75],
  ],
];
const pants = [
  [[0.33, 0.06], [0.67, 0.06], [0.69, 0.94], [0.53, 0.94], [0.5, 0.35], [0.47, 0.94], [0.31, 0.94]],
];
const shoes = [
  [[0.12, 0.42], [0.3, 0.4], [0.46, 0.5], [0.47, 0.6], [0.12, 0.6]],
  [[0.53, 0.42], [0.71, 0.4], [0.88, 0.5], [0.89, 0.6], [0.53, 0.6]],
];

photo('top-white', tshirt, [236, 236, 233], { floor: [150, 120, 92] });
photo('top-navy', tshirt, [30, 44, 88]);
photo('top-red', tshirt, [190, 36, 46]);
photo('bottom-denim', pants, [78, 112, 160]);
photo('bottom-black', pants, [24, 24, 26]);
photo('shoes-white', shoes, [240, 240, 238], { floor: [120, 120, 124] });
photo('outer-khaki', jacket, [104, 100, 56]);
photo('bottom-beige', pants, [200, 182, 148], { floor: [90, 90, 96] });

// A "mirror selfie" with no clean background.
const selfie = Buffer.alloc(480 * 600 * 3);
for (let i = 0; i < selfie.length; i += 3) {
  const p = i / 3;
  selfie[i] = (p * 7) % 256;
  selfie[i + 1] = ((p / 480) * 3) % 256;
  selfie[i + 2] = 140;
}
writeFileSync(new URL('selfie.png', OUT), png(480, 600, selfie));
console.log('photos written to', OUT.pathname);
