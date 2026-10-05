import {
  analyzeAndClean,
  analyzeWithAlpha,
  autoLevels,
  qualityWarnings,
  squareCropAround,
  type Analysis,
} from '@/domain/image-analysis';
import { refineAlpha, resizeMask, U2NET_SIZE } from '@/domain/segmentation';

import type { ProcessedClothingPhoto, UploadableImage } from './image-types';
import { segmentGarment } from './segment.web';

const CARD_SIZE = 720;

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했어요.'));
    img.src = uri;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.88): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))), 'image/jpeg', quality)
  );
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))), 'image/png')
  );
}

function toUploadable(blob: Blob): UploadableImage {
  const contentType = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return { previewUri: URL.createObjectURL(blob), blob, contentType };
}

/**
 * Web: cuts the garment out (U²-Netp model in the browser, flood fill as a
 * fallback), tidies it into a product-style card (centered, tone-corrected,
 * soft shadow, transparent PNG) and detects its dominant color — all free and
 * on-device.
 */
export async function processClothingPhoto(uri: string): Promise<ProcessedClothingPhoto> {
  const img = await loadImage(uri);
  const scale = Math.min(1, CARD_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const original = ctx.getImageData(0, 0, w, h);

  let analysis: Analysis | null = null;
  let cutout: ProcessedClothingPhoto['cutout'] = 'none';
  let pixels = original;
  const prob = await segmentGarment(img);
  if (prob) {
    pixels = new ImageData(new Uint8ClampedArray(original.data), w, h);
    const rgba = { data: pixels.data, width: w, height: h };
    const alpha = refineAlpha(rgba, resizeMask(prob, U2NET_SIZE, U2NET_SIZE, w, h));
    analysis = analyzeWithAlpha(rgba, alpha);
    if (analysis.backgroundRemoved) cutout = 'ai';
  }
  if (cutout === 'none') {
    pixels = new ImageData(new Uint8ClampedArray(original.data), w, h);
    analysis = analyzeAndClean({ data: pixels.data, width: w, height: h });
    if (analysis.backgroundRemoved) cutout = 'basic';
  }
  if (!analysis) throw new Error('사진을 분석하지 못했어요.');
  if (analysis.backgroundRemoved) autoLevels({ data: pixels.data, width: w, height: h });
  ctx.putImageData(pixels, 0, 0);

  const crop = analysis.backgroundRemoved
    ? squareCropAround(analysis.bbox, w, h, 0.1)
    : squareCropAround({ x: 0, y: 0, width: w, height: h }, w, h, 0);
  const out = document.createElement('canvas');
  out.width = CARD_SIZE;
  out.height = CARD_SIZE;
  const octx = out.getContext('2d')!;
  if (!analysis.backgroundRemoved) {
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);
  }
  // Fit the (possibly out-of-bounds) square crop into the card; areas outside
  // the photo stay transparent (or white when the background was kept).
  const k = CARD_SIZE / crop.width;
  if (analysis.backgroundRemoved) {
    // Soft drop shadow so the cut-out sits on the board like a product shot.
    octx.shadowColor = 'rgba(0, 0, 0, 0.16)';
    octx.shadowBlur = CARD_SIZE * 0.025;
    octx.shadowOffsetY = CARD_SIZE * 0.012;
  }
  octx.drawImage(work, -crop.x * k, -crop.y * k, w * k, h * k);

  const blob = analysis.backgroundRemoved ? await canvasToPng(out) : await canvasToJpeg(out);
  return {
    image: toUploadable(blob),
    analysis,
    cutout,
    warnings: qualityWarnings(analysis, img.naturalWidth, img.naturalHeight),
  };
}

export async function processOotdPhoto(uri: string): Promise<UploadableImage> {
  const img = await loadImage(uri);
  const scale = Math.min(1, 1080 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return toUploadable(await canvasToJpeg(canvas, 0.85));
}

export async function toUploadBody(image: UploadableImage): Promise<Blob | ArrayBuffer> {
  if (image.blob) return image.blob;
  return (await fetch(image.previewUri)).blob();
}
