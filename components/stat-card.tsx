import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color?: string;
}

export function StatCard({
  icon,
  label,
  value,
  color = Colors.primary,
}: StatCardProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        borderCurve: 'continuous',
        padding: Spacing.lg,
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: `${color}15`,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text
        selectable
        style={{
          fontFamily: Fonts.bold,
          fontSize: 22,
          color: Colors.text,
          fontVariant: ['tabular-nums'],
        }}
      >
        {typeof value === 'number' && value >= 1000
          ? `${(value / 1000).toFixed(1)}k`
          : value}
      </Text>
      <Text
        style={{
          fontFamily: Fonts.medium,
          fontSize: 11,
          color: Colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
