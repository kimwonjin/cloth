import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ClothingImage } from '@/components/closet/clothing-image';
import { ThemedText } from '@/components/themed-text';
import { Button, IconButton } from '@/components/ui/button';
import { Header, Screen, SectionTitle } from '@/components/ui/screen';
import { ErrorState, Loading } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { monthGrid, toDateKey } from '@/domain/dates';
import { neverWorn, unwornFor, wearStats } from '@/domain/stats';
import { useTheme } from '@/hooks/use-theme';
import { listMyClothes, listWearEntries, listWearLogs } from '@/lib/api';
import { useQuery } from '@/lib/use-query';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarScreen() {
  const theme = useTheme();
  const today = new Date();
  const todayKey = toDateKey(today);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const weeks = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  const month = useQuery(async () => {
    const from = toDateKey(new Date(cursor.year, cursor.month, 1));
    const to = toDateKey(new Date(cursor.year, cursor.month + 1, 0));
    return listWearLogs(from, to);
  }, [cursor.year, cursor.month]);

  const stats = useQuery(async () => {
    const [clothes, entries] = await Promise.all([listMyClothes(), listWearEntries()]);
    return wearStats(clothes, entries);
  });

  const logsByDay = useMemo(() => new Map((month.data ?? []).map((l) => [l.worn_on, l])), [month.data]);
  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const unworn = stats.data ? unwornFor(stats.data, today) : [];
  const never = stats.data ? neverWorn(stats.data) : [];
  const top = stats.data?.filter((s) => s.count > 0).slice(0, 10) ?? [];

  return (
    <Screen
      refreshing={month.loading && !!month.data}
      onRefresh={() => {
        month.reload();
        stats.reload();
      }}>
      <Header
        title="OOTD 캘린더"
        right={
          <Button
            small
            variant="secondary"
            title="오늘 기록"
            onPress={() => router.push(`/ootd/${todayKey}`)}
          />
        }
      />

      <View style={styles.monthBar}>
        <IconButton name="left" label="이전 달" onPress={() => shift(-1)} />
        <ThemedText style={styles.monthTitle} testID="month-title">
          {cursor.year}년 {cursor.month + 1}월
        </ThemedText>
        <IconButton name="right" label="다음 달" onPress={() => shift(1)} />
      </View>

      <View style={styles.grid}>
        <View style={styles.week}>
          {WEEKDAYS.map((d, i) => (
            <ThemedText
              key={d}
              type="small"
              themeColor="textSecondary"
              style={[styles.weekday, i === 0 && { color: theme.danger }]}>
              {d}
            </ThemedText>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.week}>
            {week.map((day, di) => {
              if (!day) return <View key={di} style={styles.day} />;
              const key = toDateKey(day);
              const log = logsByDay.get(key);
              const thumb = log?.outfit?.items.find((i) => i.slot === 'top') ?? log?.outfit?.items[0];
              const isToday = key === todayKey;
              return (
                <Pressable
                  key={di}
                  testID={`day-${key}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.getDate()}일${log ? ' 기록 있음' : ''}`}
                  onPress={() => router.push(`/ootd/${key}`)}
                  style={({ pressed }) => [
                    styles.day,
                    { backgroundColor: log ? theme.backgroundElement : 'transparent' },
                    isToday && { borderColor: theme.accent, borderWidth: 1.5 },
                    pressed && { opacity: 0.6 },
                  ]}>
                  <ThemedText type="small" style={styles.dayNum}>
                    {day.getDate()}
                  </ThemedText>
                  {thumb ? (
                    <ClothingImage path={thumb.clothing.image_path} style={styles.thumb} />
                  ) : log ? (
                    <View style={[styles.dot, { backgroundColor: theme.text }]} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {month.error && <ErrorState error={month.error} onRetry={month.reload} />}
      <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
        이번 달 {month.data?.length ?? 0}일 기록했어요
      </ThemedText>

      <SectionTitle>많이 입은 옷</SectionTitle>
      {!stats.data && stats.loading && <Loading />}
      {stats.data && top.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.pad}>
          아직 기록이 없어요. 오늘의 코디에서 &quot;오늘 이거 입었어요&quot;를 눌러보세요.
        </ThemedText>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
        {top.map((s) => (
          <Pressable key={s.clothing.id} onPress={() => router.push(`/clothing/${s.clothing.id}`)}>
            <ClothingImage path={s.clothing.image_path} style={styles.statImg} />
            <ThemedText type="small" style={styles.center} testID="wear-count">
              {s.count}회
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      <SectionTitle>3달째 안 입은 옷 · {unworn.length}벌</SectionTitle>
      {stats.data && unworn.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.pad}>
          오래 안 입은 옷이 없어요. 옷장을 골고루 활용하고 있어요!
        </ThemedText>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
        {unworn.map((s) => (
          <Pressable key={s.clothing.id} onPress={() => router.push(`/clothing/${s.clothing.id}`)}>
            <ClothingImage path={s.clothing.image_path} style={styles.statImg} />
          </Pressable>
        ))}
      </ScrollView>
      {stats.data && never.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.pad}>
          아직 한 번도 기록하지 않은 옷이 {never.length}벌 있어요.
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  monthTitle: { fontWeight: '700', fontSize: 17, minWidth: 110, textAlign: 'center' },
  grid: { paddingHorizontal: Spacing.two, gap: 4 },
  week: { flexDirection: 'row', gap: 4 },
  weekday: { flex: 1, textAlign: 'center' },
  day: {
    flex: 1,
    aspectRatio: 0.72,
    borderRadius: 10,
    alignItems: 'center',
    paddingTop: 4,
    overflow: 'hidden',
  },
  dayNum: { fontSize: 12, lineHeight: 16 },
  thumb: { width: '86%', flex: 1, marginBottom: 4, borderRadius: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  summary: { textAlign: 'center', marginTop: Spacing.two },
  pad: { paddingHorizontal: Spacing.three },
  hList: { gap: Spacing.two, paddingHorizontal: Spacing.three },
  statImg: { width: 84, height: 84, borderRadius: 12 },
  center: { textAlign: 'center', marginTop: 2 },
});
