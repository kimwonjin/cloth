import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { OutfitMasonry } from '@/components/closet/masonry';
import { OutfitCollage } from '@/components/closet/outfit-collage';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen, SectionTitle } from '@/components/ui/screen';
import { EmptyState, ErrorState, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { daysBetween, parseDateKey } from '@/domain/dates';
import {
  deleteWearLog,
  getWearLog,
  listMySavedOutfits,
  ootdPhotoUrl,
  recordWear,
  setWearPhoto,
} from '@/lib/api';
import { confirm } from '@/lib/dialog';
import { processOotdPhoto } from '@/lib/image-processing';
import { useQuery } from '@/lib/use-query';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function OotdDayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const day = parseDateKey(date);
  const isFuture = daysBetween(new Date(), day) > 0;
  const title = `${day.getMonth() + 1}월 ${day.getDate()}일 (${WEEKDAYS[day.getDay()]})`;

  const { data, error, loading, reload } = useQuery(async () => {
    const log = await getWearLog(date);
    const photoUrl = log?.photo_path ? await ootdPhotoUrl(log.photo_path) : null;
    const saved = log?.outfit ? [] : await listMySavedOutfits();
    return { log, photoUrl, saved };
  }, [date]);
  const [busy, setBusy] = useState<string | null>(null);

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

  const addPhoto = () =>
    run('photo', async () => {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled || !result.assets[0]) return;
      const image = await processOotdPhoto(result.assets[0].uri);
      await setWearPhoto(date, image);
      toast('사진을 남겼어요');
      reload();
    });

  const pickSaved = (outfitId: string) =>
    run('pick', async () => {
      await recordWear(date, outfitId);
      toast('기록했어요');
      reload();
    });

  const remove = () =>
    run('delete', async () => {
      if (!data?.log) return;
      const ok = await confirm('이 날 기록을 삭제할까요?', undefined, '삭제');
      if (!ok) return;
      await deleteWearLog(data.log);
      toast('삭제했어요');
      reload();
    });

  const collageWidth = Math.min(Math.min(width, MaxContentWidth) - Spacing.five * 2, 360);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title }} />
      {!data && loading && <Loading />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}

      {data && isFuture && (
        <EmptyState icon="calendar" title="아직 오지 않은 날이에요" description="당일이 되면 기록할 수 있어요." />
      )}

      {data && !isFuture && (
        <>
          {data.log?.outfit ? (
            <View style={styles.center}>
              <OutfitCollage testID="ootd-collage" items={data.log.outfit.items} width={collageWidth} />
            </View>
          ) : (
            <EmptyState
              icon="calendar"
              title={data.log ? '사진만 남긴 날이에요' : '이 날 기록이 없어요'}
              description="입은 코디를 골라 기록해보세요."
            />
          )}

          {data.photoUrl && (
            <View style={styles.center}>
              <Image
                testID="ootd-photo"
                source={{ uri: data.photoUrl }}
                style={{ width: collageWidth, height: collageWidth * 1.25, borderRadius: 16 }}
                contentFit="cover"
              />
            </View>
          )}

          <View style={styles.actions}>
            <Button
              testID="ootd-pick-items"
              icon="closet"
              title={data.log?.outfit ? '다른 코디로 바꾸기' : '옷 골라서 기록하기'}
              onPress={() => router.push(`/outfit/new?date=${date}`)}
            />
            <Button
              testID="ootd-add-photo"
              variant="secondary"
              icon="camera"
              title={data.photoUrl ? '사진 바꾸기' : '거울 셀카 남기기 (선택)'}
              onPress={addPhoto}
              loading={busy === 'photo'}
            />
            {data.log && (
              <Button variant="danger" icon="trash" title="기록 삭제" onPress={remove} loading={busy === 'delete'} />
            )}
          </View>

          {!data.log?.outfit && data.saved.length > 0 && (
            <>
              <SectionTitle>저장한 코디에서 고르기</SectionTitle>
              <ThemedText type="small" themeColor="textSecondary" style={styles.pad}>
                누르면 이 날 입은 코디로 기록돼요
              </ThemedText>
              <View style={{ marginTop: Spacing.two }}>
                <OutfitMasonry outfits={data.saved} showMeta={false} onPress={(o) => pickSaved(o.id)} />
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingTop: Spacing.three },
  actions: { padding: Spacing.three, gap: Spacing.two },
  pad: { paddingHorizontal: Spacing.three },
});
