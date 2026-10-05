import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { collageHeight, OutfitCollage } from '@/components/closet/outfit-collage';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import type { Outfit } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

const GAP = Spacing.two;
const PAD = Spacing.three;

/** Pinterest-style two-column grid; each outfit goes to the shorter column. */
export function OutfitMasonry({
  outfits,
  onPress,
  showMeta = true,
}: {
  outfits: Outfit[];
  onPress: (o: Outfit) => void;
  showMeta?: boolean;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const colWidth = width > 0 ? Math.floor((width - PAD * 2 - GAP) / 2) : 0;

  const columns: Outfit[][] = [[], []];
  const heights = [0, 0];
  for (const o of outfits) {
    const col = heights[0] <= heights[1] ? 0 : 1;
    columns[col].push(o);
    heights[col] += collageHeight(o.items, colWidth || 160) + (showMeta ? 28 : 0) + GAP;
  }

  return (
    <View
      style={styles.container}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {colWidth > 0 &&
        columns.map((col, i) => (
          <View key={i} style={{ width: colWidth, gap: GAP }}>
            {col.map((o) => (
              <Pressable
                key={o.id}
                testID="outfit-card"
                accessibilityRole="button"
                accessibilityLabel="코디 보기"
                onPress={() => onPress(o)}
                style={({ pressed }) => [
                  styles.card,
                  { borderColor: theme.border },
                  pressed && { opacity: 0.8 },
                ]}>
                <OutfitCollage items={o.items} width={colWidth - 2} />
                {showMeta && (
                  <View style={styles.meta}>
                    <ThemedText type="small" numberOfLines={1} style={styles.nick}>
                      {o.profile?.nickname || '익명'}
                    </ThemedText>
                    <View style={styles.likes}>
                      <Icon name="heart" size={13} color={theme.textSecondary} />
                      <ThemedText type="small" themeColor="textSecondary">
                        {o.like_count}
                      </ThemedText>
                    </View>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: GAP, paddingHorizontal: PAD, minHeight: 10 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    height: 28,
  },
  nick: { flex: 1, fontSize: 12 },
  likes: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
