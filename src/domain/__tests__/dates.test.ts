import { daysBetween, monthGrid, seasonOf, toDateKey } from '../dates';

describe('dates', () => {
  it('formats local date keys', () => {
    expect(toDateKey(new Date(2026, 9, 5))).toBe('2026-10-05');
  });

  it('counts calendar days', () => {
    expect(daysBetween(new Date(2026, 9, 1, 23), new Date(2026, 9, 2, 1))).toBe(1);
    expect(daysBetween(new Date(2026, 0, 1), new Date(2026, 3, 1))).toBe(90);
  });

  it('maps months to Korean seasons', () => {
    expect(seasonOf(new Date(2026, 9, 5))).toBe('autumn');
    expect(seasonOf(new Date(2026, 0, 5))).toBe('winter');
    expect(seasonOf(new Date(2026, 11, 5))).toBe('winter');
    expect(seasonOf(new Date(2026, 6, 5))).toBe('summer');
    expect(seasonOf(new Date(2026, 3, 5))).toBe('spring');
  });

  it('builds a Sunday-first month grid', () => {
    const weeks = monthGrid(2026, 9); // October 2026 starts on Thursday
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(weeks[0][4]?.getDate()).toBe(1);
    const days = weeks.flat().filter(Boolean);
    expect(days).toHaveLength(31);
    weeks.forEach((w) => expect(w).toHaveLength(7));
  });
});
