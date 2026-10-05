import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        {error.message}
      </ThemedText>
      {onRetry && <Button small variant="secondary" title="다시 시도" onPress={onRetry} />}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description?: string;
  action?: { title: string; onPress: () => void };
}) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Icon name={icon} size={40} color={theme.textSecondary} />
      <ThemedText style={styles.title}>{title}</ThemedText>
      {description && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
          {description}
        </ThemedText>
      )}
      {action && <Button small title={action.title} onPress={action.onPress} style={{ marginTop: 8 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.five, gap: Spacing.two },
  title: { fontWeight: '700', textAlign: 'center' },
  text: { textAlign: 'center' },
});
