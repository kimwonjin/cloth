import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ClothingForm, type ClothingFormValue } from '@/components/closet/clothing-form';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { useToast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { SEASONS, type Category } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { createClothing } from '@/lib/api';
import { processClothingPhoto } from '@/lib/image-processing';
import type { ProcessedClothingPhoto } from '@/lib/image-types';

const EMPTY: ClothingFormValue = { category: null, color: 'etc', seasons: [...SEASONS], brand: '', size: '' };

export default function NewClothingScreen() {
  const theme = useTheme();
  const toast = useToast();
  const [photo, setPhoto] = useState<ProcessedClothingPhoto | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ClothingFormValue>(EMPTY);
  const [suggested, setSuggested] = useState<{ category?: Category; color?: string }>({});
  const [count, setCount] = useState(0);

  const pick = async (source: 'camera' | 'library') => {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        toast('카메라 권한이 필요해요.');
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;

    setProcessing(true);
    try {
      const processed = await processClothingPhoto(result.assets[0].uri);
      setPhoto(processed);
      const a = processed.analysis;
      if (a) {
        setSuggested({ category: a.categoryGuess, color: a.colorKey });
        setForm((f) => ({ ...f, category: f.category ?? a.categoryGuess, color: a.colorKey }));
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '사진을 처리하지 못했어요.');
    } finally {
      setProcessing(false);
    }
  };

  const save = async () => {
    if (!photo || !form.category) return;
    setSaving(true);
    try {
      await createClothing(photo.image, {
        category: form.category,
        color: form.color,
        seasons: form.seasons,
        brand: form.brand.trim() || null,
        size: form.size.trim() || null,
      });
      setCount((n) => n + 1);
      toast('옷장에 등록했어요');
      setPhoto(null);
      setForm(EMPTY);
      setSuggested({});
    } catch (e) {
      toast(e instanceof Error ? e.message : '등록하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={styles.container}>
        {!photo && !processing && (
          <>
            <View style={[styles.guide, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="camera" size={36} />
              <ThemedText style={styles.guideTitle}>이렇게 찍으면 깔끔해요</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                · 바닥이나 벽처럼 단색 배경 위에 옷을 펼쳐 두세요{'\n'}· 옷 전체가 화면 안에 들어오게
                찍어주세요{'\n'}· 밝은 곳에서 흔들리지 않게 찍어주세요
              </ThemedText>
            </View>
            <Button testID="pick-camera" icon="camera" title="카메라로 찍기" onPress={() => pick('camera')} />
            <Button
              testID="pick-library"
              variant="secondary"
              icon="photo"
              title="앨범에서 선택"
              onPress={() => pick('library')}
            />
            {count > 0 && (
              <Button variant="ghost" title={`${count}벌 등록 완료 · 옷장 보기`} onPress={() => router.replace('/closet')} />
            )}
          </>
        )}

        {processing && (
          <View style={styles.processing}>
            <ActivityIndicator />
            <ThemedText type="small" themeColor="textSecondary">
              배경을 지우고 색을 분석하는 중…
            </ThemedText>
          </View>
        )}

        {photo && (
          <>
            <View style={styles.previewWrap}>
              <Image
                testID="clothing-preview"
                source={{ uri: photo.image.previewUri }}
                style={styles.preview}
                contentFit="contain"
              />
            </View>
            {photo.warnings.length > 0 && (
              <View style={[styles.warning, { borderColor: theme.danger }]} testID="photo-warnings">
                {photo.warnings.map((w) => (
                  <ThemedText key={w} type="small">
                    {w}
                  </ThemedText>
                ))}
                <Button small variant="secondary" icon="camera" title="다시 찍기" onPress={() => setPhoto(null)} />
              </View>
            )}
            <ClothingForm value={form} onChange={setForm} suggested={suggested} />
            <Button
              testID="save-clothing"
              title="옷장에 등록"
              onPress={save}
              loading={saving}
              disabled={!form.category || form.seasons.length === 0}
            />
            <Button variant="ghost" title="다른 사진 고르기" onPress={() => setPhoto(null)} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three },
  guide: { alignItems: 'center', padding: Spacing.four, borderRadius: 20, gap: Spacing.two },
  guideTitle: { fontWeight: '700' },
  center: { textAlign: 'center', lineHeight: 22 },
  processing: { alignItems: 'center', padding: Spacing.six, gap: Spacing.two },
  previewWrap: { alignItems: 'center' },
  preview: { width: 260, height: 260, borderRadius: 16, backgroundColor: '#ffffff' },
  warning: { borderWidth: 1, borderRadius: 14, padding: Spacing.three, gap: Spacing.one + 2 },
});
