import { daysBetween, parseDateKey } from './dates';
import type { Clothing } from './types';

export interface ClothingWearStat {
  clothing: Clothing;
  count: number;
  lastWorn: Date | null;
}

/** Per-item wear counts from wear logs (each entry lists the clothing ids worn that day). */
export function wearStats(
  clothes: Clothing[],
  entries: { worn_on: string; clothingIds: string[] }[]
): ClothingWearStat[] {
  const map = new Map<string, ClothingWearStat>(
    clothes.map((c) => [c.id, { clothing: c, count: 0, lastWorn: null }])
  );
  for (const e of entries) {
    const date = parseDateKey(e.worn_on);
    for (const id of new Set(e.clothingIds)) {
      const s = map.get(id);
      if (!s) continue;
      s.count++;
      if (!s.lastWorn || s.lastWorn < date) s.lastWorn = date;
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/**
 * Clothes not worn for `days` days. Items never worn only count once they've
 * been in the closet that long, so newly added clothes aren't flagged.
 */
export function unwornFor(stats: ClothingWearStat[], today: Date, days = 90): ClothingWearStat[] {
  return stats.filter((s) => {
    const since = s.lastWorn ?? new Date(s.clothing.created_at);
    return daysBetween(since, today) >= days;
  });
}

export function neverWorn(stats: ClothingWearStat[]): ClothingWearStat[] {
  return stats.filter((s) => s.count === 0);
}
