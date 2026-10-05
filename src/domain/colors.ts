export interface ColorDef {
  key: string;
  label: string;
  hex: string;
  /** Neutrals go with almost anything. */
  neutral: boolean;
  /** Hue in degrees for chromatic colors; null for neutrals. */
  hue: number | null;
}

export const COLORS: ColorDef[] = [
  { key: 'black', label: '블랙', hex: '#1d1d1f', neutral: true, hue: null },
  { key: 'white', label: '화이트', hex: '#f7f7f5', neutral: true, hue: null },
  { key: 'gray', label: '그레이', hex: '#9a9a9e', neutral: true, hue: null },
  { key: 'beige', label: '베이지', hex: '#d9c6a5', neutral: true, hue: null },
  { key: 'navy', label: '네이비', hex: '#22305a', neutral: true, hue: null },
  { key: 'denim', label: '데님', hex: '#5a7ca6', neutral: true, hue: null },
  { key: 'brown', label: '브라운', hex: '#7a5234', neutral: false, hue: 25 },
  { key: 'khaki', label: '카키', hex: '#6f6b3e', neutral: false, hue: 55 },
  { key: 'red', label: '레드', hex: '#c8323b', neutral: false, hue: 355 },
  { key: 'pink', label: '핑크', hex: '#ec9ab5', neutral: false, hue: 335 },
  { key: 'orange', label: '오렌지', hex: '#e8803a', neutral: false, hue: 25 },
  { key: 'yellow', label: '옐로우', hex: '#efd04b', neutral: false, hue: 50 },
  { key: 'green', label: '그린', hex: '#3f8f5a', neutral: false, hue: 140 },
  { key: 'mint', label: '민트', hex: '#9fd8c4', neutral: false, hue: 160 },
  { key: 'skyblue', label: '스카이블루', hex: '#8cc3ea', neutral: false, hue: 205 },
  { key: 'blue', label: '블루', hex: '#2f63c7', neutral: false, hue: 220 },
  { key: 'purple', label: '퍼플', hex: '#7d5ab5', neutral: false, hue: 270 },
  { key: 'etc', label: '기타', hex: '#c9c9c9', neutral: true, hue: null },
];

const BY_KEY = new Map(COLORS.map((c) => [c.key, c]));

export function getColor(key: string): ColorDef {
  return BY_KEY.get(key) ?? BY_KEY.get('etc')!;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Picks the palette color closest to an RGB value (weighted Euclidean distance). */
export function nearestColorKey(rgb: [number, number, number]): string {
  let best = 'etc';
  let bestDist = Infinity;
  for (const c of COLORS) {
    if (c.key === 'etc') continue;
    const [r, g, b] = hexToRgb(c.hex);
    const rMean = (rgb[0] + r) / 2;
    const dr = rgb[0] - r;
    const dg = rgb[1] - g;
    const db = rgb[2] - b;
    const dist = (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = c.key;
    }
  }
  return best;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Scores how well two colors go together, from -1 (clash) to 1 (great).
 * Neutrals pair with everything; analogous and complementary hues are good,
 * hues ~60–120° apart tend to clash.
 */
export function colorPairScore(aKey: string, bKey: string): number {
  const a = getColor(aKey);
  const b = getColor(bKey);
  if (a.neutral && b.neutral) return a.key === b.key && a.key !== 'black' ? 0.3 : 0.8;
  if (a.neutral || b.neutral) return 0.9;
  if (a.key === b.key) return 0.4; // tone-on-tone works but is less interesting
  const d = hueDistance(a.hue!, b.hue!);
  if (d <= 40) return 0.6; // analogous
  if (d >= 150) return 0.5; // complementary
  if (d >= 60 && d <= 120) return -1;
  return 0;
}

/** Average pairwise harmony of a set of colors (1 for a single color). */
export function paletteScore(keys: string[]): number {
  if (keys.length < 2) return 1;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      total += colorPairScore(keys[i], keys[j]);
      pairs++;
    }
  }
  const chromatic = new Set(keys.filter((k) => !getColor(k).neutral)).size;
  // More than two loud colors in one outfit is rarely a good idea.
  const loudPenalty = chromatic > 2 ? 0.5 * (chromatic - 2) : 0;
  return total / pairs - loudPenalty;
}
