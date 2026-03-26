import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';
import { LoadingOverlay } from '@/components/loading-overlay';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import type { PhotoRow } from '@/lib/database';

export default function PreviewScreen() {
  const { photoId } = useLocalSearchParams<{ photoId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeEvent = useAppStore((s) => s.activeEvent);
  const photos = useAppStore((s) => s.photos);
  const removePhoto = useAppStore((s) => s.removePhoto);
  const updatePhoto = useAppStore((s) => s.updatePhoto);

  const [photo, setPhoto] = useState<PhotoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const storePhoto = photos.find((p) => p.id === photoId);
    if (storePhoto) {
      setPhoto(storePhoto);
      setLoading(false);
    } else if (photoId) {
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
    }
  }, [photoId, photos, router]);

  const handlePrint = useCallback(async () => {
    if (!photo || !activeEvent) return;
    setActionLoading('print');
    try {
      // Create a print job
      const { error } = await supabase.from('print_jobs').insert({
        photo_id: photo.id,
        event_id: activeEvent.id,
        status: 'pending',
        copies: 1,
        paper_size: '10x15',
      });

      if (error) throw error;

      // Update photo print status
      await supabase
        .from('photos')
        .update({
          is_printed: true,
          print_count: (photo.print_count || 0) + 1,
        })
        .eq('id', photo.id);

      updatePhoto(photo.id, {
        is_printed: true,
        print_count: (photo.print_count || 0) + 1,
      });

      Alert.alert('Print Queued', 'Photo has been sent to the print queue');
    } catch (error: any) {
      Alert.alert('Print Error', error.message || 'Failed to queue print');
    } finally {
      setActionLoading(null);
    }
  }, [photo, activeEvent, updatePhoto]);

  const handleShare = useCallback(() => {
    if (!photo) return;
    router.push({
      pathname: '/share',
      params: { photoId: photo.id },
    });
  }, [photo, router]);

  const handleDelete = useCallback(() => {
    if (!photo) return;
    Alert.alert('Delete Photo', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setActionLoading('delete');
          try {
            await supabase.from('photos').delete().eq('id', photo.id);
            removePhoto(photo.id);
            router.back();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to delete photo');
            setActionLoading(null);
          }
        },
      },
    ]);
  }, [photo, removePhoto, router]);

  if (loading) {
    return <LoadingOverlay fullScreen message="Loading photo..." />;
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

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Close button */}
      <Pressable
        onPress={() => router.back()}
        style={{
          position: 'absolute',
          top: insets.top + Spacing.md,
          left: Spacing.lg,
          zIndex: 10,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: Colors.overlay,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: Colors.border,
        }}
      >
        <Ionicons name="close" size={22} color={Colors.text} />
      </Pressable>

      {/* Full-screen photo */}
      <View
        style={{
          flex: 1,
          marginTop: insets.top,
          marginBottom: Spacing.md,
        }}
      >
        <Image
          source={{ uri: photo.original_url }}
          style={{
            flex: 1,
            borderRadius: Radius.lg,
            marginHorizontal: Spacing.md,
          }}
          contentFit="contain"
          transition={300}
        />

        {/* Gold corner frame */}
        <View
          style={{
            position: 'absolute',
            top: Spacing.xxl,
            left: Spacing.xxl,
            width: 36,
            height: 36,
            borderTopWidth: 2,
            borderLeftWidth: 2,
            borderColor: Colors.primary,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: Spacing.xxl,
            right: Spacing.xxl,
            width: 36,
            height: 36,
            borderTopWidth: 2,
            borderRightWidth: 2,
            borderColor: Colors.primary,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: Spacing.xxl,
            left: Spacing.xxl,
            width: 36,
            height: 36,
            borderBottomWidth: 2,
            borderLeftWidth: 2,
            borderColor: Colors.primary,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: Spacing.xxl,
            right: Spacing.xxl,
            width: 36,
            height: 36,
            borderBottomWidth: 2,
            borderRightWidth: 2,
            borderColor: Colors.primary,
          }}
        />

        {/* Logo overlay */}
        {activeEvent?.logo_url && (
          <View
            style={{
              position: 'absolute',
              ...(activeEvent.overlay_position === 'top'
                ? { top: Spacing.huge, alignSelf: 'center' }
                : activeEvent.overlay_position === 'bottom'
                  ? { bottom: Spacing.huge, alignSelf: 'center' }
                  : { bottom: Spacing.huge, right: Spacing.huge }),
              opacity: activeEvent.overlay_opacity,
            }}
          >
            <Image
              source={{ uri: activeEvent.logo_url }}
              style={{
                width: 48,
                height: 48,
                borderRadius: Radius.sm,
              }}
              contentFit="contain"
            />
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View
        style={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: insets.bottom + Spacing.md,
          gap: Spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <ActionButton
            icon="print"
            label="Print"
            onPress={handlePrint}
            loading={actionLoading === 'print'}
            color={Colors.primary}
          />
          <ActionButton
            icon="share"
            label="Share"
            onPress={handleShare}
            color={Colors.accent}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <ActionButton
            icon="checkmark-circle"
            label="Save"
            onPress={() => {
              Alert.alert('Saved', 'Photo saved to event gallery');
            }}
            color={Colors.success}
          />
          <ActionButton
            icon="trash"
            label="Delete"
            onPress={handleDelete}
            loading={actionLoading === 'delete'}
            color={Colors.error}
          />
        </View>
      </View>

      {actionLoading && (
        <LoadingOverlay
          message={
            actionLoading === 'print' ? 'Sending to printer...' : 'Deleting...'
          }
        />
      )}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  loading,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        backgroundColor: `${color}15`,
        borderRadius: Radius.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: `${color}30`,
        opacity: pressed ? 0.7 : loading ? 0.5 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text
        style={{
          fontFamily: Fonts.bold,
          fontSize: 14,
          color,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
