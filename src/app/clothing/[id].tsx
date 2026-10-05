import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ClothingForm, type ClothingFormValue } from '@/components/closet/clothing-form';
import { ClothingImage } from '@/components/closet/clothing-image';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { ErrorState, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { wearStats } from '@/domain/stats';
import { useTheme } from '@/hooks/use-theme';
import { deleteClothing, getClothing, listWearEntries, updateClothing } from '@/lib/api';
import { confirm } from '@/lib/dialog';
import { useQuery } from '@/lib/use-query';

export default function ClothingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const toast = useToast();
  const [form, setForm] = useState<ClothingFormValue | null>(null);
  const [saving, setSaving] = useState(false);
  const { data, error, loading, reload } = useQuery(async () => {
    const [c, entries] = await Promise.all([getClothing(id), listWearEntries()]);
    // Fill the form once; later reloads (after saving) keep the user's edits.
    setForm(
      (f) =>
        f ?? { category: c.category, color: c.color, seasons: c.seasons, brand: c.brand ?? '', size: c.size ?? '' }
    );
    return { clothing: c, stat: wearStats([c], entries)[0] };
  }, [id]);

  if (!data) {
    return (
      <Screen edges={['bottom']}>
        {loading ? <Loading /> : error && <ErrorState error={error} onRetry={reload} />}
      </Screen>
    );
  }

  const { clothing, stat } = data;
  const save = async () => {
    if (!form?.category) return;
    setSaving(true);
    try {
      await updateClothing(clothing.id, {
        category: form.category,
        color: form.color,
        seasons: form.seasons,
        brand: form.brand.trim() || null,
        size: form.size.trim() || null,
      });
      toast('저장했어요');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm('이 옷을 삭제할까요?', '이 옷이 들어간 코디에서도 빠져요.', '삭제');
    if (!ok) return;
    try {
      await deleteClothing(clothing);
      toast('삭제했어요');
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : '삭제하지 못했어요.');
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.center}>
          <ClothingImage path={clothing.image_path} style={styles.image} />
        </View>
        <View style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold" testID="clothing-wear-count">
            {stat.count}번 입었어요
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {stat.lastWorn
              ? `마지막: ${stat.lastWorn.getMonth() + 1}월 ${stat.lastWorn.getDate()}일`
              : '아직 기록 없음'}
          </ThemedText>
        </View>
        {form && <ClothingForm value={form} onChange={setForm} />}
        <Button title="저장" onPress={save} loading={saving} disabled={!form?.category || !form.seasons.length} />
        <Button variant="danger" icon="trash" title="삭제" onPress={remove} testID="delete-clothing" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three },
  center: { alignItems: 'center' },
  image: { width: 260, height: 260, borderRadius: 16 },
  stat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 14,
  },
});
