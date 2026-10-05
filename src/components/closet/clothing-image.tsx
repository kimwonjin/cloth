import { Image } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

import { clothingImageUrl } from '@/lib/api';

export function ClothingImage({
  path,
  style,
  testID,
}: {
  path: string;
  style?: StyleProp<ImageStyle>;
  testID?: string;
}) {
  return (
    <Image
      testID={testID}
      source={{ uri: clothingImageUrl(path) }}
      style={style}
      contentFit="contain"
      transition={150}
      recyclingKey={path}
    />
  );
}
