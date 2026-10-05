import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { draftToItems, OutfitCollage } from '@/components/closet/outfit-collage';
import { ThemedText } from '@/components/themed-text';
import { Button, IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Header, Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { seasonOf, toDateKey } from '@/domain/dates';
import { josa } from '@/domain/korean';
import {
  buildWearHistory,
  findShortages,
  recommendOutfits,
  swapSlot,
  type ScoredOutfit,
} from '@/domain/recommend';
import { CATEGORY_LABELS, SEASON_LABELS, type Category, type OutfitDraft } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import {
  createOutfit,
  getWearLog,
  listMyClothes,
  listWearEntries,
  recordWear,
  setOutfitVisibility,
  toWornEntries,
} from '@/lib/api';
import { confirm } from '@/lib/dialog';
import { useQuery } from '@/lib/use-query';

function toSuggestions(r: { outfits: ScoredOutfit[] }): Suggestion[] {
  return r.outfits.map((o) => ({ ...o, seen: {} }));
}

interface Suggestion extends ScoredOutfit {
  /** Set once this exact combination has been saved as an outfit. */
  savedId?: string;
  published?: boolean;
  /** Items already shown per slot, so repeated swaps cycle through the closet. */
  seen: Partial<Record<Category, string[]>>;
}

export default function HomeScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const today = useMemo(() => new Date(), []);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const closetKey = useRef('');
  const { data, error, loading, reload } = useQuery(async () => {
    const [clothes, entries] = await Promise.all([listMyClothes(), listWearEntries()]);
    // New suggestions only when the closet itself changed, not on every focus.
    const key = clothes.map((c) => c.id).join(',');
    if (key !== closetKey.current) {
      closetKey.current = key;
      const h = buildWearHistory(toWornEntries(entries), clothes, today);
      setSuggestions(toSuggestions(recommendOutfits(clothes, { date: today, history: h })));
    }
    return { clothes, entries };
  });
  const [busy, setBusy] = useState<string | null>(null);

  const history = useMemo(
    () => (data ? buildWearHistory(toWornEntries(data.entries), data.clothes, today) : undefined),
    [data, today]
  );
  const shortages = useMemo(() => (data ? findShortages(data.clothes) : []), [data]);

  const regenerate = () => {
    if (data) setSuggestions(toSuggestions(recommendOutfits(data.clothes, { date: today, history })));
  };

  const update = (index: number, next: Partial<Suggestion>) =>
    setSuggestions((prev) => prev.map((s, i) => (i === index ? { ...s, ...next } : s)));

  const swap = (index: number, slot: Category) => {
    if (!data) return;
    const s = suggestions[index];
    const current = s.draft[slot]?.id;
    const seen = [...(s.seen[slot] ?? []), ...(current ? [current] : [])];
    let next = swapSlot(data.clothes, s.draft, slot, { date: today, history, skipIds: seen });
    let nextSeen = seen;
    if (!next) {
      // Went through every item in this category — start over.
      next = swapSlot(data.clothes, s.draft, slot, { date: today, history });
      nextSeen = [];
    }
    if (!next) {
      toast(`다른 ${josa(CATEGORY_LABELS[slot], '이', '가')} 없어요. 더 등록해보세요!`);
      return;
    }
    update(index, { draft: next, savedId: undefined, published: false, seen: { ...s.seen, [slot]: nextSeen } });
  };

  const ensureSaved = async (index: number, draft: OutfitDraft): Promise<string> => {
    const s = suggestions[index];
    if (s.savedId) return s.savedId;
    const id = await createOutfit(draft, { source: 'ai' });
    update(index, { savedId: id });
    return id;
  };

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

  const save = (index: number) =>
    run(`save-${index}`, async () => {
      await ensureSaved(index, suggestions[index].draft);
      toast('코디를 저장했어요');
    });

  const publish = (index: number) =>
    run(`publish-${index}`, async () => {
      const id = await ensureSaved(index, suggestions[index].draft);
      await setOutfitVisibility(id, 'public');
      update(index, { savedId: id, published: true });
      toast('탐색 탭에 게시했어요');
    });

  const wearToday = (index: number) =>
    run(`wear-${index}`, async () => {
      const key = toDateKey(today);
      const existing = await getWearLog(key);
      if (existing?.outfit_id) {
        const ok = await confirm('오늘 기록을 바꿀까요?', '오늘 이미 기록한 코디가 있어요.', '바꾸기');
        if (!ok) return;
      }
      const id = await ensureSaved(index, suggestions[index].draft);
      await recordWear(key, id);
      toast('오늘의 OOTD로 기록했어요');
      reload();
    });

  const cardWidth = Math.min(width, MaxContentWidth) - Spacing.three * 2;
  const blocking = shortages.filter((s) => s.blocking);
  const hints = shortages.filter((s) => !s.blocking);

  return (
    <Screen refreshing={loading && !!data} onRefresh={reload}>
      <Header
        title="오늘의 코디"
        right={
          suggestions.length > 0 ? (
            <IconButton name="refresh" label="코디 새로고침" onPress={regenerate} testID="refresh-outfits" />
          ) : undefined
        }
      />
      <ThemedText type="small" themeColor="textSecondary" style={styles.sub}>
        {today.getMonth() + 1}월 {today.getDate()}일 · {SEASON_LABELS[seasonOf(today)]} 코디 · 옷을 누르면
        다른 옷으로 바꿔요
      </ThemedText>

      {!data && loading && <Loading />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}

      {data && blocking.length > 0 && (
        <EmptyState
          icon="closet"
          title={data.clothes.length === 0 ? '옷장이 비어 있어요' : '코디를 만들 옷이 부족해요'}
          description={blocking.map((s) => s.message).join('\n')}
          action={{ title: '옷 등록하기', onPress: () => router.push('/clothing/new') }}
        />
      )}

      <View style={styles.list}>
        {suggestions.map((s, i) => (
          <View
            key={i}
            testID="suggestion"
            style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <ThemedText type="smallBold">코디 {i + 1}</ThemedText>
              {s.reasons[0] && (
                <View style={styles.reason}>
                  <Icon name="sparkles" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {s.reasons[0]}
                  </ThemedText>
                </View>
              )}
            </View>
            <View style={styles.collage}>
              <OutfitCollage
                items={draftToItems(s.draft)}
                width={Math.min((cardWidth - Spacing.three * 2) * 0.8, 300)}
                onPressItem={(slot) => swap(i, slot)}
              />
            </View>
            <View style={styles.actions}>
              <Button
                small
                variant="secondary"
                icon={s.savedId ? 'bookmarkFill' : 'bookmark'}
                title={s.savedId ? '저장됨' : '저장'}
                onPress={() => save(i)}
                disabled={!!s.savedId}
                loading={busy === `save-${i}`}
                style={styles.flex}
              />
              <Button
                small
                variant="secondary"
                icon="public"
                title={s.published ? '게시됨' : '게시'}
                onPress={() => publish(i)}
                disabled={s.published}
                loading={busy === `publish-${i}`}
                style={styles.flex}
              />
            </View>
            <Button
              testID={`wear-today-${i}`}
              icon="check"
              title="오늘 이거 입었어요"
              onPress={() => wearToday(i)}
              loading={busy === `wear-${i}`}
            />
          </View>
        ))}
      </View>

      {hints.length > 0 && suggestions.length > 0 && (
        <View style={[styles.hint, { borderColor: theme.border }]}>
          {hints.map((h) => (
            <ThemedText key={h.category} type="small" themeColor="textSecondary">
              · {h.message}
            </ThemedText>
          ))}
          <Button
            small
            variant="ghost"
            icon="plus"
            title="옷 등록하기"
            onPress={() => router.push('/clothing/new')}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { paddingHorizontal: Spacing.three, marginBottom: Spacing.two },
  list: { gap: Spacing.three, paddingHorizontal: Spacing.three },
  card: { borderRadius: 20, borderWidth: 1, padding: Spacing.three, gap: Spacing.two + 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  collage: { alignItems: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  hint: {
    margin: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 4,
  },
});
