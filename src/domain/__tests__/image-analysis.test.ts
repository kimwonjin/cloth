import { analyzeAndClean, laplacianVariance, qualityWarnings, squareCropAround, type Rgba } from '../image-analysis';

/** Draws a filled rectangle "garment" with a little texture on a plain background. */
function photo(
  w: number,
  h: number,
  bg: [number, number, number],
  rect: { x: number; y: number; width: number; height: number },
  color: [number, number, number],
  { texture = true, gradient = false } = {}
): Rgba {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
      let c = inside ? color : bg;
      if (!inside && gradient) {
        const shade = Math.round((y / h) * 20);
        c = [bg[0] - shade, bg[1] - shade, bg[2] - shade];
      }
      const noise = inside && texture && (x + y) % 4 === 0 ? 25 : 0;
      data[i] = c[0] + noise;
      data[i + 1] = c[1] + noise;
      data[i + 2] = c[2] + noise;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

describe('analyzeAndClean', () => {
  it('whitens a plain floor around a garment and finds its box and color', () => {
    const img = photo(200, 200, [150, 120, 90], { x: 50, y: 40, width: 100, height: 120 }, [35, 50, 95]);
    const a = analyzeAndClean(img);
    expect(a.backgroundRemoved).toBe(true);
    expect(a.bbox).toEqual({ x: 50, y: 40, width: 100, height: 120 });
    expect(a.colorKey).toBe('navy');
    expect(a.touchesEdge).toBe(false);
    const inside = (100 * 200 + 101) * 4;
    // background pixel is now transparent, garment pixel untouched
    expect(img.data[3]).toBe(0);
    expect(img.data[inside + 3]).toBe(255);
    expect(img.data[inside + 2]).toBe(95);
  });

  it('handles a soft gradient (shadow) on the floor', () => {
    const img = photo(160, 160, [220, 220, 220], { x: 40, y: 40, width: 80, height: 80 }, [200, 40, 50], {
      gradient: true,
    });
    const a = analyzeAndClean(img);
    expect(a.backgroundRemoved).toBe(true);
    expect(a.colorKey).toBe('red');
  });

  it('guesses bottoms for tall shapes and shoes for flat, wide shapes', () => {
    const pants = analyzeAndClean(photo(200, 200, [230, 230, 230], { x: 70, y: 10, width: 60, height: 170 }, [90, 120, 160]));
    expect(pants.categoryGuess).toBe('bottom');
    const shoes = analyzeAndClean(photo(200, 200, [230, 230, 230], { x: 40, y: 80, width: 120, height: 50 }, [20, 20, 20]));
    expect(shoes.categoryGuess).toBe('shoes');
  });

  it('flags garments cut off at the edge', () => {
    const a = analyzeAndClean(photo(200, 200, [230, 230, 230], { x: 0, y: 30, width: 150, height: 140 }, [20, 20, 20]));
    expect(a.touchesEdge).toBe(true);
    expect(qualityWarnings(a, 1000, 1000).join()).toContain('잘린');
  });

  it('keeps the photo as is when no clean background is found', () => {
    const data = new Uint8ClampedArray(100 * 100 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 7) % 256;
      data[i + 1] = (i * 13) % 256;
      data[i + 2] = (i * 29) % 256;
      data[i + 3] = 255;
    }
    const before = data.slice();
    const a = analyzeAndClean({ data, width: 100, height: 100 });
    expect(a.backgroundRemoved).toBe(false);
    expect(data).toEqual(before);
    expect(qualityWarnings(a, 1000, 1000).join()).toContain('배경');
  });
});

describe('quality checks', () => {
  it('scores a textured image sharper than a flat one', () => {
    const sharp = photo(100, 100, [200, 200, 200], { x: 20, y: 20, width: 60, height: 60 }, [30, 30, 30]);
    const flat = photo(100, 100, [200, 200, 200], { x: 20, y: 20, width: 60, height: 60 }, [30, 30, 30], {
      texture: false,
    });
    expect(laplacianVariance(sharp)).toBeGreaterThan(laplacianVariance(flat));
  });

  it('warns about low resolution', () => {
    const a = analyzeAndClean(photo(100, 100, [230, 230, 230], { x: 20, y: 20, width: 60, height: 60 }, [30, 30, 30]));
    expect(qualityWarnings(a, 200, 200).join()).toContain('해상도');
  });

  it('makes a padded square crop centered on the garment', () => {
    const box = squareCropAround({ x: 50, y: 40, width: 100, height: 120 }, 200, 200, 0.1);
    expect(box.width).toBe(box.height);
    expect(box.width).toBe(144);
    expect(box.x + box.width / 2).toBeCloseTo(100, 0);
    expect(box.y + box.height / 2).toBeCloseTo(100, 0);
  });
});
