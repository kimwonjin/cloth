import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useTheme } from '@/hooks/use-theme';

type Names = { ios: SymbolViewProps['name'] & string; material: string };

/** Icon names: SF Symbols on iOS, Material Symbols on Android / web. */
export const ICONS = {
  home: { ios: 'house', material: 'home' },
  explore: { ios: 'square.grid.2x2', material: 'explore' },
  add: { ios: 'plus.app', material: 'add_box' },
  calendar: { ios: 'calendar', material: 'calendar_month' },
  closet: { ios: 'hanger', material: 'checkroom' },
  refresh: { ios: 'arrow.clockwise', material: 'refresh' },
  swap: { ios: 'arrow.left.arrow.right', material: 'swap_horiz' },
  heart: { ios: 'heart', material: 'favorite_border' },
  heartFill: { ios: 'heart.fill', material: 'favorite' },
  bookmark: { ios: 'bookmark', material: 'bookmark_border' },
  bookmarkFill: { ios: 'bookmark.fill', material: 'bookmark' },
  close: { ios: 'xmark', material: 'close' },
  camera: { ios: 'camera', material: 'photo_camera' },
  photo: { ios: 'photo', material: 'image' },
  trash: { ios: 'trash', material: 'delete' },
  check: { ios: 'checkmark', material: 'check' },
  public: { ios: 'globe', material: 'public' },
  lock: { ios: 'lock', material: 'lock' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', material: 'logout' },
  left: { ios: 'chevron.left', material: 'chevron_left' },
  right: { ios: 'chevron.right', material: 'chevron_right' },
  sparkles: { ios: 'sparkles', material: 'auto_awesome' },
  plus: { ios: 'plus', material: 'add' },
  edit: { ios: 'pencil', material: 'edit' },
} satisfies Record<string, Names>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const theme = useTheme();
  const n = ICONS[name];
  return (
    <SymbolView
      name={{ ios: n.ios, android: n.material, web: n.material } as SymbolViewProps['name']}
      size={size}
      tintColor={color ?? theme.text}
    />
  );
}
