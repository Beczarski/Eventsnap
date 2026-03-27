import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';
import { LoadingOverlay } from '@/components/loading-overlay';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeEvent = useAppStore((s) => s.activeEvent);
  const photos = useAppStore((s) => s.photos);
  const addPhoto = useAppStore((s) => s.addPhoto);

  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);

  const loadPhotoCount = useCallback(async () => {
    if (!activeEvent) return;
    try {
      const { count } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', activeEvent.id);
      setPhotoCount(count ?? 0);
    } catch {
      // Silently fail for count
    }
  }, [activeEvent]);

  useEffect(() => {
    if (activeEvent) {
      loadPhotoCount();
    }
  }, [activeEvent, loadPhotoCount]);

  const uploadPhoto = useCallback(
    async (uri: string, source: 'ipad_camera' | 'photos_library' = 'ipad_camera') => {
      if (!activeEvent) {
        Alert.alert('No Event', 'Please set up an event first');
        return;
      }

      setUploading(true);
      try {
        const filename = `${activeEvent.id}/${Date.now()}.jpg`;
        const response = await fetch(uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('event-photos')
          .upload(filename, blob, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('event-photos')
          .getPublicUrl(filename);

        const { data: photo, error: insertError } = await supabase
          .from('photos')
          .insert({
            event_id: activeEvent.id,
            original_url: urlData.publicUrl,
            source,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (photo) {
          addPhoto(photo);
          setLastPhoto(photo.original_url);
          setPhotoCount((c) => c + 1);
        }
      } catch (error: any) {
        Alert.alert('Upload Error', error.message || 'Failed to upload photo');
      } finally {
        setUploading(false);
      }
    },
    [activeEvent, addPhoto]
  );

  const importPhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });
      if (!result.canceled && result.assets.length > 0) {
        for (const asset of result.assets) {
          await uploadPhoto(asset.uri, 'photos_library');
        }
      }
    } catch {
      Alert.alert('Import Error', 'Failed to import photos');
    }
  }, [uploadPhoto]);

  const takePhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0].uri);
      }
    } catch {
      // Fallback to library if camera not available (web)
      importPhoto();
    }
  }, [uploadPhoto, importPhoto]);

  if (!activeEvent) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.xxxl,
          gap: Spacing.lg,
        }}
      >
        <Ionicons name="camera-outline" size={56} color={Colors.textMuted} />
        <Text
          style={{
            fontFamily: Fonts.semiBold,
            fontSize: 18,
            color: Colors.text,
            textAlign: 'center',
          }}
        >
          No Active Event
        </Text>
        <Text
          style={{
            fontFamily: Fonts.regular,
            fontSize: 14,
            color: Colors.textSecondary,
            textAlign: 'center',
          }}
        >
          Create a new event to start capturing photos
        </Text>
        <Pressable
          onPress={() => router.push('/setup')}
          style={{
            backgroundColor: Colors.primary,
            paddingHorizontal: Spacing.xxl,
            paddingVertical: Spacing.md,
            borderRadius: Radius.md,
            borderCurve: 'continuous',
            marginTop: Spacing.md,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 15,
              color: Colors.background,
            }}
          >
            Create Event
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Camera Viewfinder Area */}
      <View
        style={{
          flex: 1,
          marginTop: insets.top,
          marginHorizontal: Spacing.md,
          marginBottom: Spacing.md,
        }}
      >
        {/* Event header bar */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: Spacing.md,
            paddingHorizontal: Spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: Colors.success,
              }}
            />
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 16,
                color: Colors.text,
              }}
            >
              {activeEvent.name}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.xs,
              backgroundColor: Colors.surface,
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm,
              borderRadius: Radius.full,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Ionicons name="camera" size={14} color={Colors.primary} />
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 14,
                color: Colors.primary,
                fontVariant: ['tabular-nums'],
              }}
            >
              {photoCount}
            </Text>
          </View>
        </View>

        {/* Viewfinder */}
        <View
          style={{
            flex: 1,
            backgroundColor: Colors.secondary,
            borderRadius: Radius.xl,
            borderCurve: 'continuous',
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: Colors.border,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Camera placeholder / last photo */}
          {lastPhoto ? (
            <Image
              source={{ uri: lastPhoto }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <View style={{ alignItems: 'center', gap: Spacing.lg }}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: 'rgba(200, 169, 110, 0.08)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="camera" size={44} color={Colors.textMuted} />
              </View>
              <Text
                style={{
                  fontFamily: Fonts.medium,
                  fontSize: 15,
                  color: Colors.textSecondary,
                  textAlign: 'center',
                }}
              >
                Tap the shutter to take a photo{'\n'}or import from your library
              </Text>
            </View>
          )}

          {/* Gold corner frame decorations */}
          <View
            style={{
              position: 'absolute',
              top: Spacing.lg,
              left: Spacing.lg,
              width: 40,
              height: 40,
              borderTopWidth: 2,
              borderLeftWidth: 2,
              borderColor: Colors.primary,
              borderTopLeftRadius: Radius.md,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: Spacing.lg,
              right: Spacing.lg,
              width: 40,
              height: 40,
              borderTopWidth: 2,
              borderRightWidth: 2,
              borderColor: Colors.primary,
              borderTopRightRadius: Radius.md,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: Spacing.lg,
              left: Spacing.lg,
              width: 40,
              height: 40,
              borderBottomWidth: 2,
              borderLeftWidth: 2,
              borderColor: Colors.primary,
              borderBottomLeftRadius: Radius.md,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: Spacing.lg,
              right: Spacing.lg,
              width: 40,
              height: 40,
              borderBottomWidth: 2,
              borderRightWidth: 2,
              borderColor: Colors.primary,
              borderBottomRightRadius: Radius.md,
            }}
          />

          {/* Logo overlay */}
          {activeEvent.logo_url && (
            <View
              style={{
                position: 'absolute',
                ...(activeEvent.overlay_position === 'top'
                  ? { top: Spacing.xxl, alignSelf: 'center' }
                  : activeEvent.overlay_position === 'bottom'
                    ? { bottom: Spacing.xxl, alignSelf: 'center' }
                    : { bottom: Spacing.xxl, right: Spacing.xxl }),
                opacity: activeEvent.overlay_opacity,
              }}
            >
              <Image
                source={{ uri: activeEvent.logo_url }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: Radius.sm,
                }}
                contentFit="contain"
              />
            </View>
          )}
        </View>
      </View>

      {/* Controls bar */}
      <View
        style={{
          paddingHorizontal: Spacing.xxl,
          paddingBottom: Spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Last Photo Thumbnail */}
        <Pressable
          onPress={() => {
            if (photos.length > 0) {
              router.push({
                pathname: '/preview',
                params: { photoId: photos[0].id },
              });
            }
          }}
          style={{
            width: 56,
            height: 56,
            borderRadius: Radius.md,
            borderCurve: 'continuous',
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: lastPhoto ? Colors.primary : Colors.border,
            backgroundColor: Colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {lastPhoto ? (
            <Image
              source={{ uri: lastPhoto }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <Ionicons name="image-outline" size={22} color={Colors.textMuted} />
          )}
        </Pressable>

        {/* Shutter Button */}
        <Pressable
          onPress={takePhoto}
          disabled={uploading}
          style={({ pressed }) => ({
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: pressed ? Colors.accent : Colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 4,
            borderColor: 'rgba(200, 169, 110, 0.3)',
            boxShadow: '0 4px 20px rgba(200, 169, 110, 0.4)',
            transform: [{ scale: pressed ? 0.92 : 1 }],
          })}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 2,
              borderColor: Colors.background,
              backgroundColor: 'transparent',
            }}
          />
        </Pressable>

        {/* Import Button */}
        <Pressable
          onPress={importPhoto}
          style={({ pressed }) => ({
            width: 56,
            height: 56,
            borderRadius: Radius.md,
            borderCurve: 'continuous',
            backgroundColor: pressed
              ? 'rgba(200, 169, 110, 0.2)'
              : Colors.surface,
            borderWidth: 1,
            borderColor: Colors.border,
            justifyContent: 'center',
            alignItems: 'center',
          })}
        >
          <Ionicons name="download-outline" size={24} color={Colors.primary} />
          <Text
            style={{
              fontFamily: Fonts.medium,
              fontSize: 9,
              color: Colors.primary,
              marginTop: 2,
            }}
          >
            Import
          </Text>
        </Pressable>
      </View>

      {uploading && <LoadingOverlay message="Uploading photo..." />}
    </View>
  );
}
