import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { ProcessedClothingPhoto, UploadableImage } from './image-types';

/**
 * Native implementation: resize only. Background removal and auto color
 * detection run on web (canvas) for now; on native the user picks the color.
 */
async function resizeTo(uri: string, width: number): Promise<UploadableImage> {
  const ref = await ImageManipulator.manipulate(uri).resize({ width }).renderAsync();
  const saved = await ref.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return { previewUri: saved.uri, contentType: 'image/jpeg' };
}

export async function processClothingPhoto(uri: string): Promise<ProcessedClothingPhoto> {
  return { image: await resizeTo(uri, 800), analysis: null, cutout: 'none', warnings: [] };
}

export async function processOotdPhoto(uri: string): Promise<UploadableImage> {
  return resizeTo(uri, 1080);
}

export async function toUploadBody(image: UploadableImage): Promise<Blob | ArrayBuffer> {
  if (image.blob) return image.blob;
  const res = await fetch(image.previewUri);
  return res.arrayBuffer();
}
