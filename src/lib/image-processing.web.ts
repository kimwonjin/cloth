import { analyzeAndClean, qualityWarnings, squareCropAround } from '@/domain/image-analysis';

import type { ProcessedClothingPhoto, UploadableImage } from './image-types';

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
 * Web: cuts the garment out of a plain background (transparent PNG), crops a
 * square around it and detects its dominant color, all in the browser.
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
  const pixels = ctx.getImageData(0, 0, w, h);
  const analysis = analyzeAndClean({ data: pixels.data, width: w, height: h });
  ctx.putImageData(pixels, 0, 0);

  const crop = analysis.backgroundRemoved
    ? squareCropAround(analysis.bbox, w, h)
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
  octx.drawImage(work, -crop.x * k, -crop.y * k, w * k, h * k);

  const blob = analysis.backgroundRemoved ? await canvasToPng(out) : await canvasToJpeg(out);
  return {
    image: toUploadable(blob),
    analysis,
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
