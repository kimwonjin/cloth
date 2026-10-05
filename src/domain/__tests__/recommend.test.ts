import {
  buildWearHistory,
  copyOutfitWithMyClothes,
  draftItems,
  findShortages,
  recommendOutfits,
  scoreOutfit,
  swapSlot,
  EMPTY_HISTORY,
} from '../recommend';
import { cloth, seeded } from './fixtures';

const autumn = new Date(2026, 9, 5);
const summer = new Date(2026, 6, 5);

function closet() {
  return [
    cloth('top', 'white', { id: 't1' }),
    cloth('top', 'navy', { id: 't2' }),
    cloth('top', 'red', { id: 't3' }),
    cloth('bottom', 'denim', { id: 'b1' }),
    cloth('bottom', 'black', { id: 'b2' }),
    cloth('bottom', 'beige', { id: 'b3' }),
    cloth('shoes', 'white', { id: 's1' }),
    cloth('shoes', 'black', { id: 's2' }),
    cloth('outer', 'khaki', { id: 'o1', seasons: ['autumn', 'winter'] }),
  ];
}

describe('findShortages', () => {
  it('blocks when there is no top or bottom', () => {
    const s = findShortages([cloth('top', 'white')]);
    expect(s.find((x) => x.category === 'bottom')).toMatchObject({ blocking: true, message: '하의 1벌 더 등록하기' });
  });

  it('suggests (non-blocking) more items for variety', () => {
    const s = findShortages([cloth('top', 'white'), cloth('bottom', 'denim')]);
    expect(s.every((x) => !x.blocking)).toBe(true);
    expect(s.map((x) => x.message)).toContain('상의 2벌 더 등록하면 코디가 다양해져요');
    expect(s.map((x) => x.category)).toContain('shoes');
  });

  it('has nothing to say about a full closet', () => {
    expect(findShortages(closet())).toEqual([]);
  });
});

describe('recommendOutfits', () => {
  it('returns nothing but shortages for an empty closet', () => {
    const r = recommendOutfits([], { date: autumn });
    expect(r.outfits).toHaveLength(0);
    expect(r.shortages.filter((s) => s.blocking)).toHaveLength(2);
  });

  it('returns three outfits with top, bottom and shoes from my closet', () => {
    const items = closet();
    const r = recommendOutfits(items, { date: autumn, random: seeded(3) });
    expect(r.outfits).toHaveLength(3);
    const ids = new Set(items.map((c) => c.id));
    for (const o of r.outfits) {
      expect(o.draft.top?.category).toBe('top');
      expect(o.draft.bottom?.category).toBe('bottom');
      expect(o.draft.shoes?.category).toBe('shoes');
      draftItems(o.draft).forEach((c) => expect(ids.has(c.id)).toBe(true));
    }
  });

  it('uses distinct tops and bottoms across suggestions when possible', () => {
    const r = recommendOutfits(closet(), { date: autumn, random: seeded(7) });
    expect(new Set(r.outfits.map((o) => o.draft.top!.id)).size).toBe(3);
    expect(new Set(r.outfits.map((o) => o.draft.bottom!.id)).size).toBe(3);
  });

  it('adds an outer in autumn but not in summer', () => {
    const fall = recommendOutfits(closet(), { date: autumn, random: seeded(1) });
    expect(fall.outfits.every((o) => o.draft.outer?.id === 'o1')).toBe(true);
    const hot = recommendOutfits(closet(), { date: summer, random: seeded(1) });
    expect(hot.outfits.every((o) => !o.draft.outer)).toBe(true);
  });

  it('prefers in-season clothes', () => {
    const items = [
      cloth('top', 'white', { id: 'warm', seasons: ['winter'] }),
      cloth('top', 'white', { id: 'cool', seasons: ['summer'] }),
      cloth('bottom', 'denim', { id: 'b' }),
    ];
    const r = recommendOutfits(items, { date: summer, count: 1, random: seeded(2) });
    expect(r.outfits[0].draft.top!.id).toBe('cool');
  });

  it('still works without shoes', () => {
    const r = recommendOutfits([cloth('top', 'white'), cloth('bottom', 'denim')], { date: autumn });
    expect(r.outfits).toHaveLength(1);
    expect(r.outfits[0].draft.shoes).toBeUndefined();
  });

  it('handles large closets by sampling', () => {
    const big = [
      ...Array.from({ length: 40 }, (_, i) => cloth('top', 'white', { id: `t${i}` })),
      ...Array.from({ length: 40 }, (_, i) => cloth('bottom', 'black', { id: `b${i}` })),
      ...Array.from({ length: 10 }, (_, i) => cloth('shoes', 'white', { id: `s${i}` })),
    ];
    const r = recommendOutfits(big, { date: autumn, random: seeded(5) });
    expect(r.outfits).toHaveLength(3);
  });
});

describe('wear history', () => {
  it('penalizes a top+bottom pair worn recently and favors long-unworn clothes', () => {
    const items = closet();
    const byId = Object.fromEntries(items.map((c) => [c.id, c]));
    const history = buildWearHistory(
      [{ date: new Date(2026, 9, 3), clothingIds: ['t1', 'b1', 's1'] }],
      items,
      autumn
    );
    const worn = scoreOutfit({ top: byId.t1, bottom: byId.b1, shoes: byId.s1 }, autumn, history).score;
    const fresh = scoreOutfit({ top: byId.t1, bottom: byId.b1, shoes: byId.s1 }, autumn, EMPTY_HISTORY).score;
    expect(worn).toBeLessThan(fresh - 1.5);

    const old = buildWearHistory([{ date: new Date(2026, 5, 1), clothingIds: ['t2'] }], items, autumn);
    const r = scoreOutfit({ top: byId.t2, bottom: byId.b2 }, autumn, old);
    expect(r.reasons).toContain('한동안 안 입은 옷을 섞었어요');
  });

  it('rarely recommends the pair worn two days ago', () => {
    const items = closet();
    const history = buildWearHistory(
      [{ date: new Date(2026, 9, 3), clothingIds: ['t1', 'b1'] }],
      items,
      autumn
    );
    let hits = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = recommendOutfits(items, { date: autumn, history, count: 1, random: seeded(seed) });
      if (r.outfits[0].draft.top!.id === 't1' && r.outfits[0].draft.bottom!.id === 'b1') hits++;
    }
    expect(hits).toBe(0);
  });
});

describe('swapSlot', () => {
  it('replaces only the requested slot with a different item of that category', () => {
    const items = closet();
    const byId = Object.fromEntries(items.map((c) => [c.id, c]));
    const draft = { top: byId.t1, bottom: byId.b1, shoes: byId.s1 };
    const next = swapSlot(items, draft, 'bottom', { date: autumn, random: seeded(4) })!;
    expect(next.bottom!.id).not.toBe('b1');
    expect(next.bottom!.category).toBe('bottom');
    expect(next.top!.id).toBe('t1');
    expect(next.shoes!.id).toBe('s1');
  });

  it('cycles through alternatives with skipIds and returns null when exhausted', () => {
    const items = closet();
    const byId = Object.fromEntries(items.map((c) => [c.id, c]));
    const draft = { top: byId.t1, bottom: byId.b1 };
    expect(swapSlot(items, draft, 'bottom', { skipIds: ['b2', 'b3'] })).toBeNull();
    expect(swapSlot(items, draft, 'bottom', { skipIds: ['b2'] })!.bottom!.id).toBe('b3');
  });
});

describe('copyOutfitWithMyClothes', () => {
  it('picks my items of the same category with the closest color', () => {
    const items = closet();
    const { draft, missing } = copyOutfitWithMyClothes(
      items,
      [
        { slot: 'top', color: 'red' },
        { slot: 'bottom', color: 'black' },
        { slot: 'accessory', color: 'yellow' },
      ],
      autumn
    );
    expect(draft.top!.id).toBe('t3');
    expect(draft.bottom!.id).toBe('b2');
    expect(missing).toEqual(['accessory']);
  });

  it('falls back to a similar hue when the exact color is missing', () => {
    const items = [cloth('top', 'pink', { id: 'pink' }), cloth('top', 'blue', { id: 'blue' })];
    const { draft } = copyOutfitWithMyClothes(items, [{ slot: 'top', color: 'red' }], autumn);
    expect(draft.top!.id).toBe('pink');
  });
});
