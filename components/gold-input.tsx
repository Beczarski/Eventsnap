import { View, TextInput, Text, type ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';
import { Ionicons } from '@expo/vector-icons';

interface GoldInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  multiline?: boolean;
  style?: ViewStyle;
  editable?: boolean;
}

export function GoldInput({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType = 'default',
  multiline = false,
  style,
  editable = true,
}: GoldInputProps) {
  return (
    <View style={[{ gap: Spacing.xs }, style]}>
      {label && (
        <Text
          style={{
            fontFamily: Fonts.medium,
            fontSize: 12,
            color: Colors.textSecondary,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            marginLeft: Spacing.xs,
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: Colors.surface,
          borderRadius: Radius.md,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: Colors.border,
          paddingHorizontal: Spacing.lg,
          minHeight: multiline ? 80 : 52,
        }}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={Colors.primary}
            style={{ marginRight: Spacing.md }}
          />
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          editable={editable}
          style={{
            flex: 1,
            fontFamily: Fonts.regular,
            fontSize: 15,
            color: Colors.text,
            paddingVertical: Spacing.md,
          }}
        />
      </View>
    </View>
  );
}
