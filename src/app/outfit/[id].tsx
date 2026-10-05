import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { OutfitCollage } from '@/components/closet/outfit-collage';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip, ChipGroup } from '@/components/ui/chip';
import { Screen, SectionTitle } from '@/components/ui/screen';
import { ErrorState, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getColor } from '@/domain/colors';
import { toDateKey } from '@/domain/dates';
import { CATEGORY_LABELS, STYLE_LABELS, STYLES, type Style } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteOutfit,
  getMyReactions,
  getOutfit,
  getWearLog,
  recordWear,
  setLiked,
  setOutfitVisibility,
  setSavedToBoard,
} from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { confirm } from '@/lib/dialog';
import { useQuery } from '@/lib/use-query';

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const toast = useToast();
  const userId = useUserId();
  const { width } = useWindowDimensions();
  const { data, error, loading, reload, setData } = useQuery(async () => {
    const [outfit, reactions] = await Promise.all([getOutfit(id), getMyReactions([id])]);
    return { outfit, liked: reactions.liked.has(id), saved: reactions.saved.has(id) };
  }, [id]);
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) {
    return (
      <Screen edges={['bottom']}>
        {loading ? <Loading /> : error && <ErrorState error={error} onRetry={reload} />}
      </Screen>
    );
  }

  const { outfit, liked, saved } = data;
  const mine = outfit.user_id === userId;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : '문제가 생겼어요.');
    } finally {
      setBusy(null);
    }
  };

  const toggleLike = () =>
    run('like', async () => {
      await setLiked(outfit.id, !liked);
      setData({
        ...data,
        liked: !liked,
        outfit: { ...outfit, like_count: outfit.like_count + (liked ? -1 : 1) },
      });
    });

  const toggleSave = () =>
    run('save', async () => {
      await setSavedToBoard(outfit.id, !saved);
      setData({ ...data, saved: !saved });
      toast(saved ? '보드에서 뺐어요' : '내 보드에 저장했어요');
    });

  const toggleVisibility = () =>
    run('visibility', async () => {
      const next = outfit.visibility === 'public' ? 'private' : 'public';
      await setOutfitVisibility(outfit.id, next);
      setData({ ...data, outfit: { ...outfit, visibility: next } });
      toast(next === 'public' ? '탐색에 게시했어요' : '비공개로 바꿨어요');
    });

  const toggleStyle = (s: Style) =>
    run('style', async () => {
      const styles = outfit.styles.includes(s) ? outfit.styles.filter((x) => x !== s) : [...outfit.styles, s];
      await setOutfitVisibility(outfit.id, outfit.visibility, styles);
      setData({ ...data, outfit: { ...outfit, styles } });
    });

  const wearToday = () =>
    run('wear', async () => {
      const key = toDateKey(new Date());
      const existing = await getWearLog(key);
      if (existing?.outfit_id && existing.outfit_id !== outfit.id) {
        const ok = await confirm('오늘 기록을 바꿀까요?', '오늘 이미 기록한 코디가 있어요.', '바꾸기');
        if (!ok) return;
      }
      await recordWear(key, outfit.id);
      toast('오늘의 OOTD로 기록했어요');
    });

  const remove = () =>
    run('delete', async () => {
      const ok = await confirm('코디를 삭제할까요?', '캘린더 기록에서도 코디가 사라져요.', '삭제');
      if (!ok) return;
      await deleteOutfit(outfit.id);
      toast('삭제했어요');
      router.back();
    });

  const collageWidth = Math.min(width, MaxContentWidth) - Spacing.five * 2;

  return (
    <Screen edges={['bottom']}>
      <View style={styles.top}>
        <OutfitCollage testID="outfit-collage" items={outfit.items} width={Math.min(collageWidth, 380)} />
      </View>
      <View style={styles.meta}>
        <ThemedText type="smallBold">{mine ? '내 코디' : outfit.profile?.nickname || '익명'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" testID="like-count">
          좋아요 {outfit.like_count}
        </ThemedText>
      </View>

      <View style={styles.colors}>
        {outfit.items.map((i) => (
          <View key={i.clothing.id} style={styles.colorItem}>
            <View style={[styles.swatch, { backgroundColor: getColor(i.clothing.color).hex, borderColor: theme.border }]} />
            <ThemedText type="small" themeColor="textSecondary">
              {CATEGORY_LABELS[i.slot]} · {getColor(i.clothing.color).label}
              {i.clothing.brand ? ` · ${i.clothing.brand}` : ''}
            </ThemedText>
          </View>
        ))}
      </View>

      {!mine && (
        <View style={styles.actions}>
          <View style={styles.row}>
            <Button
              testID="like-button"
              variant="secondary"
              icon={liked ? 'heartFill' : 'heart'}
              title={liked ? '좋아요 취소' : '좋아요'}
              onPress={toggleLike}
              loading={busy === 'like'}
              style={styles.flex}
            />
            <Button
              testID="board-button"
              variant="secondary"
              icon={saved ? 'bookmarkFill' : 'bookmark'}
              title={saved ? '보드에 저장됨' : '보드에 저장'}
              onPress={toggleSave}
              loading={busy === 'save'}
              style={styles.flex}
            />
          </View>
          <Button
            testID="copy-outfit"
            icon="sparkles"
            title="내 옷으로 따라 입기"
            onPress={() => router.push(`/outfit/new?copyOf=${outfit.id}`)}
          />
        </View>
      )}

      {mine && (
        <>
          <View style={styles.actions}>
            <Button testID="wear-today" icon="check" title="오늘 이거 입었어요" onPress={wearToday} loading={busy === 'wear'} />
            <Button
              testID="toggle-visibility"
              variant="secondary"
              icon={outfit.visibility === 'public' ? 'lock' : 'public'}
              title={outfit.visibility === 'public' ? '비공개로 바꾸기' : '탐색에 게시하기'}
              onPress={toggleVisibility}
              loading={busy === 'visibility'}
            />
          </View>
          <SectionTitle>스타일 태그</SectionTitle>
          <View style={styles.pad}>
            <ChipGroup>
              {STYLES.map((s) => (
                <Chip
                  key={s}
                  label={STYLE_LABELS[s]}
                  selected={outfit.styles.includes(s)}
                  onPress={() => toggleStyle(s)}
                />
              ))}
            </ChipGroup>
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 8 }}>
              공개 상태: {outfit.visibility === 'public' ? '공개 (탐색에 보여요)' : '비공개 (나만 보여요)'}
            </ThemedText>
          </View>
          <View style={styles.actions}>
            <Button variant="danger" icon="trash" title="코디 삭제" onPress={remove} loading={busy === 'delete'} />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', paddingTop: Spacing.three },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  colors: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, gap: 4 },
  colorItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  actions: { padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  pad: { paddingHorizontal: Spacing.three },
});
