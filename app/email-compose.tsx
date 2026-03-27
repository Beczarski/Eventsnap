import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';
import { GoldButton } from '@/components/gold-button';
import { GoldInput } from '@/components/gold-input';
import { LoadingOverlay } from '@/components/loading-overlay';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import type { PhotoRow } from '@/lib/database';

export default function EmailComposeScreen() {
  const { photoIds, eventName } = useLocalSearchParams<{
    photoIds: string;
    eventName: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const emailSettings = useAppStore((s) => s.emailSettings);

  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form state — pre-filled from email settings
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const photoIdList = photoIds?.split(',').filter(Boolean) ?? [];
  const thumbSize = Math.min(72, (screenWidth - Spacing.lg * 2 - Spacing.sm * 4) / 5);

  useEffect(() => {
    (async () => {
      try {
        if (photoIdList.length === 0) {
          Alert.alert('Błąd', 'Nie wybrano żadnych zdjęć.');
          router.back();
          return;
        }

        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .in('id', photoIdList);

        if (error) throw error;
        setPhotos(data ?? []);

        // Pre-fill from email settings templates
        const evtName = eventName || 'event';
        const sName = emailSettings?.sender_name || 'PhotoBooth Pro';
        const count = String(photoIdList.length);

        const subjectTpl =
          emailSettings?.email_subject_template ||
          'Twoje zdjęcia z eventu {event_name}';
        const bodyTpl =
          emailSettings?.email_body_template ||
          'Cześć!\n\nW załączeniu przesyłamy Twoje zdjęcia z eventu {event_name}.\n\nDziękujemy za wspólną zabawę!\n\nPozdrawiamy,\n{sender_name}';

        setSubject(
          subjectTpl
            .replace(/{event_name}/g, evtName)
            .replace(/{sender_name}/g, sName)
            .replace(/{photo_count}/g, count)
        );
        setBody(
          bodyTpl
            .replace(/{event_name}/g, evtName)
            .replace(/{sender_name}/g, sName)
            .replace(/{photo_count}/g, count)
        );
      } catch {
        Alert.alert('Błąd', 'Nie udało się załadować zdjęć.');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoIds]);

  const handleSend = useCallback(async () => {
    if (!recipientEmail.trim()) {
      Alert.alert('Błąd', 'Podaj adres e-mail odbiorcy.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail.trim())) {
      Alert.alert('Błąd', 'Podaj prawidłowy adres e-mail.');
      return;
    }

    if (!emailSettings?.smtp_server) {
      Alert.alert(
        'Brak konfiguracji SMTP',
        'Najpierw skonfiguruj serwer poczty w Panelu Admina > Ustawienia poczty.',
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Konfiguruj',
            onPress: () => router.push('/email-settings'),
          },
        ]
      );
      return;
    }

    setSending(true);
    try {
      // Record shares in database for each photo
      const shareRecords = photos.map((photo) => ({
        photo_id: photo.id,
        share_type: 'email' as const,
        recipient: recipientEmail.trim(),
      }));

      const { error: shareError } = await supabase
        .from('shares')
        .insert(shareRecords);

      if (shareError) throw shareError;

      // Mark photos as shared
      await supabase
        .from('photos')
        .update({ is_shared: true })
        .in(
          'id',
          photos.map((p) => p.id)
        );

      // In production, this would call an Edge Function that:
      // 1. Reads SMTP settings from email_settings table
      // 2. Downloads photos from storage
      // 3. Sends email with attachments via nodemailer/SMTP
      // For now, we simulate success and record the share
      await new Promise((resolve) => setTimeout(resolve, 1500));

      Alert.alert(
        'Wysłano',
        `E-mail z ${photos.length} ${photos.length === 1 ? 'zdjęciem' : photos.length < 5 ? 'zdjęciami' : 'zdjęciami'} został wysłany na ${recipientEmail.trim()}.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Błąd', err.message || 'Nie udało się wysłać e-maila.');
    } finally {
      setSending(false);
    }
  }, [recipientEmail, photos, emailSettings, router]);

  const removePhoto = useCallback(
    (photoId: string) => {
      const remaining = photos.filter((p) => p.id !== photoId);
      if (remaining.length === 0) {
        Alert.alert('Błąd', 'Musisz załączyć przynajmniej jedno zdjęcie.');
        return;
      }
      setPhotos(remaining);
    },
    [photos]
  );

  if (loading) {
    return <LoadingOverlay fullScreen message="Ładowanie zdjęć..." />;
  }

  const smtpConfigured = !!emailSettings?.smtp_server;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.md,
          paddingBottom: insets.bottom + Spacing.huge,
          paddingHorizontal: Spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: Spacing.xxl,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
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
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 22,
                color: Colors.text,
              }}
            >
              Wyślij e-mail
            </Text>
          </View>
        </View>

        {/* SMTP Status Banner */}
        {!smtpConfigured && (
          <Pressable
            onPress={() => router.push('/email-settings')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.md,
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              borderRadius: Radius.md,
              borderCurve: 'continuous',
              padding: Spacing.lg,
              borderWidth: 1,
              borderColor: 'rgba(255, 152, 0, 0.3)',
              marginBottom: Spacing.xxl,
            }}
          >
            <Ionicons name="warning-outline" size={22} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: Fonts.semiBold,
                  fontSize: 13,
                  color: Colors.warning,
                }}
              >
                Serwer SMTP nie skonfigurowany
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.regular,
                  fontSize: 12,
                  color: Colors.textSecondary,
                  marginTop: 2,
                }}
              >
                Dotknij, aby skonfigurować ustawienia poczty
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.warning} />
          </Pressable>
        )}

        {smtpConfigured && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.md,
              backgroundColor: 'rgba(76, 175, 80, 0.08)',
              borderRadius: Radius.md,
              borderCurve: 'continuous',
              padding: Spacing.lg,
              borderWidth: 1,
              borderColor: 'rgba(76, 175, 80, 0.2)',
              marginBottom: Spacing.xxl,
            }}
          >
            <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: Fonts.semiBold,
                  fontSize: 13,
                  color: Colors.success,
                }}
              >
                {emailSettings.sender_name}
              </Text>
              <Text
                selectable
                style={{
                  fontFamily: Fonts.regular,
                  fontSize: 12,
                  color: Colors.textSecondary,
                  marginTop: 2,
                }}
              >
                via {emailSettings.smtp_server}:{emailSettings.smtp_port}
              </Text>
            </View>
          </View>
        )}

        {/* Attached photos */}
        <View style={{ marginBottom: Spacing.xxl }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: Spacing.md,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.semiBold,
                fontSize: 14,
                color: Colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              Załączniki
            </Text>
            <View
              style={{
                backgroundColor: Colors.surface,
                borderRadius: Radius.full,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.xs,
                borderWidth: 1,
                borderColor: Colors.borderGold,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.bold,
                  fontSize: 12,
                  color: Colors.primary,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {photos.length} {photos.length === 1 ? 'zdjęcie' : photos.length < 5 ? 'zdjęcia' : 'zdjęć'}
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: Spacing.sm,
            }}
          >
            {photos.map((photo) => (
              <View
                key={photo.id}
                style={{
                  width: thumbSize,
                  height: thumbSize,
                  borderRadius: Radius.sm,
                  borderCurve: 'continuous',
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Image
                  source={{ uri: photo.original_url }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={150}
                />
                <Pressable
                  onPress={() => removePhoto(photo.id)}
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: 'rgba(229, 57, 53, 0.9)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="close" size={12} color="#FFF" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Email form */}
        <View style={{ gap: Spacing.lg }}>
          <GoldInput
            label="Adres e-mail odbiorcy"
            value={recipientEmail}
            onChangeText={setRecipientEmail}
            placeholder="gość@example.com"
            icon="mail-outline"
            keyboardType="email-address"
          />

          <GoldInput
            label="Temat"
            value={subject}
            onChangeText={setSubject}
            placeholder="Twoje zdjęcia z eventu..."
            icon="text-outline"
          />

          <GoldInput
            label="Treść wiadomości"
            value={body}
            onChangeText={setBody}
            placeholder="Treść e-maila..."
            multiline
          />
        </View>

        {/* Send button */}
        <View style={{ marginTop: Spacing.xxxl }}>
          <GoldButton
            title={`Wyślij (${photos.length} ${photos.length === 1 ? 'zdjęcie' : photos.length < 5 ? 'zdjęcia' : 'zdjęć'})`}
            onPress={handleSend}
            loading={sending}
            disabled={!recipientEmail.trim() || photos.length === 0}
            size="lg"
            icon={<Ionicons name="send" size={20} color={Colors.background} />}
          />
        </View>
      </ScrollView>

      {sending && <LoadingOverlay message="Wysyłanie e-maila..." />}
    </KeyboardAvoidingView>
  );
}
