import { getColor, paletteScore } from './colors';
import { daysBetween, seasonOf } from './dates';
import type { Category, Clothing, OutfitDraft, Season } from './types';
import { CATEGORY_LABELS } from './types';

/**
 * Rule-based outfit recommender. It only uses the user's own clothes and
 * scores combinations by color harmony, season fit and wear history. It is
 * deliberately isolated behind `recommendOutfits` so it can later be replaced
 * (or re-ranked) by an external AI API without touching the screens.
 */

export const SLOT_ORDER: Category[] = ['outer', 'top', 'bottom', 'shoes', 'accessory'];

export interface WearHistory {
  /** Most recent date each clothing id was worn. */
  lastWorn: Map<string, Date>;
  /** top+bottom pairs worn recently, as `${topId}|${bottomId}`. */
  recentPairs: Set<string>;
}

export interface WornEntry {
  date: Date;
  clothingIds: string[];
}

export function buildWearHistory(
  entries: WornEntry[],
  clothes: Clothing[],
  today: Date,
  recentPairDays = 14
): WearHistory {
  const byId = new Map(clothes.map((c) => [c.id, c]));
  const lastWorn = new Map<string, Date>();
  const recentPairs = new Set<string>();
  for (const e of entries) {
    for (const id of e.clothingIds) {
      const prev = lastWorn.get(id);
      if (!prev || prev < e.date) lastWorn.set(id, e.date);
    }
    if (daysBetween(e.date, today) <= recentPairDays) {
      const items = e.clothingIds.map((id) => byId.get(id)).filter(Boolean) as Clothing[];
      const top = items.find((c) => c.category === 'top');
      const bottom = items.find((c) => c.category === 'bottom');
      if (top && bottom) recentPairs.add(`${top.id}|${bottom.id}`);
    }
  }
  return { lastWorn, recentPairs };
}

export const EMPTY_HISTORY: WearHistory = { lastWorn: new Map(), recentPairs: new Set() };

export interface Shortage {
  category: Category;
  count: number;
  /** Blocking shortages prevent any recommendation. */
  blocking: boolean;
  message: string;
}

/** Tells the user which categories to register more of. */
export function findShortages(clothes: Clothing[]): Shortage[] {
  const count = (cat: Category) => clothes.filter((c) => c.category === cat).length;
  const result: Shortage[] = [];
  for (const cat of ['top', 'bottom'] as const) {
    const n = count(cat);
    if (n === 0) {
      result.push({ category: cat, count: 1, blocking: true, message: `${CATEGORY_LABELS[cat]} 1벌 더 등록하기` });
    } else if (n < 3) {
      result.push({
        category: cat,
        count: 3 - n,
        blocking: false,
        message: `${CATEGORY_LABELS[cat]} ${3 - n}벌 더 등록하면 코디가 다양해져요`,
      });
    }
  }
  if (count('shoes') === 0) {
    result.push({ category: 'shoes', count: 1, blocking: false, message: '신발 1켤레 등록하면 코디가 완성돼요' });
  }
  return result;
}

export interface ScoredOutfit {
  draft: OutfitDraft;
  score: number;
  reasons: string[];
}

export interface RecommendOptions {
  date?: Date;
  history?: WearHistory;
  count?: number;
  random?: () => number;
}

function inSeason(c: Clothing, season: Season) {
  return c.seasons.length === 0 || c.seasons.includes(season);
}

/** Prefer in-season items; fall back to everything if a slot would be empty. */
function candidates(clothes: Clothing[], cat: Category, season: Season): Clothing[] {
  const all = clothes.filter((c) => c.category === cat);
  const seasonal = all.filter((c) => inSeason(c, season));
  return seasonal.length > 0 ? seasonal : all;
}

export function draftItems(draft: OutfitDraft): Clothing[] {
  return SLOT_ORDER.map((s) => draft[s]).filter(Boolean) as Clothing[];
}

export function scoreOutfit(
  draft: OutfitDraft,
  date: Date,
  history: WearHistory
): { score: number; reasons: string[] } {
  const items = draftItems(draft);
  const season = seasonOf(date);
  const reasons: string[] = [];

  const harmony = paletteScore(items.map((c) => c.color));
  let score = harmony * 2;
  if (harmony >= 0.8) reasons.push('색 조합이 잘 어울려요');

  let seasonal = 0;
  for (const c of items) seasonal += inSeason(c, season) ? 0.3 : -1;
  score += seasonal;

  let fresh = 0;
  let longUnworn = 0;
  for (const c of items) {
    const last = history.lastWorn.get(c.id);
    if (!last) {
      fresh += 0.4;
      continue;
    }
    const days = daysBetween(last, date);
    if (days >= 30) {
      fresh += 0.4;
      longUnworn++;
    } else if (days >= 7) fresh += 0.2;
    else if (days < 3) fresh -= 0.4;
  }
  score += fresh;
  if (longUnworn > 0) reasons.push('한동안 안 입은 옷을 섞었어요');

  if (draft.top && draft.bottom && history.recentPairs.has(`${draft.top.id}|${draft.bottom.id}`)) {
    score -= 1.5;
  }
  return { score, reasons };
}

function wantOuter(season: Season, random: () => number) {
  if (season === 'summer') return false;
  if (season === 'spring') return random() < 0.5;
  return true;
}

function pick<T>(arr: T[], random: () => number): T {
  return arr[Math.floor(random() * arr.length)];
}

const MAX_COMBOS = 4000;

/** Builds up to `count` distinct outfit suggestions from the user's clothes. */
export function recommendOutfits(
  clothes: Clothing[],
  { date = new Date(), history = EMPTY_HISTORY, count = 3, random = Math.random }: RecommendOptions = {}
): { outfits: ScoredOutfit[]; shortages: Shortage[] } {
  const shortages = findShortages(clothes);
  if (shortages.some((s) => s.blocking)) return { outfits: [], shortages };

  const season = seasonOf(date);
  const tops = candidates(clothes, 'top', season);
  const bottoms = candidates(clothes, 'bottom', season);
  const shoes = candidates(clothes, 'shoes', season);
  const outers = candidates(clothes, 'outer', season);
  const accessories = candidates(clothes, 'accessory', season);

  const total = tops.length * bottoms.length * Math.max(shoes.length, 1);
  const scored: ScoredOutfit[] = [];
  const consider = (top: Clothing, bottom: Clothing, shoe?: Clothing) => {
    const draft: OutfitDraft = { top, bottom, shoes: shoe };
    if (outers.length > 0 && wantOuter(season, random)) draft.outer = pick(outers, random);
    if (accessories.length > 0 && random() < 0.3) draft.accessory = pick(accessories, random);
    const { score, reasons } = scoreOutfit(draft, date, history);
    // Jitter keeps "새로고침" from always returning the same three outfits.
    scored.push({ draft, score: score + random() * 0.8, reasons });
  };

  if (total <= MAX_COMBOS) {
    for (const t of tops)
      for (const b of bottoms) {
        if (shoes.length === 0) consider(t, b);
        else for (const s of shoes) consider(t, b, s);
      }
  } else {
    for (let i = 0; i < MAX_COMBOS; i++) {
      consider(pick(tops, random), pick(bottoms, random), shoes.length ? pick(shoes, random) : undefined);
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // Prefer suggestions that don't share a top or bottom; relax if we run out.
  const chosen: ScoredOutfit[] = [];
  const usedTops = new Set<string>();
  const usedBottoms = new Set<string>();
  for (const s of scored) {
    if (chosen.length >= count) break;
    if (usedTops.has(s.draft.top!.id) || usedBottoms.has(s.draft.bottom!.id)) continue;
    chosen.push(s);
    usedTops.add(s.draft.top!.id);
    usedBottoms.add(s.draft.bottom!.id);
  }
  const key = (d: OutfitDraft) => `${d.top!.id}|${d.bottom!.id}|${d.shoes?.id ?? ''}`;
  const chosenKeys = new Set(chosen.map((c) => key(c.draft)));
  for (const s of scored) {
    if (chosen.length >= count) break;
    if (chosenKeys.has(key(s.draft))) continue;
    chosen.push(s);
    chosenKeys.add(key(s.draft));
  }
  return { outfits: chosen, shortages };
}

/**
 * Replaces the item in one slot with the best-scoring alternative not in
 * `skipIds`. Returns null when there is no other item for that slot.
 */
export function swapSlot(
  clothes: Clothing[],
  draft: OutfitDraft,
  slot: Category,
  { date = new Date(), history = EMPTY_HISTORY, random = Math.random, skipIds = [] as string[] } = {}
): OutfitDraft | null {
  const current = draft[slot]?.id;
  const options = clothes.filter(
    (c) => c.category === slot && c.id !== current && !skipIds.includes(c.id)
  );
  if (options.length === 0) return null;
  let best: OutfitDraft | null = null;
  let bestScore = -Infinity;
  for (const o of options) {
    const next = { ...draft, [slot]: o };
    const s = scoreOutfit(next, date, history).score + random() * 0.5;
    if (s > bestScore) {
      bestScore = s;
      best = next;
    }
  }
  return best;
}

/** How visually similar two palette colors are (0–1); used for "내 옷으로 따라 입기". */
export function colorSimilarity(aKey: string, bKey: string): number {
  if (aKey === bKey) return 1;
  const a = getColor(aKey);
  const b = getColor(bKey);
  if (a.neutral && b.neutral) return 0.5;
  if (a.neutral || b.neutral) return 0.1;
  const d = Math.abs(a.hue! - b.hue!) % 360;
  return 1 - Math.min(d, 360 - d) / 180;
}

/**
 * Recreates a target outfit using the user's own clothes: for each slot, pick
 * the item of the same category with the closest color.
 */
export function copyOutfitWithMyClothes(
  myClothes: Clothing[],
  target: { slot: Category; color: string }[],
  date = new Date()
): { draft: OutfitDraft; missing: Category[] } {
  const season = seasonOf(date);
  const draft: OutfitDraft = {};
  const missing: Category[] = [];
  for (const t of target) {
    const options = myClothes.filter((c) => c.category === t.slot);
    if (options.length === 0) {
      missing.push(t.slot);
      continue;
    }
    let best = options[0];
    let bestScore = -Infinity;
    for (const o of options) {
      const s = colorSimilarity(o.color, t.color) + (inSeason(o, season) ? 0.1 : 0);
      if (s > bestScore) {
        bestScore = s;
        best = o;
      }
    }
    draft[t.slot] = best;
  }
  return { draft, missing };
}
