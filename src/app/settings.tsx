import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useToast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { formatPhone } from '@/domain/phone';
import { useTheme } from '@/hooks/use-theme';
import { getMyProfile, updateNickname } from '@/lib/api';
import { signOut, useAuth } from '@/lib/auth';
import { confirm } from '@/lib/dialog';

export default function SettingsScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAuth();
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const phone = (session?.user.user_metadata?.phone as string | undefined) ?? '';

  useEffect(() => {
    getMyProfile()
      .then((p) => setNickname(p.nickname))
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await updateNickname(nickname);
      toast('닉네임을 저장했어요');
    } catch (e) {
      toast(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    if (await confirm('로그아웃할까요?', undefined, '로그아웃')) await signOut();
  };

  return (
    <Screen edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.field}>
          <ThemedText type="smallBold">닉네임</ThemedText>
          <TextInput
            testID="nickname-input"
            value={nickname}
            onChangeText={setNickname}
            placeholder="탐색 탭에 보이는 이름"
            placeholderTextColor={theme.textSecondary}
            maxLength={20}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <Button testID="save-nickname" title="저장" onPress={save} loading={saving} />
        </View>
        <View style={styles.field}>
          <ThemedText type="smallBold">휴대폰 번호</ThemedText>
          <ThemedText themeColor="textSecondary">{formatPhone(phone) || '-'}</ThemedText>
        </View>
        <Button testID="logout" variant="secondary" icon="logout" title="로그아웃" onPress={logout} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.four },
  field: { gap: Spacing.two },
  input: { height: 48, borderRadius: 12, paddingHorizontal: Spacing.three, fontSize: 16 },
});
