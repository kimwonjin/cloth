/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#111113',
    background: '#ffffff',
    backgroundElement: '#F2F2F4',
    backgroundSelected: '#E2E3E7',
    textSecondary: '#6B6F76',
    border: '#E4E4E8',
    accent: '#111113',
    onAccent: '#ffffff',
    danger: '#D93636',
    like: '#E5484D',
    card: '#ffffff',
    board: '#F3F3F5',
  },
  dark: {
    text: '#F4F4F5',
    background: '#0B0B0C',
    backgroundElement: '#1C1C1F',
    backgroundSelected: '#2A2A2E',
    textSecondary: '#A1A1A8',
    border: '#2A2A2E',
    accent: '#F4F4F5',
    onAccent: '#111113',
    danger: '#FF6369',
    like: '#FF6369',
    card: '#ffffff',
    board: '#E9E9EC',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 640;
