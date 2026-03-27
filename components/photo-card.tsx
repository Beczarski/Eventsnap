import { Pressable, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Radius, Spacing } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';
import { Ionicons } from '@expo/vector-icons';
import type { PhotoRow } from '@/lib/database';

interface PhotoCardProps {
  photo: PhotoRow;
  onPress: () => void;
  size?: number;
}

export function PhotoCard({ photo, onPress, size = 160 }: PhotoCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size * 1.2,
        borderRadius: Radius.md,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Image
        source={{ uri: photo.original_url }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        transition={300}
      />
      {/* Status badges */}
      <View
        style={{
          position: 'absolute',
          bottom: Spacing.sm,
          left: Spacing.sm,
          right: Spacing.sm,
          flexDirection: 'row',
          gap: Spacing.xs,
        }}
      >
        {photo.is_printed && (
          <View
            style={{
              backgroundColor: Colors.overlay,
              borderRadius: Radius.sm,
              borderCurve: 'continuous',
              paddingHorizontal: 6,
              paddingVertical: 3,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Ionicons name="print" size={10} color={Colors.primary} />
            <Text
              style={{
                fontFamily: Fonts.medium,
                fontSize: 9,
                color: Colors.primary,
              }}
            >
              {photo.print_count}
            </Text>
          </View>
        )}
        {photo.is_shared && (
          <View
            style={{
              backgroundColor: Colors.overlay,
              borderRadius: Radius.sm,
              borderCurve: 'continuous',
              paddingHorizontal: 6,
              paddingVertical: 3,
            }}
          >
            <Ionicons name="share" size={10} color={Colors.accent} />
          </View>
        )}
      </View>
    </Pressable>
  );
}
