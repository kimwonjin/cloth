import { Alert, Platform } from 'react-native';

/** Cross-platform confirm (RN's Alert is a no-op on web). */
export function confirm(title: string, message?: string, okLabel = '확인'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
    ])
  );
}
