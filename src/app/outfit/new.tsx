import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ClothingImage } from '@/components/closet/clothing-image';
import { draftToItems, OutfitCollage } from '@/components/closet/outfit-collage';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip, ChipGroup } from '@/components/ui/chip';
import { Screen, SectionTitle } from '@/components/ui/screen';
import { EmptyState, ErrorState, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { parseDateKey, toDateKey } from '@/domain/dates';
import { josa } from '@/domain/korean';
import { copyOutfitWithMyClothes, draftItems, SLOT_ORDER } from '@/domain/recommend';
import {
  CATEGORY_LABELS,
  STYLE_LABELS,
  STYLES,
  type Category,
  type Clothing,
  type OutfitDraft,
  type Visibility,
} from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { createOutfit, getOutfit, listMyClothes, recordWear } from '@/lib/api';
import { useQuery } from '@/lib/use-query';

export default function NewOutfitScreen() {
  const { date, copyOf } = useLocalSearchParams<{ date?: string; copyOf?: string }>();
  const theme = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [draft, setDraft] = useState<OutfitDraft>({});
  const [styles_, setStyles] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [saving, setSaving] = useState<string | null>(null);
  const [missing, setMissing] = useState<Category[]>([]);
  const prefilled = useRef(false);

  const { data, error, loading, reload } = useQuery(async () => {
    const [clothes, target] = await Promise.all([
      listMyClothes(),
      copyOf ? getOutfit(copyOf) : Promise.resolve(null),
    ]);
    // "내 옷으로 따라 입기": prefill once with my closest clothes.
    if (target && !prefilled.current) {
      prefilled.current = true;
      const copy = copyOutfitWithMyClothes(
        clothes,
        target.items.map((i) => ({ slot: i.slot, color: i.clothing.color }))
      );
      setDraft(copy.draft);
      setMissing(copy.missing);
      setStyles(target.styles);
    }
    return { clothes, target };
  }, [copyOf]);

  const bySlot = useMemo(() => {
    const m = new Map<Category, Clothing[]>();
    for (const slot of SLOT_ORDER) m.set(slot, (data?.clothes ?? []).filter((c) => c.category === slot));
    return m;
  }, [data]);

  if (!data) {
    return (
      <Screen edges={['bottom']}>
        {loading ? <Loading /> : error && <ErrorState error={error} onRetry={reload} />}
      </Screen>
    );
  }
  if (data.clothes.length === 0) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="closet"
          title="옷장이 비어 있어요"
          description="코디를 만들려면 먼저 옷을 등록해주세요."
          action={{ title: '옷 등록하기', onPress: () => router.replace('/clothing/new') }}
        />
      </Screen>
    );
  }

  const items = draftItems(draft);
  const toggle = (slot: Category, id: string) => {
    const c = data.clothes.find((x) => x.id === id)!;
    setDraft((d) => ({ ...d, [slot]: d[slot]?.id === id ? undefined : c }));
  };
  const toggleStyle = (s: string) =>
    setStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const save = async (mode: 'save' | 'wear') => {
    setSaving(mode);
    try {
      const id = await createOutfit(draft, {
        source: copyOf ? 'copy' : 'manual',
        visibility,
        styles: styles_,
      });
      if (mode === 'wear') {
        const key = date ?? toDateKey(new Date());
        await recordWear(key, id);
        toast('OOTD로 기록했어요');
        router.replace(`/ootd/${key}`);
      } else {
        toast(visibility === 'public' ? '저장하고 탐색에 게시했어요' : '코디를 저장했어요');
        router.replace(`/outfit/${id}`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setSaving(null);
    }
  };

  const dateLabel = date
    ? `${parseDateKey(date).getMonth() + 1}월 ${parseDateKey(date).getDate()}일`
    : null;

  return (
    <Screen edges={['bottom']}>
      {copyOf && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          내 옷장에서 가장 비슷한 옷으로 골랐어요.
          {missing.length > 0 &&
            ` (${josa(missing.map((m) => CATEGORY_LABELS[m]).join(', '), '은', '는')} 내 옷장에 없어요)`}
        </ThemedText>
      )}
      <View style={styles.preview}>
        {items.length > 0 ? (
          <OutfitCollage
            testID="builder-preview"
            items={draftToItems(draft)}
            width={Math.min(width, MaxContentWidth) * 0.6}
          />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              아래에서 옷을 골라주세요
            </ThemedText>
          </View>
        )}
      </View>

      {SLOT_ORDER.map((slot) => {
        const options = bySlot.get(slot) ?? [];
        return (
          <View key={slot}>
            <SectionTitle>
              {CATEGORY_LABELS[slot]}
              {slot === 'outer' || slot === 'accessory' ? ' (선택)' : ''}
            </SectionTitle>
            {options.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                등록된 {josa(CATEGORY_LABELS[slot], '이', '가')} 없어요
              </ThemedText>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
                {options.map((c) => {
                  const selected = draft[slot]?.id === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      testID={`pick-${slot}`}
                      accessibilityRole="button"
                      aria-selected={selected}
                      accessibilityLabel={`${CATEGORY_LABELS[slot]} 선택`}
                      onPress={() => toggle(slot, c.id)}
                      style={[
                        styles.option,
                        { borderColor: selected ? theme.accent : theme.border },
                        selected && styles.selected,
                      ]}>
                      <ClothingImage path={c.image_path} style={styles.optionImg} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        );
      })}

      <SectionTitle>스타일</SectionTitle>
      <View style={styles.pad}>
        <ChipGroup>
          {STYLES.map((s) => (
            <Chip key={s} label={STYLE_LABELS[s]} selected={styles_.includes(s)} onPress={() => toggleStyle(s)} />
          ))}
        </ChipGroup>
      </View>

      <SectionTitle>공개 범위</SectionTitle>
      <View style={styles.pad}>
        <ChipGroup>
          <Chip label="비공개" selected={visibility === 'private'} onPress={() => setVisibility('private')} />
          <Chip
            testID="visibility-public"
            label="공개 (탐색에 게시)"
            selected={visibility === 'public'}
            onPress={() => setVisibility('public')}
          />
        </ChipGroup>
      </View>

      <View style={styles.actions}>
        {date ? (
          <Button
            testID="save-wear"
            title={`${dateLabel}에 입은 코디로 기록`}
            onPress={() => save('wear')}
            loading={saving === 'wear'}
            disabled={items.length === 0}
          />
        ) : (
          <>
            <Button
              testID="save-outfit"
              title="코디 저장"
              onPress={() => save('save')}
              loading={saving === 'save'}
              disabled={items.length === 0}
            />
            <Button
              variant="secondary"
              icon="check"
              title="오늘 이거 입었어요"
              onPress={() => save('wear')}
              loading={saving === 'wear'}
              disabled={items.length === 0}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  preview: { alignItems: 'center', paddingTop: Spacing.three },
  placeholder: {
    width: 220,
    height: 220,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hList: { gap: Spacing.two, paddingHorizontal: Spacing.three },
  option: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  selected: { borderWidth: 3 },
  optionImg: { width: 76, height: 76 },
  pad: { paddingHorizontal: Spacing.three },
  actions: { padding: Spacing.three, gap: Spacing.two, marginTop: Spacing.two },
});
