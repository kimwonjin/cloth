import { draftItems, SLOT_ORDER, type WornEntry } from '@/domain/recommend';
import { parseDateKey } from '@/domain/dates';
import type {
  Category,
  Clothing,
  Outfit,
  OutfitDraft,
  Season,
  Visibility,
  WearLog,
} from '@/domain/types';
import { toUploadBody } from '@/lib/image-processing';
import type { UploadableImage } from '@/lib/image-types';
import { supabase } from '@/lib/supabase';

/** Thin data layer over Supabase. Screens call these instead of supabase directly. */

type ApiError = { message: string; code?: string };

/** Turns PostgREST / Storage errors into messages users can act on. */
export function apiErrorMessage(error: ApiError): string {
  if (error.code === 'PGRST116') return '찾을 수 없어요. 삭제되었거나 비공개로 바뀌었을 수 있어요.';
  if (error.code === '42501' || /row-level security/i.test(error.message)) return '권한이 없어요.';
  if (error.code === '23505') return '이미 처리된 요청이에요.';
  if (/fetch|network/i.test(error.message)) return '서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요.';
  if (/exceeded the maximum allowed size|too large/i.test(error.message)) return '사진 용량이 너무 커요.';
  return `문제가 생겼어요. (${error.code ?? error.message})`;
}

/** Throws on error. Mutations without `.select()` return null data, which callers ignore. */
function check<T>(res: { data: T | null; error: ApiError | null }): T {
  if (res.error) throw new Error(apiErrorMessage(res.error));
  return res.data as T;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('로그인이 필요해요.');
  return id;
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function uploadImage(bucket: 'clothes' | 'ootd', image: UploadableImage): Promise<string> {
  const userId = await currentUserId();
  const ext = image.contentType === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/${randomId()}.${ext}`;
  const body = await toUploadBody(image);
  check(await supabase.storage.from(bucket).upload(path, body, { contentType: image.contentType }));
  return path;
}

export function clothingImageUrl(path: string): string {
  return supabase.storage.from('clothes').getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  nickname: string;
}

export async function getMyProfile(): Promise<Profile> {
  const id = await currentUserId();
  return check(await supabase.from('profiles').select('id, nickname').eq('id', id).single());
}

export async function updateNickname(nickname: string) {
  const id = await currentUserId();
  check(await supabase.from('profiles').update({ nickname: nickname.trim() }).eq('id', id));
}

// ---------------------------------------------------------------------------
// Clothes
// ---------------------------------------------------------------------------

export interface ClothingInput {
  category: Category;
  color: string;
  seasons: Season[];
  brand?: string | null;
  size?: string | null;
}

export async function listMyClothes(): Promise<Clothing[]> {
  const id = await currentUserId();
  return check(
    await supabase.from('clothes').select('*').eq('user_id', id).order('created_at', { ascending: false })
  ) as Clothing[];
}

export async function getClothing(id: string): Promise<Clothing> {
  return check(await supabase.from('clothes').select('*').eq('id', id).single()) as Clothing;
}

export async function createClothing(image: UploadableImage, input: ClothingInput): Promise<Clothing> {
  const image_path = await uploadImage('clothes', image);
  return check(
    await supabase
      .from('clothes')
      .insert({ ...input, image_path, brand: input.brand || null, size: input.size || null })
      .select('*')
      .single()
  ) as Clothing;
}

export async function updateClothing(id: string, input: Partial<ClothingInput>) {
  check(await supabase.from('clothes').update(input).eq('id', id));
}

export async function deleteClothing(clothing: Clothing) {
  check(await supabase.from('clothes').delete().eq('id', clothing.id));
  await supabase.storage.from('clothes').remove([clothing.image_path]);
}

// ---------------------------------------------------------------------------
// Outfits
// ---------------------------------------------------------------------------

const OUTFIT_SELECT =
  'id, user_id, source, visibility, styles, seasons, colors, like_count, created_at, published_at, ' +
  'profile:profiles!outfits_user_id_fkey(nickname), items:outfit_items(slot, position, clothing:clothes(*))';

type OutfitRow = Omit<Outfit, 'items'> & {
  items: { slot: Category; position: number; clothing: Clothing | null }[];
};

function normalizeOutfit(row: OutfitRow): Outfit {
  const items = row.items
    // Items can be hidden by RLS (e.g. a clothing row deleted) — drop them.
    .filter((i): i is Outfit['items'][number] => i.clothing !== null)
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || a.position - b.position);
  return { ...row, items };
}

export function outfitToDraft(outfit: Outfit): OutfitDraft {
  const draft: OutfitDraft = {};
  for (const i of outfit.items) if (!draft[i.slot]) draft[i.slot] = i.clothing;
  return draft;
}

export interface CreateOutfitOptions {
  source: Outfit['source'];
  visibility?: Visibility;
  styles?: string[];
}

export async function createOutfit(draft: OutfitDraft, opts: CreateOutfitOptions): Promise<string> {
  const items = draftItems(draft);
  if (items.length === 0) throw new Error('옷을 하나 이상 골라주세요.');
  const seasons = [...new Set(items.flatMap((c) => c.seasons))];
  const colors = [...new Set(items.map((c) => c.color))];
  const outfit = check(
    await supabase
      .from('outfits')
      .insert({
        source: opts.source,
        visibility: opts.visibility ?? 'private',
        styles: opts.styles ?? [],
        seasons,
        colors,
      })
      .select('id')
      .single()
  ) as { id: string };
  const rows = SLOT_ORDER.filter((slot) => draft[slot]).map((slot, position) => ({
    outfit_id: outfit.id,
    clothing_id: draft[slot]!.id,
    slot,
    position,
  }));
  const res = await supabase.from('outfit_items').insert(rows);
  if (res.error) {
    await supabase.from('outfits').delete().eq('id', outfit.id);
    throw new Error(apiErrorMessage(res.error));
  }
  return outfit.id;
}

export async function getOutfit(id: string): Promise<Outfit> {
  const row = check(await supabase.from('outfits').select(OUTFIT_SELECT).eq('id', id).single());
  return normalizeOutfit(row as unknown as OutfitRow);
}

export async function listMyPublicOutfits(): Promise<Outfit[]> {
  const id = await currentUserId();
  const rows = check(
    await supabase
      .from('outfits')
      .select(OUTFIT_SELECT)
      .eq('user_id', id)
      .eq('visibility', 'public')
      .order('published_at', { ascending: false })
  );
  return (rows as unknown as OutfitRow[]).map(normalizeOutfit);
}

export async function listMySavedOutfits(): Promise<Outfit[]> {
  const id = await currentUserId();
  const rows = check(
    await supabase
      .from('outfits')
      .select(OUTFIT_SELECT)
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(60)
  );
  return (rows as unknown as OutfitRow[]).map(normalizeOutfit);
}

export interface ExploreFilters {
  season?: Season | null;
  color?: string | null;
  style?: string | null;
}

export const EXPLORE_PAGE_SIZE = 20;

export async function listPublicOutfits(filters: ExploreFilters, page = 0): Promise<Outfit[]> {
  let q = supabase.from('outfits').select(OUTFIT_SELECT).eq('visibility', 'public');
  if (filters.season) q = q.contains('seasons', [filters.season]);
  if (filters.color) q = q.contains('colors', [filters.color]);
  if (filters.style) q = q.contains('styles', [filters.style]);
  const from = page * EXPLORE_PAGE_SIZE;
  const rows = check(
    await q.order('published_at', { ascending: false }).range(from, from + EXPLORE_PAGE_SIZE - 1)
  );
  return (rows as unknown as OutfitRow[]).map(normalizeOutfit);
}

export async function setOutfitVisibility(id: string, visibility: Visibility, styles?: string[]) {
  check(
    await supabase
      .from('outfits')
      .update(styles ? { visibility, styles } : { visibility })
      .eq('id', id)
  );
}

export async function deleteOutfit(id: string) {
  check(await supabase.from('outfits').delete().eq('id', id));
}

// ---------------------------------------------------------------------------
// Likes & board
// ---------------------------------------------------------------------------

export async function getMyReactions(outfitIds: string[]) {
  if (outfitIds.length === 0) return { liked: new Set<string>(), saved: new Set<string>() };
  const [likes, saves] = await Promise.all([
    supabase.from('outfit_likes').select('outfit_id').in('outfit_id', outfitIds),
    supabase.from('board_saves').select('outfit_id').in('outfit_id', outfitIds),
  ]);
  return {
    liked: new Set(check(likes).map((r) => r.outfit_id as string)),
    saved: new Set(check(saves).map((r) => r.outfit_id as string)),
  };
}

export async function setLiked(outfitId: string, liked: boolean) {
  if (liked) check(await supabase.from('outfit_likes').insert({ outfit_id: outfitId }));
  else check(await supabase.from('outfit_likes').delete().eq('outfit_id', outfitId));
}

export async function setSavedToBoard(outfitId: string, saved: boolean) {
  if (saved) check(await supabase.from('board_saves').insert({ outfit_id: outfitId }));
  else check(await supabase.from('board_saves').delete().eq('outfit_id', outfitId));
}

export async function listBoard(): Promise<Outfit[]> {
  const rows = check(
    await supabase
      .from('board_saves')
      .select(`created_at, outfit:outfits(${OUTFIT_SELECT})`)
      .order('created_at', { ascending: false })
  ) as unknown as { outfit: OutfitRow | null }[];
  // Outfits made private by their owner disappear from the board.
  return rows.filter((r) => r.outfit).map((r) => normalizeOutfit(r.outfit!));
}

// ---------------------------------------------------------------------------
// Wear logs (OOTD calendar)
// ---------------------------------------------------------------------------

export interface WearLogWithOutfit extends WearLog {
  outfit: Outfit | null;
}

export async function listWearLogs(fromKey: string, toKey: string): Promise<WearLogWithOutfit[]> {
  const rows = check(
    await supabase
      .from('wear_logs')
      .select(`*, outfit:outfits(${OUTFIT_SELECT})`)
      .gte('worn_on', fromKey)
      .lte('worn_on', toKey)
      .order('worn_on')
  ) as unknown as (WearLog & { outfit: OutfitRow | null })[];
  return rows.map((r) => ({ ...r, outfit: r.outfit ? normalizeOutfit(r.outfit) : null }));
}

export async function getWearLog(dateKey: string): Promise<WearLogWithOutfit | null> {
  const logs = await listWearLogs(dateKey, dateKey);
  return logs[0] ?? null;
}

/** Every day's worn clothing ids — feeds stats and the recommender's history. */
export async function listWearEntries(): Promise<{ worn_on: string; clothingIds: string[] }[]> {
  const rows = check(
    await supabase
      .from('wear_logs')
      .select('worn_on, outfit:outfits(items:outfit_items(clothing_id))')
      .order('worn_on', { ascending: false })
      .limit(1000)
  ) as unknown as { worn_on: string; outfit: { items: { clothing_id: string }[] } | null }[];
  return rows.map((r) => ({
    worn_on: r.worn_on,
    clothingIds: r.outfit?.items.map((i) => i.clothing_id) ?? [],
  }));
}

export function toWornEntries(entries: { worn_on: string; clothingIds: string[] }[]): WornEntry[] {
  return entries.map((e) => ({ date: parseDateKey(e.worn_on), clothingIds: e.clothingIds }));
}

/** Records (or replaces) what was worn on a date. */
export async function recordWear(dateKey: string, outfitId: string) {
  check(
    await supabase
      .from('wear_logs')
      .upsert({ worn_on: dateKey, outfit_id: outfitId }, { onConflict: 'user_id,worn_on' })
  );
}

export async function setWearPhoto(dateKey: string, image: UploadableImage) {
  const path = await uploadImage('ootd', image);
  const existing = await getWearLog(dateKey);
  check(
    await supabase
      .from('wear_logs')
      .upsert({ worn_on: dateKey, photo_path: path }, { onConflict: 'user_id,worn_on' })
  );
  if (existing?.photo_path) await supabase.storage.from('ootd').remove([existing.photo_path]);
}

export async function deleteWearLog(log: WearLog) {
  check(await supabase.from('wear_logs').delete().eq('id', log.id));
  if (log.photo_path) await supabase.storage.from('ootd').remove([log.photo_path]);
}

export async function ootdPhotoUrl(path: string): Promise<string> {
  const data = check(await supabase.storage.from('ootd').createSignedUrl(path, 60 * 60));
  return data.signedUrl;
}

export async function countMyStats() {
  const id = await currentUserId();
  const head = { count: 'exact' as const, head: true };
  const [clothes, outfits, logs] = await Promise.all([
    supabase.from('clothes').select('id', head).eq('user_id', id),
    supabase.from('outfits').select('id', head).eq('user_id', id).eq('visibility', 'public'),
    supabase.from('wear_logs').select('id', head).eq('user_id', id),
  ]);
  return { clothes: clothes.count ?? 0, publicOutfits: outfits.count ?? 0, wearLogs: logs.count ?? 0 };
}
