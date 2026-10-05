import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ClothingImage } from '@/components/closet/clothing-image';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import type { Clothing } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

const GAP = 2;
const PAD = Spacing.one;

/** Instagram-profile-style 3-column grid of clothing cards. */
export function ClothingGrid({
  clothes,
  onPress,
  selectedIds,
  columns = 3,
}: {
  clothes: Clothing[];
  onPress: (c: Clothing) => void;
  selectedIds?: Set<string>;
  columns?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const inner = width - PAD * 2;
  const size = width > 0 ? Math.floor((inner - GAP * (columns - 1)) / columns) : 0;
  return (
    <View
      style={styles.grid}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {size > 0 &&
        clothes.map((c) => {
          const selected = selectedIds?.has(c.id);
          return (
            <Pressable
              key={c.id}
              testID="clothing-cell"
              accessibilityRole="button"
              accessibilityLabel="옷 보기"
              aria-selected={!!selected}
              onPress={() => onPress(c)}
              style={({ pressed }) => [
                { width: size, height: size, borderColor: theme.border, backgroundColor: theme.board },
                styles.cell,
                pressed && { opacity: 0.7 },
                selected && { borderColor: theme.accent, borderWidth: 3 },
              ]}>
              <ClothingImage path={c.image_path} style={{ width: '100%', height: '100%' }} />
              {selected && (
                <View style={[styles.check, { backgroundColor: theme.accent }]}>
                  <Icon name="check" size={14} color={theme.onAccent} />
                </View>
              )}
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: PAD },
  cell: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  check: { position: 'absolute', top: 6, right: 6, borderRadius: 10, padding: 2 },
});
