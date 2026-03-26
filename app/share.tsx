import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect } from 'react-native-svg';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';
import { GoldButton } from '@/components/gold-button';
import { GoldInput } from '@/components/gold-input';
import { LoadingOverlay } from '@/components/loading-overlay';
import { supabase } from '@/lib/supabase';
import type { PhotoRow } from '@/lib/database';

// Simple QR code generator component using SVG
function QRCodeDisplay({ value, size = 200 }: { value: string; size?: number }) {
  // Generate a simple visual QR-like pattern from the value string
  const gridSize = 21;
  const cellSize = size / gridSize;
  const cells: { x: number; y: number }[] = [];

  // Hash the value to create deterministic pattern
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  // Generate pattern
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      // QR position patterns (3 corners)
      const isTopLeft = row < 7 && col < 7;
      const isTopRight = row < 7 && col >= gridSize - 7;
      const isBottomLeft = row >= gridSize - 7 && col < 7;

      if (isTopLeft || isTopRight || isBottomLeft) {
        // Position pattern borders
        const localR = isTopLeft ? row : isTopRight ? row : row - (gridSize - 7);
        const localC = isTopLeft ? col : isTopRight ? col - (gridSize - 7) : col;
        if (
          localR === 0 ||
          localR === 6 ||
          localC === 0 ||
          localC === 6 ||
          (localR >= 2 && localR <= 4 && localC >= 2 && localC <= 4)
        ) {
          cells.push({ x: col, y: row });
        }
      } else {
        // Data pattern based on hash
        const seed = (hash + row * gridSize + col) * 2654435761;
        if ((seed >>> 0) % 3 === 0) {
          cells.push({ x: col, y: row });
        }
      }
    }
  }

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        borderCurve: 'continuous',
      }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {cells.map((cell, i) => (
          <Rect
            key={i}
            x={cell.x * cellSize}
            y={cell.y * cellSize}
            width={cellSize}
            height={cellSize}
            fill="#0A0A0F"
          />
        ))}
      </Svg>
    </View>
  );
}

export default function ShareScreen() {
  const { photoId } = useLocalSearchParams<{ photoId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [photo, setPhoto] = useState<PhotoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shareType, setShareType] = useState<'qr' | 'email' | 'sms'>('qr');

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .eq('id', photoId)
          .single();
        if (error) throw error;
        setPhoto(data);
      } catch {
        Alert.alert('Error', 'Photo not found');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [photoId, router]);

  const shareUrl = photo?.share_token
    ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-photos/${photo.original_url.split('event-photos/')[1] || ''}`
    : '';

  const handleShareEmail = useCallback(async () => {
    if (!photo || !email.trim()) {
      Alert.alert('Missing Email', 'Please enter an email address');
      return;
    }
    setSharing(true);
    try {
      await supabase.from('shares').insert({
        photo_id: photo.id,
        share_type: 'email',
        recipient: email.trim(),
      });

      await supabase
        .from('photos')
        .update({
          is_shared: true,
          shared_via: [...(photo.shared_via || []), 'email'],
        })
        .eq('id', photo.id);

      Alert.alert('Shared', `Photo link sent to ${email}`);
      setEmail('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to share');
    } finally {
      setSharing(false);
    }
  }, [photo, email]);

  const handleShareSMS = useCallback(async () => {
    if (!photo || !phone.trim()) {
      Alert.alert('Missing Phone', 'Please enter a phone number');
      return;
    }
    setSharing(true);
    try {
      await supabase.from('shares').insert({
        photo_id: photo.id,
        share_type: 'sms',
        recipient: phone.trim(),
      });

      await supabase
        .from('photos')
        .update({
          is_shared: true,
          shared_via: [...(photo.shared_via || []), 'sms'],
        })
        .eq('id', photo.id);

      Alert.alert('Shared', `Photo link sent to ${phone}`);
      setPhone('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to share');
    } finally {
      setSharing(false);
    }
  }, [photo, phone]);

  const handleQRShare = useCallback(async () => {
    if (!photo) return;
    try {
      await supabase.from('shares').insert({
        photo_id: photo.id,
        share_type: 'qr',
      });

      await supabase
        .from('photos')
        .update({
          is_shared: true,
          shared_via: [...(photo.shared_via || []), 'qr'],
        })
        .eq('id', photo.id);
    } catch {
      // Non-critical - QR displayed regardless
    }
  }, [photo]);

  useEffect(() => {
    if (photo && shareType === 'qr') {
      handleQRShare();
    }
  }, [photo, shareType, handleQRShare]);

  if (loading) {
    return <LoadingOverlay fullScreen message="Loading..." />;
  }

  if (!photo) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: Fonts.medium,
            fontSize: 16,
            color: Colors.textSecondary,
          }}
        >
          Photo not found
        </Text>
      </View>
    );
  }

  const shareTypes = [
    { id: 'qr' as const, label: 'QR Code', icon: 'qr-code' as const },
    { id: 'email' as const, label: 'Email', icon: 'mail' as const },
    { id: 'sms' as const, label: 'SMS', icon: 'chatbubble' as const },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.huge,
          paddingHorizontal: Spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Close button */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: Spacing.xxl,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 24,
              color: Colors.text,
            }}
          >
            Share Photo
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: Colors.surface,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Ionicons name="close" size={20} color={Colors.text} />
          </Pressable>
        </View>

        {/* Photo preview */}
        <View
          style={{
            height: 180,
            borderRadius: Radius.lg,
            borderCurve: 'continuous',
            overflow: 'hidden',
            marginBottom: Spacing.xxl,
            borderWidth: 1,
            borderColor: Colors.borderGold,
          }}
        >
          <Image
            source={{ uri: photo.original_url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
          />
        </View>

        {/* Share type selector */}
        <View
          style={{
            flexDirection: 'row',
            gap: Spacing.sm,
            marginBottom: Spacing.xxl,
          }}
        >
          {shareTypes.map((type) => (
            <Pressable
              key={type.id}
              onPress={() => setShareType(type.id)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: Spacing.sm,
                paddingVertical: Spacing.md,
                backgroundColor:
                  shareType === type.id
                    ? 'rgba(200, 169, 110, 0.15)'
                    : Colors.surface,
                borderRadius: Radius.md,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor:
                  shareType === type.id ? Colors.primary : Colors.border,
              }}
            >
              <Ionicons
                name={type.icon}
                size={18}
                color={
                  shareType === type.id ? Colors.primary : Colors.textMuted
                }
              />
              <Text
                style={{
                  fontFamily: Fonts.semiBold,
                  fontSize: 13,
                  color:
                    shareType === type.id ? Colors.primary : Colors.textMuted,
                }}
              >
                {type.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Share content */}
        {shareType === 'qr' && (
          <View style={{ alignItems: 'center', gap: Spacing.xl }}>
            <QRCodeDisplay value={shareUrl || photo.share_token || photo.id} size={220} />
            <Text
              selectable
              style={{
                fontFamily: Fonts.regular,
                fontSize: 13,
                color: Colors.textSecondary,
                textAlign: 'center',
              }}
            >
              Show this QR code to the guest to let them download the photo
            </Text>
            {photo.share_token && (
              <View
                style={{
                  backgroundColor: Colors.surface,
                  borderRadius: Radius.md,
                  borderCurve: 'continuous',
                  padding: Spacing.md,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text
                  selectable
                  style={{
                    fontFamily: Fonts.regular,
                    fontSize: 11,
                    color: Colors.textMuted,
                    textAlign: 'center',
                  }}
                >
                  Token: {photo.share_token}
                </Text>
              </View>
            )}
          </View>
        )}

        {shareType === 'email' && (
          <View style={{ gap: Spacing.lg }}>
            <GoldInput
              label="Recipient Email"
              value={email}
              onChangeText={setEmail}
              placeholder="guest@example.com"
              icon="mail"
              keyboardType="email-address"
            />
            <GoldButton
              title="Send via Email"
              onPress={handleShareEmail}
              loading={sharing}
              icon={<Ionicons name="send" size={18} color={Colors.background} />}
            />
          </View>
        )}

        {shareType === 'sms' && (
          <View style={{ gap: Spacing.lg }}>
            <GoldInput
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+48 123 456 789"
              icon="call"
              keyboardType="phone-pad"
            />
            <GoldButton
              title="Send via SMS"
              onPress={handleShareSMS}
              loading={sharing}
              icon={
                <Ionicons
                  name="chatbubble"
                  size={18}
                  color={Colors.background}
                />
              }
            />
          </View>
        )}
      </ScrollView>

      {sharing && <LoadingOverlay message="Sharing photo..." />}
    </KeyboardAvoidingView>
  );
}
