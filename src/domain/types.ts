export const CATEGORIES = ['top', 'bottom', 'outer', 'shoes', 'accessory'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: '상의',
  bottom: '하의',
  outer: '아우터',
  shoes: '신발',
  accessory: '액세서리',
};

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_LABELS: Record<Season, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
};

export const STYLES = ['casual', 'minimal', 'street', 'formal', 'sporty', 'lovely'] as const;
export type Style = (typeof STYLES)[number];

export const STYLE_LABELS: Record<Style, string> = {
  casual: '캐주얼',
  minimal: '미니멀',
  street: '스트릿',
  formal: '포멀',
  sporty: '스포티',
  lovely: '러블리',
};

export type Visibility = 'private' | 'public';

export interface Clothing {
  id: string;
  user_id: string;
  image_path: string;
  category: Category;
  color: string;
  seasons: Season[];
  brand: string | null;
  size: string | null;
  created_at: string;
}

/** A combination of clothes, keyed by slot. Only `top`/`bottom`/`shoes` are required. */
export interface OutfitDraft {
  top?: Clothing;
  bottom?: Clothing;
  outer?: Clothing;
  shoes?: Clothing;
  accessory?: Clothing;
}

export interface Outfit {
  id: string;
  user_id: string;
  source: 'ai' | 'manual' | 'copy';
  visibility: Visibility;
  styles: string[];
  seasons: string[];
  colors: string[];
  like_count: number;
  created_at: string;
  published_at: string | null;
  items: { slot: Category; position: number; clothing: Clothing }[];
  profile?: { nickname: string } | null;
}

export interface WearLog {
  id: string;
  user_id: string;
  worn_on: string; // YYYY-MM-DD
  outfit_id: string | null;
  photo_path: string | null;
  created_at: string;
}
