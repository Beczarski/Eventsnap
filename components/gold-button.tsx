import { Pressable, Text, ActivityIndicator, type ViewStyle, type TextStyle } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';

interface GoldButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function GoldButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  icon,
  style,
}: GoldButtonProps) {
  const heights = { sm: 44, md: 52, lg: 64 };
  const fontSizes = { sm: 13, md: 15, lg: 17 };

  const baseStyle: ViewStyle = {
    height: heights[size],
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    opacity: disabled ? 0.5 : 1,
  };

  const variantStyles: Record<string, ViewStyle> = {
    primary: {
      backgroundColor: Colors.primary,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: Colors.primary,
    },
    ghost: {
      backgroundColor: 'rgba(200, 169, 110, 0.1)',
    },
  };

  const textStyles: Record<string, TextStyle> = {
    primary: { color: Colors.background },
    outline: { color: Colors.primary },
    ghost: { color: Colors.primary },
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        baseStyle,
        variantStyles[variant],
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? Colors.background : Colors.primary}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: fontSizes[size],
              color: textStyles[variant].color,
              letterSpacing: 0.5,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
