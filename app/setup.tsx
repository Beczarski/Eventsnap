import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';
import { GoldButton } from '@/components/gold-button';
import { GoldInput } from '@/components/gold-input';
import { LoadingOverlay } from '@/components/loading-overlay';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

const OVERLAY_POSITIONS = [
  { id: 'top', label: 'Top', icon: 'arrow-up' as const },
  { id: 'bottom', label: 'Bottom', icon: 'arrow-down' as const },
  { id: 'corner', label: 'Corner', icon: 'resize' as const },
];

export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setActiveEvent = useAppStore((s) => s.setActiveEvent);

  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [overlayPosition, setOverlayPosition] = useState('corner');
  const [overlayOpacity, setOverlayOpacity] = useState(0.8);
  const [loading, setLoading] = useState(false);

  const pickLogo = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setLogoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not pick image');
    }
  }, []);

  const handleStartEvent = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Missing Info', 'Please enter an event name');
      return;
    }

    setLoading(true);
    try {
      let logoUrl: string | null = null;

      // Upload logo if selected
      if (logoUri) {
        const filename = `logo_${Date.now()}.jpg`;
        const response = await fetch(logoUri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('event-logos')
          .upload(filename, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('event-logos')
            .getPublicUrl(filename);
          logoUrl = urlData.publicUrl;
        }
      }

      // Deactivate existing events
      await supabase.from('events').update({ is_active: false }).eq('is_active', true);

      // Create new event
      const { data: event, error } = await supabase
        .from('events')
        .insert({
          name: name.trim(),
          date,
          location: location.trim() || null,
          logo_url: logoUrl,
          overlay_position: overlayPosition,
          overlay_opacity: overlayOpacity,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      if (!event) throw new Error('Failed to create event');

      setActiveEvent(event);
      router.replace('/(tabs)/camera');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  }, [name, date, location, logoUri, overlayPosition, overlayOpacity, setActiveEvent, router]);

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
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: Spacing.xxxl }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: 'rgba(200, 169, 110, 0.12)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: Spacing.md,
            }}
          >
            <Ionicons name="sparkles" size={24} color={Colors.primary} />
          </View>
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 28,
              color: Colors.text,
              letterSpacing: -0.5,
            }}
          >
            New Event
          </Text>
          <Text
            style={{
              fontFamily: Fonts.regular,
              fontSize: 14,
              color: Colors.textSecondary,
              marginTop: Spacing.xs,
            }}
          >
            Set up your photobooth session
          </Text>
        </View>

        {/* Event Details Form */}
        <View style={{ gap: Spacing.lg, marginBottom: Spacing.xxxl }}>
          <GoldInput
            label="Event Name"
            value={name}
            onChangeText={setName}
            placeholder="Gala Biznesu 2026"
            icon="calendar"
          />
          <GoldInput
            label="Date"
            value={date}
            onChangeText={setDate}
            placeholder="2026-03-26"
            icon="time"
          />
          <GoldInput
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="Hotel Marriott, Warsaw"
            icon="location"
          />
        </View>

        {/* Branding Section */}
        <View style={{ marginBottom: Spacing.xxxl }}>
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 18,
              color: Colors.text,
              marginBottom: Spacing.lg,
            }}
          >
            Branding & Overlay
          </Text>

          {/* Logo Upload */}
          <Pressable
            onPress={pickLogo}
            style={{
              backgroundColor: Colors.surface,
              borderRadius: Radius.lg,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: Colors.border,
              borderStyle: 'dashed',
              padding: Spacing.xl,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 140,
              marginBottom: Spacing.lg,
            }}
          >
            {logoUri ? (
              <View style={{ alignItems: 'center', gap: Spacing.md }}>
                <Image
                  source={{ uri: logoUri }}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: Radius.md,
                  }}
                  contentFit="contain"
                />
                <Text
                  style={{
                    fontFamily: Fonts.medium,
                    fontSize: 13,
                    color: Colors.primary,
                  }}
                >
                  Tap to change logo
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', gap: Spacing.md }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: 'rgba(200, 169, 110, 0.1)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="image" size={28} color={Colors.primary} />
                </View>
                <Text
                  style={{
                    fontFamily: Fonts.medium,
                    fontSize: 14,
                    color: Colors.textSecondary,
                  }}
                >
                  Upload Event Logo
                </Text>
                <Text
                  style={{
                    fontFamily: Fonts.regular,
                    fontSize: 12,
                    color: Colors.textMuted,
                  }}
                >
                  PNG or JPG, square recommended
                </Text>
              </View>
            )}
          </Pressable>

          {/* Overlay Position */}
          <Text
            style={{
              fontFamily: Fonts.medium,
              fontSize: 12,
              color: Colors.textSecondary,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: Spacing.sm,
              marginLeft: Spacing.xs,
            }}
          >
            Logo Position
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: Spacing.sm,
              marginBottom: Spacing.lg,
            }}
          >
            {OVERLAY_POSITIONS.map((pos) => (
              <Pressable
                key={pos.id}
                onPress={() => setOverlayPosition(pos.id)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: Spacing.sm,
                  paddingVertical: Spacing.md,
                  backgroundColor:
                    overlayPosition === pos.id
                      ? 'rgba(200, 169, 110, 0.15)'
                      : Colors.surface,
                  borderRadius: Radius.md,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor:
                    overlayPosition === pos.id ? Colors.primary : Colors.border,
                }}
              >
                <Ionicons
                  name={pos.icon}
                  size={16}
                  color={
                    overlayPosition === pos.id
                      ? Colors.primary
                      : Colors.textMuted
                  }
                />
                <Text
                  style={{
                    fontFamily: Fonts.semiBold,
                    fontSize: 13,
                    color:
                      overlayPosition === pos.id
                        ? Colors.primary
                        : Colors.textMuted,
                  }}
                >
                  {pos.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Opacity Slider - simple buttons */}
          <Text
            style={{
              fontFamily: Fonts.medium,
              fontSize: 12,
              color: Colors.textSecondary,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: Spacing.sm,
              marginLeft: Spacing.xs,
            }}
          >
            Overlay Opacity: {Math.round(overlayOpacity * 100)}%
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: Spacing.sm,
              marginBottom: Spacing.lg,
            }}
          >
            {[0.4, 0.6, 0.8, 1.0].map((val) => (
              <Pressable
                key={val}
                onPress={() => setOverlayOpacity(val)}
                style={{
                  flex: 1,
                  paddingVertical: Spacing.md,
                  backgroundColor:
                    overlayOpacity === val
                      ? 'rgba(200, 169, 110, 0.15)'
                      : Colors.surface,
                  borderRadius: Radius.md,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor:
                    overlayOpacity === val ? Colors.primary : Colors.border,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: Fonts.semiBold,
                    fontSize: 13,
                    color:
                      overlayOpacity === val
                        ? Colors.primary
                        : Colors.textMuted,
                  }}
                >
                  {Math.round(val * 100)}%
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Preview area */}
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: Radius.lg,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: Colors.border,
              height: 200,
              overflow: 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {/* Faux preview background */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: Colors.secondary,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="people" size={48} color={Colors.textMuted} />
              <Text
                style={{
                  fontFamily: Fonts.regular,
                  fontSize: 12,
                  color: Colors.textMuted,
                  marginTop: Spacing.sm,
                }}
              >
                Overlay Preview
              </Text>
            </View>

            {/* Logo overlay preview */}
            {logoUri && (
              <View
                style={{
                  position: 'absolute',
                  ...(overlayPosition === 'top'
                    ? { top: Spacing.md, alignSelf: 'center' }
                    : overlayPosition === 'bottom'
                      ? { bottom: Spacing.md, alignSelf: 'center' }
                      : { bottom: Spacing.md, right: Spacing.md }),
                  opacity: overlayOpacity,
                }}
              >
                <Image
                  source={{ uri: logoUri }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: Radius.sm,
                  }}
                  contentFit="contain"
                />
              </View>
            )}

            {/* Gold corner decorations */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 30,
                height: 30,
                borderTopWidth: 2,
                borderLeftWidth: 2,
                borderColor: Colors.primary,
                borderTopLeftRadius: Radius.lg,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 30,
                height: 30,
                borderTopWidth: 2,
                borderRightWidth: 2,
                borderColor: Colors.primary,
                borderTopRightRadius: Radius.lg,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: 30,
                height: 30,
                borderBottomWidth: 2,
                borderLeftWidth: 2,
                borderColor: Colors.primary,
                borderBottomLeftRadius: Radius.lg,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 30,
                height: 30,
                borderBottomWidth: 2,
                borderRightWidth: 2,
                borderColor: Colors.primary,
                borderBottomRightRadius: Radius.lg,
              }}
            />
          </View>
        </View>

        {/* Start Button */}
        <GoldButton
          title="Start Event"
          onPress={handleStartEvent}
          size="lg"
          loading={loading}
          icon={<Ionicons name="flash" size={20} color={Colors.background} />}
          style={{ marginBottom: Spacing.xl }}
        />
      </ScrollView>

      {loading && <LoadingOverlay message="Creating event..." />}
    </KeyboardAvoidingView>
  );
}
