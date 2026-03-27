import { View, Text, ActivityIndicator } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingOverlay({
  message = 'Loading...',
  fullScreen = false,
}: LoadingOverlayProps) {
  if (fullScreen) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          justifyContent: 'center',
          alignItems: 'center',
          gap: Spacing.lg,
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text
          style={{
            fontFamily: Fonts.medium,
            fontSize: 15,
            color: Colors.textSecondary,
          }}
        >
          {message}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 10, 15, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
      }}
    >
      <View
        style={{
          backgroundColor: Colors.surface,
          borderRadius: Radius.lg,
          borderCurve: 'continuous',
          padding: Spacing.xxl,
          alignItems: 'center',
          gap: Spacing.lg,
          borderWidth: 1,
          borderColor: Colors.borderGold,
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text
          style={{
            fontFamily: Fonts.medium,
            fontSize: 14,
            color: Colors.text,
          }}
        >
          {message}
        </Text>
      </View>
    </View>
  );
}
