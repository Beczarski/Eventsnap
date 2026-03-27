import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';
import { EmptyState } from '@/components/empty-state';
import { GoldButton } from '@/components/gold-button';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import type { PhotoRow } from '@/lib/database';

type FilterType = 'all' | 'printed' | 'shared' | 'canon';

export default function GalleryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const activeEvent = useAppStore((s) => s.activeEvent);
  const photos = useAppStore((s) => s.photos);
  const setPhotos = useAppStore((s) => s.setPhotos);

  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [, setLoading] = useState(true);

  const numColumns = screenWidth > 768 ? 4 : screenWidth > 500 ? 3 : 2;
  const cardGap = Spacing.sm;
  const horizontalPadding = Spacing.lg * 2;
  const cardWidth =
    (screenWidth - horizontalPadding - cardGap * (numColumns - 1)) / numColumns;

  const loadPhotos = useCallback(async () => {
    if (!activeEvent) return;
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('event_id', activeEvent.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPhotos(data ?? []);
    } catch {
      // Silently handle - will show empty state
    } finally {
      setLoading(false);
    }
  }, [activeEvent, setPhotos]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPhotos();
    setRefreshing(false);
  }, [loadPhotos]);

  const filteredPhotos = photos.filter((p) => {
    if (filter === 'printed') return p.is_printed;
    if (filter === 'shared') return p.is_shared;
    if (filter === 'canon') return p.source === 'canon_import';
    return true;
  });

  const filters: { id: FilterType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'all', label: 'All', icon: 'grid' },
    { id: 'canon', label: 'Canon', icon: 'camera' },
    { id: 'printed', label: 'Printed', icon: 'print' },
    { id: 'shared', label: 'Shared', icon: 'share' },
  ];

  if (!activeEvent) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <EmptyState
          icon="images-outline"
          title="No Active Event"
          subtitle="Create an event to view the photo gallery"
          action={
            <GoldButton
              title="Create Event"
              onPress={() => router.push('/setup')}
              variant="outline"
            />
          }
        />
      </View>
    );
  }

  const renderPhoto = ({ item }: { item: PhotoRow }) => (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/preview',
          params: { photoId: item.id },
        })
      }
      style={({ pressed }) => ({
        width: cardWidth,
        height: cardWidth * 1.25,
        borderRadius: Radius.md,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: Colors.surface,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Image
        source={{ uri: item.original_url }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        transition={200}
      />
      {/* Status overlay */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
          flexDirection: 'row',
          gap: 4,
          backgroundColor: 'rgba(10, 10, 15, 0.6)',
        }}
      >
        {item.source === 'canon_import' && (
          <Ionicons name="camera" size={12} color={Colors.accent} />
        )}
        {item.is_printed && (
          <Ionicons name="print" size={12} color={Colors.primary} />
        )}
        {item.is_shared && (
          <Ionicons name="share" size={12} color={Colors.accent} />
        )}
        <View style={{ flex: 1 }} />
        <Text
          style={{
            fontFamily: Fonts.medium,
            fontSize: 9,
            color: Colors.textSecondary,
          }}
        >
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + Spacing.md,
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.md,
          gap: Spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 24,
              color: Colors.text,
            }}
          >
            Event Gallery
          </Text>
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: Radius.full,
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 13,
                color: Colors.primary,
                fontVariant: ['tabular-nums'],
              }}
            >
              {photos.length} photos
            </Text>
          </View>
        </View>

        {/* Filters */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {filters.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                borderRadius: Radius.full,
                backgroundColor:
                  filter === f.id
                    ? 'rgba(200, 169, 110, 0.15)'
                    : Colors.surface,
                borderWidth: 1,
                borderColor:
                  filter === f.id ? Colors.primary : Colors.border,
              }}
            >
              <Ionicons
                name={f.icon}
                size={14}
                color={filter === f.id ? Colors.primary : Colors.textMuted}
              />
              <Text
                style={{
                  fontFamily: Fonts.semiBold,
                  fontSize: 12,
                  color:
                    filter === f.id ? Colors.primary : Colors.textMuted,
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Photos Grid */}
      {filteredPhotos.length === 0 ? (
        <EmptyState
          icon="camera-outline"
          title={
            filter === 'all'
              ? 'No Photos Yet'
              : `No ${filter} photos`
          }
          subtitle={
            filter === 'all'
              ? 'Take your first photo from the camera tab'
              : 'Change filter to see all photos'
          }
        />
      ) : (
        <FlatList
          data={filteredPhotos}
          renderItem={renderPhoto}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          key={`grid-${numColumns}`}
          contentContainerStyle={{
            padding: Spacing.lg,
            gap: cardGap,
          }}
          columnWrapperStyle={{
            gap: cardGap,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
