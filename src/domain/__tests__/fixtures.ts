import type { Category, Clothing, Season } from '../types';

let n = 0;
export function cloth(
  category: Category,
  color: string,
  extra: Partial<Clothing> & { seasons?: Season[] } = {}
): Clothing {
  n++;
  return {
    id: extra.id ?? `${category}-${color}-${n}`,
    user_id: 'u1',
    image_path: `u1/${n}.jpg`,
    category,
    color,
    seasons: extra.seasons ?? ['spring', 'summer', 'autumn', 'winter'],
    brand: null,
    size: null,
    created_at: extra.created_at ?? '2026-01-01T00:00:00Z',
  };
}

/** Deterministic PRNG so tests are stable. */
export function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}
