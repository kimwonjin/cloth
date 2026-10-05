import type { Analysis } from '@/domain/image-analysis';

/** A processed image ready to upload, plus a local URI for previewing it. */
export interface UploadableImage {
  previewUri: string;
  /** Web: a Blob. Native: undefined, the file at `previewUri` is uploaded. */
  blob?: Blob;
  contentType: 'image/jpeg' | 'image/png';
}

export interface ProcessedClothingPhoto {
  image: UploadableImage;
  /** Null where pixel analysis isn't available (native for now). */
  analysis: Analysis | null;
  /** How the background was removed: AI model, flood-fill fallback, or not at all. */
  cutout: 'ai' | 'basic' | 'none';
  warnings: string[];
}
