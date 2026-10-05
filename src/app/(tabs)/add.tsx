import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Header, Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function Option({
  icon,
  title,
  description,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
  testID: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.background }]}>
        <Icon name={icon} size={28} />
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.optionTitle}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
      <Icon name="right" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

export default function AddScreen() {
  return (
    <Screen>
      <Header title="등록" />
      <View style={styles.list}>
        <Option
          testID="add-clothing"
          icon="camera"
          title="옷 등록"
          description="사진 한 장이면 배경을 지우고 색을 자동으로 알려줘요"
          onPress={() => router.push('/clothing/new')}
        />
        <Option
          testID="add-outfit"
          icon="closet"
          title="코디 직접 만들기"
          description="내 옷장에서 골라 코디를 만들고 저장하거나 게시해요"
          onPress={() => router.push('/outfit/new')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.three },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 20,
  },
  iconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontWeight: '700', fontSize: 17 },
  flex: { flex: 1, gap: 2 },
});
