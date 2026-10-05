import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ClothingGrid } from '@/components/closet/clothing-grid';
import { OutfitMasonry } from '@/components/closet/masonry';
import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/button';
import { ChipFilter } from '@/components/ui/chip';
import { Header, Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, Loading } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  SEASON_LABELS,
  SEASONS,
  type Category,
  type Season,
} from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { countMyStats, getMyProfile, listBoard, listMyClothes, listMyPublicOutfits } from '@/lib/api';
import { useQuery } from '@/lib/use-query';

type Tab = 'clothes' | 'board' | 'posts';

export default function ClosetScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('clothes');
  const [category, setCategory] = useState<Category | null>(null);
  const [season, setSeason] = useState<Season | null>(null);

  const profile = useQuery(async () => {
    const [p, counts] = await Promise.all([getMyProfile(), countMyStats()]);
    return { ...p, ...counts };
  });
  const clothes = useQuery(listMyClothes);
  const board = useQuery(listBoard);
  const posts = useQuery(listMyPublicOutfits);

  const filtered = useMemo(
    () =>
      (clothes.data ?? []).filter(
        (c) => (!category || c.category === category) && (!season || c.seasons.includes(season))
      ),
    [clothes.data, category, season]
  );

  const reloadAll = () => {
    profile.reload();
    clothes.reload();
    board.reload();
    posts.reload();
  };

  const p = profile.data;
  return (
    <Screen refreshing={clothes.loading && !!clothes.data} onRefresh={reloadAll}>
      <Header
        title={p?.nickname || '내 옷장'}
        right={<IconButton name="edit" label="설정" onPress={() => router.push('/settings')} />}
      />
      <View style={styles.stats}>
        <Stat label="옷" value={p?.clothes} />
        <Stat label="공개 코디" value={p?.publicOutfits} />
        <Stat label="OOTD" value={p?.wearLogs} />
      </View>

      <View style={[styles.tabs, { borderColor: theme.border }]}>
        {(
          [
            ['clothes', '옷'],
            ['board', '보드'],
            ['posts', '내 공개 코디'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <Pressable
            key={key}
            testID={`closet-tab-${key}`}
            accessibilityRole="tab"
            aria-selected={tab === key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && { borderBottomColor: theme.text, borderBottomWidth: 2 }]}>
            <ThemedText
              type="smallBold"
              themeColor={tab === key ? 'text' : 'textSecondary'}>
              {label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {tab === 'clothes' && (
        <>
          <View style={styles.filters}>
            <ChipFilter
              options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
              value={category}
              onChange={setCategory}
            />
            <ChipFilter
              allLabel="모든 계절"
              options={SEASONS.map((s) => ({ value: s, label: SEASON_LABELS[s] }))}
              value={season}
              onChange={setSeason}
            />
          </View>
          {!clothes.data && clothes.loading && <Loading />}
          {clothes.error && <ErrorState error={clothes.error} onRetry={clothes.reload} />}
          {clothes.data && filtered.length === 0 && (
            <EmptyState
              icon="closet"
              title={clothes.data.length === 0 ? '첫 옷을 등록해보세요' : '조건에 맞는 옷이 없어요'}
              action={{ title: '옷 등록하기', onPress: () => router.push('/clothing/new') }}
            />
          )}
          <ClothingGrid clothes={filtered} onPress={(c) => router.push(`/clothing/${c.id}`)} />
        </>
      )}

      {tab === 'board' && (
        <>
          {!board.data && board.loading && <Loading />}
          {board.data?.length === 0 && (
            <EmptyState
              icon="bookmark"
              title="저장한 코디가 없어요"
              description="탐색에서 마음에 드는 코디를 보드에 저장해보세요."
            />
          )}
          <View style={styles.top}>
            <OutfitMasonry outfits={board.data ?? []} onPress={(o) => router.push(`/outfit/${o.id}`)} />
          </View>
        </>
      )}

      {tab === 'posts' && (
        <>
          {!posts.data && posts.loading && <Loading />}
          {posts.data?.length === 0 && (
            <EmptyState
              icon="public"
              title="공개한 코디가 없어요"
              description="코디를 게시하면 탐색 탭에 보여요. 기본은 비공개예요."
            />
          )}
          <View style={styles.top}>
            <OutfitMasonry
              outfits={posts.data ?? []}
              showMeta={false}
              onPress={(o) => router.push(`/outfit/${o.id}`)}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.statValue}>{value ?? '-'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.two },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginTop: Spacing.two },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two + 4 },
  filters: { gap: Spacing.two, paddingVertical: Spacing.three },
  top: { paddingTop: Spacing.three },
});
