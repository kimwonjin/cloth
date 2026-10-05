import { Pressable, StyleSheet, View } from 'react-native';

import { ClothingImage } from '@/components/closet/clothing-image';
import { Icon } from '@/components/ui/icon';
import type { Category, Clothing, OutfitDraft } from '@/domain/types';
import { CATEGORY_LABELS } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

type Item = { slot: Category; clothing: Clothing };

/** Row layout, top to bottom: (outer + top), bottom, (shoes + accessory). */
function rows(items: Item[]): { cells: Item[]; scale: number }[] {
  const get = (s: Category) => items.filter((i) => i.slot === s);
  const result: { cells: Item[]; scale: number }[] = [];
  const upper = [...get('outer'), ...get('top')];
  if (upper.length) result.push({ cells: upper, scale: upper.length > 1 ? 0.5 : 0.62 });
  const lower = get('bottom');
  if (lower.length) result.push({ cells: lower, scale: 0.62 });
  const feet = [...get('shoes'), ...get('accessory')];
  if (feet.length) result.push({ cells: feet, scale: feet.length > 1 ? 0.36 : 0.4 });
  return result;
}

export function draftToItems(draft: OutfitDraft): Item[] {
  return (Object.keys(draft) as Category[])
    .filter((slot) => draft[slot])
    .map((slot) => ({ slot, clothing: draft[slot]! }));
}

/** Height of the collage for a given width — used by the masonry grid. */
export function collageHeight(items: Item[], width: number) {
  const r = rows(items);
  return r.reduce((h, row) => h + row.scale * width, 0) + 16;
}

/**
 * Musinsa-style outfit card: background-removed clothing photos stacked on
 * white. With `onPressItem`, each item shows a swap badge.
 */
export function OutfitCollage({
  items,
  width,
  onPressItem,
  testID,
}: {
  items: Item[];
  width: number;
  onPressItem?: (slot: Category) => void;
  testID?: string;
}) {
  const theme = useTheme();
  const layout = rows(items);
  return (
    <View
      testID={testID}
      style={[styles.card, { width, height: collageHeight(items, width), backgroundColor: theme.board }]}>
      {layout.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.cells.map((cell) => {
            const size = row.scale * width;
            const image = (
              <ClothingImage
                path={cell.clothing.image_path}
                style={{ width: size, height: size }}
                testID={`collage-${cell.slot}`}
              />
            );
            if (!onPressItem) return <View key={cell.clothing.id}>{image}</View>;
            return (
              <Pressable
                key={cell.clothing.id}
                accessibilityRole="button"
                accessibilityLabel={`${CATEGORY_LABELS[cell.slot]} 바꾸기`}
                onPress={() => onPressItem(cell.slot)}
                style={({ pressed }) => pressed && { opacity: 0.6 }}>
                {image}
                <View style={styles.badge}>
                  <Icon name="swap" size={14} color="#111113" />
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 8,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: 4,
    top: 4,
    backgroundColor: '#ffffffdd',
    borderRadius: 12,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d4d4d8',
  },
});
