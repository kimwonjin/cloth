import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Chip({
  label,
  selected,
  onPress,
  swatch,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  swatch?: string;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      aria-selected={!!selected}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.backgroundElement,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {swatch && <View style={[styles.swatch, { backgroundColor: swatch, borderColor: theme.border }]} />}
      <ThemedText type="small" style={{ color: selected ? theme.onAccent : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Horizontally scrolling single-select chip row with an "전체" option. */
export function ChipFilter<T extends string>({
  options,
  value,
  onChange,
  allLabel = '전체',
  swatches,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  allLabel?: string;
  swatches?: Partial<Record<T, string>>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip label={allLabel} selected={value === null} onPress={() => onChange(null)} />
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          swatch={swatches?.[o.value]}
          selected={value === o.value}
          onPress={() => onChange(value === o.value ? null : o.value)}
        />
      ))}
    </ScrollView>
  );
}

export function ChipGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three - 4,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
  },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  row: { gap: Spacing.two, paddingHorizontal: Spacing.three },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
