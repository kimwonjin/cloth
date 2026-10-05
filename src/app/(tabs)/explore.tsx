import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OutfitMasonry } from '@/components/closet/masonry';
import { ChipFilter } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { Header, Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, Loading } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { COLORS } from '@/domain/colors';
import {
  SEASON_LABELS,
  SEASONS,
  STYLE_LABELS,
  STYLES,
  type Outfit,
  type Season,
  type Style,
} from '@/domain/types';
import { EXPLORE_PAGE_SIZE, listPublicOutfits } from '@/lib/api';
import { useQuery } from '@/lib/use-query';

const COLOR_OPTIONS = COLORS.filter((c) => c.key !== 'etc');

export default function ExploreScreen() {
  const [season, setSeason] = useState<Season | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [style, setStyle] = useState<Style | null>(null);
  const [more, setMore] = useState<Outfit[]>([]);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const filters = { season, color, style };
  const { data, error, loading, reload } = useQuery(async () => {
    const first = await listPublicOutfits(filters, 0);
    setMore([]);
    setPage(0);
    setHasMore(first.length === EXPLORE_PAGE_SIZE);
    return first;
  }, [season, color, style]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await listPublicOutfits(filters, page + 1);
      setMore((m) => [...m, ...next]);
      setPage((p) => p + 1);
      setHasMore(next.length === EXPLORE_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  const outfits = [...(data ?? []), ...more];

  return (
    <Screen refreshing={loading && !!data} onRefresh={reload}>
      <Header title="탐색" />
      <View style={styles.filters}>
        <ChipFilter
          allLabel="모든 계절"
          options={SEASONS.map((s) => ({ value: s, label: SEASON_LABELS[s] }))}
          value={season}
          onChange={setSeason}
        />
        <ChipFilter
          allLabel="모든 스타일"
          options={STYLES.map((s) => ({ value: s, label: STYLE_LABELS[s] }))}
          value={style}
          onChange={setStyle}
        />
        <ChipFilter
          allLabel="모든 색"
          options={COLOR_OPTIONS.map((c) => ({ value: c.key, label: c.label }))}
          swatches={Object.fromEntries(COLOR_OPTIONS.map((c) => [c.key, c.hex]))}
          value={color}
          onChange={setColor}
        />
      </View>

      {!data && loading && <Loading />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && outfits.length === 0 && (
        <EmptyState
          icon="explore"
          title="아직 공개된 코디가 없어요"
          description={
            season || color || style
              ? '필터를 바꿔보세요.'
              : '오늘의 코디에서 마음에 드는 코디를 게시해 첫 코디를 올려보세요!'
          }
        />
      )}
      <OutfitMasonry outfits={outfits} onPress={(o) => router.push(`/outfit/${o.id}`)} />
      {data && hasMore && outfits.length > 0 && (
        <Button
          variant="secondary"
          title="더 보기"
          onPress={loadMore}
          loading={loadingMore}
          style={styles.more}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: Spacing.two, marginBottom: Spacing.three },
  more: { margin: Spacing.three },
});
