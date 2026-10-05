import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: '홈', icon: 'home' },
  { name: 'explore', title: '탐색', icon: 'explore' },
  { name: 'add', title: '등록', icon: 'add' },
  { name: 'calendar', title: '캘린더', icon: 'calendar' },
  { name: 'closet', title: '내 옷장', icon: 'closet' },
];

export default function TabLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border, height: 60 },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, size }) => <Icon name={t.icon} size={size ?? 24} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
