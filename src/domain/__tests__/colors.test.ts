import { colorPairScore, getColor, nearestColorKey, paletteScore } from '../colors';

describe('colors', () => {
  it('maps RGB to the nearest palette color', () => {
    expect(nearestColorKey([0, 0, 0])).toBe('black');
    expect(nearestColorKey([255, 255, 255])).toBe('white');
    expect(nearestColorKey([200, 40, 50])).toBe('red');
    expect(nearestColorKey([35, 50, 95])).toBe('navy');
    expect(nearestColorKey([215, 198, 165])).toBe('beige');
  });

  it('falls back to etc for unknown keys', () => {
    expect(getColor('nope').key).toBe('etc');
  });

  it('treats neutrals as safe, analogous/complementary as good, ~90° apart as a clash', () => {
    expect(colorPairScore('black', 'red')).toBeGreaterThan(0.5);
    expect(colorPairScore('white', 'navy')).toBeGreaterThan(0.5);
    expect(colorPairScore('pink', 'red')).toBe(0.6); // analogous (20°)
    expect(colorPairScore('yellow', 'blue')).toBe(0.5); // complementary (170°)
    expect(colorPairScore('orange', 'green')).toBe(-1); // 115° apart
    expect(colorPairScore('green', 'purple')).toBe(0); // in between
  });

  it('penalizes outfits with many loud colors', () => {
    expect(paletteScore(['black', 'white', 'denim'])).toBeGreaterThan(paletteScore(['red', 'yellow', 'purple']));
  });
});
