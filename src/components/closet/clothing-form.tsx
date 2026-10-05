import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip, ChipGroup } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import { COLORS } from '@/domain/colors';
import { CATEGORIES, CATEGORY_LABELS, SEASON_LABELS, SEASONS, type Category, type Season } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export interface ClothingFormValue {
  category: Category | null;
  color: string;
  seasons: Season[];
  brand: string;
  size: string;
}

export function ClothingForm({
  value,
  onChange,
  suggested,
}: {
  value: ClothingFormValue;
  onChange: (v: ClothingFormValue) => void;
  /** Auto-detected values, marked "자동" next to the label. */
  suggested?: { category?: Category; color?: string };
}) {
  const theme = useTheme();
  const set = (patch: Partial<ClothingFormValue>) => onChange({ ...value, ...patch });
  const toggleSeason = (s: Season) =>
    set({
      seasons: value.seasons.includes(s) ? value.seasons.filter((x) => x !== s) : [...value.seasons, s],
    });
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  return (
    <View style={styles.form}>
      <Field label="종류" auto={suggested?.category !== undefined}>
        <ChipGroup>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              testID={`category-${c}`}
              label={CATEGORY_LABELS[c]}
              selected={value.category === c}
              onPress={() => set({ category: c })}
            />
          ))}
        </ChipGroup>
      </Field>
      <Field label="색상" auto={suggested?.color !== undefined}>
        <ChipGroup>
          {COLORS.map((c) => (
            <Chip
              key={c.key}
              testID={`color-${c.key}`}
              label={c.label}
              swatch={c.hex}
              selected={value.color === c.key}
              onPress={() => set({ color: c.key })}
            />
          ))}
        </ChipGroup>
      </Field>
      <Field label="계절 (여러 개 선택)">
        <ChipGroup>
          {SEASONS.map((s) => (
            <Chip
              key={s}
              testID={`season-${s}`}
              label={SEASON_LABELS[s]}
              selected={value.seasons.includes(s)}
              onPress={() => toggleSeason(s)}
            />
          ))}
        </ChipGroup>
      </Field>
      <View style={styles.row}>
        <Field label="브랜드 (선택)" style={styles.flex}>
          <TextInput
            testID="brand-input"
            value={value.brand}
            onChangeText={(brand) => set({ brand })}
            placeholder="예: 유니클로"
            placeholderTextColor={theme.textSecondary}
            maxLength={40}
            style={inputStyle}
          />
        </Field>
        <Field label="사이즈 (선택)" style={styles.size}>
          <TextInput
            testID="size-input"
            value={value.size}
            onChangeText={(size) => set({ size })}
            placeholder="M, 270"
            placeholderTextColor={theme.textSecondary}
            maxLength={20}
            style={inputStyle}
          />
        </Field>
      </View>
    </View>
  );
}

function Field({
  label,
  auto,
  children,
  style,
}: {
  label: string;
  auto?: boolean;
  children: React.ReactNode;
  style?: object;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.field, style]}>
      <View style={styles.labelRow}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {auto && (
          <ThemedText type="small" style={[styles.auto, { backgroundColor: theme.backgroundElement }]}>
            자동 추천
          </ThemedText>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three + 4 },
  field: { gap: Spacing.two },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  auto: { fontSize: 11, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  size: { width: 110 },
  input: { height: 46, borderRadius: 12, paddingHorizontal: Spacing.three, fontSize: 16 },
});
