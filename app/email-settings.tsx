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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';
import { GoldButton } from '@/components/gold-button';
import { GoldInput } from '@/components/gold-input';
import { LoadingOverlay } from '@/components/loading-overlay';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import type { EmailSettingsRow, EncryptionType } from '@/lib/database';

const ENCRYPTION_OPTIONS: { id: EncryptionType; label: string; port: number }[] = [
  { id: 'tls', label: 'SSL/TLS', port: 465 },
  { id: 'starttls', label: 'STARTTLS', port: 587 },
  { id: 'none', label: 'None', port: 25 },
];

export default function EmailSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setEmailSettings = useAppStore((s) => s.setEmailSettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [smtpServer, setSmtpServer] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [encryption, setEncryption] = useState<EncryptionType>('tls');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [senderName, setSenderName] = useState('PhotoBooth Pro');
  const [replyTo, setReplyTo] = useState('');
  const [subjectTemplate, setSubjectTemplate] = useState(
    'Twoje zdjęcia z eventu {event_name}'
  );
  const [bodyTemplate, setBodyTemplate] = useState(
    'Cześć!\n\nW załączeniu przesyłamy Twoje zdjęcia z eventu {event_name}.\n\nDziękujemy za wspólną zabawę!\n\nPozdrawiamy,\n{sender_name}'
  );

  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('email_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;

      if (data) {
        setSmtpServer(data.smtp_server);
        setSmtpPort(String(data.smtp_port));
        setEncryption(data.encryption as EncryptionType);
        setUsername(data.username);
        setPassword(data.password);
        setSenderName(data.sender_name);
        setReplyTo(data.reply_to || '');
        setSubjectTemplate(data.email_subject_template);
        setBodyTemplate(data.email_body_template);
        setEmailSettings(data);
      }
    } catch {
      // First use - defaults will apply
    } finally {
      setLoading(false);
    }
  }, [setEmailSettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = useCallback(async () => {
    if (!smtpServer.trim()) {
      Alert.alert('Błąd', 'Podaj adres serwera SMTP.');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Błąd', 'Podaj nazwę użytkownika (e-mail).');
      return;
    }

    setSaving(true);
    try {
      const updates = {
        smtp_server: smtpServer.trim(),
        smtp_port: parseInt(smtpPort, 10) || 587,
        encryption,
        username: username.trim(),
        password: password,
        sender_name: senderName.trim() || 'PhotoBooth Pro',
        reply_to: replyTo.trim() || null,
        email_subject_template: subjectTemplate.trim(),
        email_body_template: bodyTemplate.trim(),
        updated_at: new Date().toISOString(),
      };

      // Try to update existing row first
      const { data: existing } = await supabase
        .from('email_settings')
        .select('id')
        .limit(1)
        .single();

      let result: { data: EmailSettingsRow | null; error: any };

      if (existing) {
        result = await supabase
          .from('email_settings')
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('email_settings')
          .insert(updates)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      if (result.data) {
        setEmailSettings(result.data);
      }

      Alert.alert('Zapisano', 'Ustawienia poczty zostały zapisane.');
    } catch (err: any) {
      Alert.alert('Błąd', err.message || 'Nie udało się zapisać ustawień.');
    } finally {
      setSaving(false);
    }
  }, [
    smtpServer,
    smtpPort,
    encryption,
    username,
    password,
    senderName,
    replyTo,
    subjectTemplate,
    bodyTemplate,
    setEmailSettings,
  ]);

  const handleTestConnection = useCallback(async () => {
    if (!smtpServer.trim() || !username.trim()) {
      Alert.alert('Błąd', 'Najpierw skonfiguruj serwer SMTP i nazwę użytkownika.');
      return;
    }

    setTesting(true);
    try {
      // Save settings first so the edge function can read them
      await handleSave();

      // Simulate test connection — in production this would be an Edge Function
      // that actually connects to the SMTP server
      await new Promise((resolve) => setTimeout(resolve, 2000));

      Alert.alert(
        'Test połączenia',
        `Konfiguracja SMTP:\n\nSerwer: ${smtpServer}:${smtpPort}\nSzyfrowanie: ${encryption.toUpperCase()}\nUżytkownik: ${username}\n\nUstawienia zostały zapisane. W środowisku produkcyjnym wysłalibyśmy testowy e-mail.`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Błąd', err.message || 'Test połączenia nie powiódł się.');
    } finally {
      setTesting(false);
    }
  }, [smtpServer, smtpPort, encryption, username, handleSave]);

  const handleEncryptionChange = useCallback((enc: EncryptionType) => {
    setEncryption(enc);
    const option = ENCRYPTION_OPTIONS.find((o) => o.id === enc);
    if (option) {
      setSmtpPort(String(option.port));
    }
  }, []);

  if (loading) {
    return <LoadingOverlay fullScreen message="Ładowanie ustawień..." />;
  }

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
            alignItems: 'center',
            gap: Spacing.md,
            marginBottom: Spacing.xxl,
          }}
        >
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
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 22,
                color: Colors.text,
              }}
            >
              Ustawienia poczty
            </Text>
            <Text
              style={{
                fontFamily: Fonts.regular,
                fontSize: 13,
                color: Colors.textSecondary,
                marginTop: 2,
              }}
            >
              Konfiguracja serwera SMTP
            </Text>
          </View>
        </View>

        {/* SMTP Server section */}
        <View
          style={{
            backgroundColor: Colors.surface,
            borderRadius: Radius.lg,
            borderCurve: 'continuous',
            padding: Spacing.xl,
            borderWidth: 1,
            borderColor: Colors.border,
            marginBottom: Spacing.xxl,
            gap: Spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(200, 169, 110, 0.12)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="server-outline" size={18} color={Colors.primary} />
            </View>
            <Text
              style={{
                fontFamily: Fonts.semiBold,
                fontSize: 16,
                color: Colors.text,
              }}
            >
              Serwer SMTP
            </Text>
          </View>

          <GoldInput
            label="Adres serwera"
            value={smtpServer}
            onChangeText={setSmtpServer}
            placeholder="smtp.gmail.com"
            icon="globe-outline"
          />

          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <View style={{ flex: 1 }}>
              <GoldInput
                label="Port"
                value={smtpPort}
                onChangeText={setSmtpPort}
                placeholder="587"
                icon="keypad-outline"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Encryption selector */}
          <View style={{ gap: Spacing.xs }}>
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
              Szyfrowanie
            </Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {ENCRYPTION_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => handleEncryptionChange(opt.id)}
                  style={{
                    flex: 1,
                    paddingVertical: Spacing.md,
                    backgroundColor:
                      encryption === opt.id
                        ? 'rgba(200, 169, 110, 0.15)'
                        : Colors.background,
                    borderRadius: Radius.md,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor:
                      encryption === opt.id ? Colors.primary : Colors.border,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.semiBold,
                      fontSize: 12,
                      color:
                        encryption === opt.id
                          ? Colors.primary
                          : Colors.textMuted,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Credentials section */}
        <View
          style={{
            backgroundColor: Colors.surface,
            borderRadius: Radius.lg,
            borderCurve: 'continuous',
            padding: Spacing.xl,
            borderWidth: 1,
            borderColor: Colors.border,
            marginBottom: Spacing.xxl,
            gap: Spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(200, 169, 110, 0.12)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="key-outline" size={18} color={Colors.primary} />
            </View>
            <Text
              style={{
                fontFamily: Fonts.semiBold,
                fontSize: 16,
                color: Colors.text,
              }}
            >
              Dane logowania
            </Text>
          </View>

          <GoldInput
            label="Nazwa użytkownika (e-mail)"
            value={username}
            onChangeText={setUsername}
            placeholder="twoj@email.com"
            icon="mail-outline"
            keyboardType="email-address"
          />

          <GoldInput
            label="Hasło"
            value={password}
            onChangeText={setPassword}
            placeholder="Hasło do serwera SMTP"
            icon="lock-closed-outline"
            secureTextEntry={!showPassword}
            rightElement={
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={{
                  width: 40,
                  height: 40,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textMuted}
                />
              </Pressable>
            }
          />
        </View>

        {/* Sender info section */}
        <View
          style={{
            backgroundColor: Colors.surface,
            borderRadius: Radius.lg,
            borderCurve: 'continuous',
            padding: Spacing.xl,
            borderWidth: 1,
            borderColor: Colors.border,
            marginBottom: Spacing.xxl,
            gap: Spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(200, 169, 110, 0.12)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="person-outline" size={18} color={Colors.primary} />
            </View>
            <Text
              style={{
                fontFamily: Fonts.semiBold,
                fontSize: 16,
                color: Colors.text,
              }}
            >
              Informacje o nadawcy
            </Text>
          </View>

          <GoldInput
            label="Nazwa nadawcy"
            value={senderName}
            onChangeText={setSenderName}
            placeholder="PhotoBooth Pro"
            icon="person-circle-outline"
          />

          <GoldInput
            label="Adres reply-to (opcjonalnie)"
            value={replyTo}
            onChangeText={setReplyTo}
            placeholder="odpowiedz@twojafirma.pl"
            icon="return-down-back-outline"
            keyboardType="email-address"
          />
        </View>

        {/* Email template section */}
        <View
          style={{
            backgroundColor: Colors.surface,
            borderRadius: Radius.lg,
            borderCurve: 'continuous',
            padding: Spacing.xl,
            borderWidth: 1,
            borderColor: Colors.border,
            marginBottom: Spacing.xxl,
            gap: Spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(200, 169, 110, 0.12)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
            </View>
            <Text
              style={{
                fontFamily: Fonts.semiBold,
                fontSize: 16,
                color: Colors.text,
              }}
            >
              Szablon wiadomości
            </Text>
          </View>

          <View
            style={{
              backgroundColor: 'rgba(200, 169, 110, 0.06)',
              borderRadius: Radius.sm,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: Colors.borderGold,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.regular,
                fontSize: 11,
                color: Colors.textSecondary,
                lineHeight: 16,
              }}
            >
              Dostępne zmienne: {'{event_name}'}, {'{sender_name}'}, {'{photo_count}'}
            </Text>
          </View>

          <GoldInput
            label="Temat wiadomości"
            value={subjectTemplate}
            onChangeText={setSubjectTemplate}
            placeholder="Twoje zdjęcia z eventu {event_name}"
            icon="text-outline"
          />

          <GoldInput
            label="Treść wiadomości"
            value={bodyTemplate}
            onChangeText={setBodyTemplate}
            placeholder="Treść e-maila..."
            multiline
          />
        </View>

        {/* Action buttons */}
        <View style={{ gap: Spacing.md }}>
          <GoldButton
            title="Zapisz ustawienia"
            onPress={handleSave}
            loading={saving}
            size="lg"
            icon={<Ionicons name="save-outline" size={20} color={Colors.background} />}
          />

          <GoldButton
            title="Testuj połączenie"
            onPress={handleTestConnection}
            loading={testing}
            variant="outline"
            size="lg"
            icon={
              <Ionicons
                name="flash-outline"
                size={20}
                color={Colors.primary}
              />
            }
          />
        </View>
      </ScrollView>

      {(saving || testing) && (
        <LoadingOverlay
          message={saving ? 'Zapisywanie...' : 'Testowanie połączenia...'}
        />
      )}
    </KeyboardAvoidingView>
  );
}
