import { neverWorn, unwornFor, wearStats } from '../stats';
import { cloth } from './fixtures';

describe('wear stats', () => {
  const a = cloth('top', 'white', { id: 'a', created_at: '2026-01-01T00:00:00Z' });
  const b = cloth('bottom', 'denim', { id: 'b', created_at: '2026-01-01T00:00:00Z' });
  const c = cloth('shoes', 'black', { id: 'c', created_at: '2026-09-30T00:00:00Z' });
  const entries = [
    { worn_on: '2026-10-01', clothingIds: ['a', 'b'] },
    { worn_on: '2026-10-03', clothingIds: ['a', 'a'] }, // duplicates count once
    { worn_on: '2026-05-01', clothingIds: ['b'] },
  ];

  it('counts wears per item, most worn first', () => {
    const s = wearStats([a, b, c], entries);
    expect(s.map((x) => [x.clothing.id, x.count])).toEqual([
      ['a', 2],
      ['b', 2],
      ['c', 0],
    ]);
    expect(s.find((x) => x.clothing.id === 'b')!.lastWorn).toEqual(new Date(2026, 9, 1));
  });

  it('flags clothes unworn for 3 months, but not newly added ones', () => {
    const s = wearStats([a, b, c], [{ worn_on: '2026-05-01', clothingIds: ['b'] }]);
    const today = new Date(2026, 9, 5);
    expect(unwornFor(s, today).map((x) => x.clothing.id).sort()).toEqual(['a', 'b']);
    expect(neverWorn(s).map((x) => x.clothing.id).sort()).toEqual(['a', 'c']);
  });
});
