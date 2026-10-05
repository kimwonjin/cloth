import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  small,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const bg =
    variant === 'primary' ? theme.accent : variant === 'secondary' ? theme.backgroundElement : 'transparent';
  const fg =
    variant === 'primary' ? theme.onAccent : variant === 'danger' ? theme.danger : theme.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      aria-disabled={!!inactive}
      aria-busy={!!loading}
      disabled={!!inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        { backgroundColor: bg, opacity: inactive ? 0.5 : pressed ? 0.75 : 1 },
        variant === 'danger' && { borderWidth: 1, borderColor: theme.danger },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={small ? 16 : 18} color={fg} />}
          <ThemedText type={small ? 'small' : 'default'} style={{ color: fg, fontWeight: '700' }}>
            {title}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  color,
  size = 22,
  label,
  testID,
}: {
  name: IconName;
  onPress?: () => void;
  color?: string;
  size?: number;
  label: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { minHeight: 36, borderRadius: 10, paddingHorizontal: Spacing.two + 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  iconButton: { padding: Spacing.one },
});
