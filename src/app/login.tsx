import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { formatPhone, isValidKoreanMobile } from '@/domain/phone';
import { useTheme } from '@/hooks/use-theme';
import { signInWithPhone } from '@/lib/auth';

export default function LoginScreen() {
  const theme = useTheme();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = isValidKoreanMobile(phone);

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithPhone(phone);
      // The auth listener swaps the stack to the tabs.
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인에 실패했어요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.brand}>
            <Icon name="closet" size={48} />
            <ThemedText style={styles.title}>나의 옷장</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              옷을 찍어두면 AI가 내 옷으로 코디를 만들어줘요
            </ThemedText>
          </View>

          <View style={styles.form}>
            <ThemedText type="smallBold">휴대폰 번호</ThemedText>
            <TextInput
              testID="phone-input"
              value={formatPhone(phone)}
              onChangeText={setPhone}
              onSubmitEditing={submit}
              placeholder="010-1234-5678"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={13}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.backgroundElement },
              ]}
            />
            {error && (
              <ThemedText type="small" style={{ color: theme.danger }} testID="login-error">
                {error}
              </ThemedText>
            )}
            <Button
              testID="login-button"
              title="시작하기"
              onPress={submit}
              disabled={!valid}
              loading={loading}
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              처음이면 자동으로 가입돼요. 휴대폰 인증은 곧 추가될 예정이에요.
            </ThemedText>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.five,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  brand: { alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  center: { textAlign: 'center' },
  form: { gap: Spacing.two + 4 },
  input: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    fontSize: 18,
    letterSpacing: 1,
  },
});
