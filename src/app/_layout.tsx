import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme, View } from 'react-native';

import { Loading } from '@/components/ui/states';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider, useAuth } from '@/lib/auth';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <ToastProvider>
          <RootStack />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Loading />
      </View>
    );
  }
  const signedIn = !!session;
  return (
    <Stack screenOptions={{ headerBackTitle: '뒤로', headerShadowVisible: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '나의 옷장' }} />
        <Stack.Screen name="clothing/new" options={{ title: '옷 등록' }} />
        <Stack.Screen name="clothing/[id]" options={{ title: '옷 정보' }} />
        <Stack.Screen name="outfit/new" options={{ title: '코디 만들기' }} />
        <Stack.Screen name="outfit/[id]" options={{ title: '코디' }} />
        <Stack.Screen name="ootd/[date]" options={{ title: 'OOTD' }} />
        <Stack.Screen name="settings" options={{ title: '설정' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false, title: '로그인' }} />
      </Stack.Protected>
    </Stack>
  );
}
