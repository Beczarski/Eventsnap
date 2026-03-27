import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
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

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const filteredPhotos = useMemo(
    () =>
      photos.filter((p) => {
        if (filter === 'printed') return p.is_printed;
        if (filter === 'shared') return p.is_shared;
        if (filter === 'canon') return p.source === 'canon_import';
        return true;
      }),
    [photos, filter]
  );

  const filters: { id: FilterType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'all', label: 'All', icon: 'grid' },
    { id: 'canon', label: 'Canon', icon: 'camera' },
    { id: 'printed', label: 'Printed', icon: 'print' },
    { id: 'shared', label: 'Shared', icon: 'share' },
  ];

  // Selection helpers
  const toggleSelectMode = useCallback(() => {
    if (selectMode) {
      setSelectedIds(new Set());
    }
    setSelectMode((prev) => !prev);
  }, [selectMode]);

  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }, []);

  const allSelected =
    filteredPhotos.length > 0 && selectedIds.size === filteredPhotos.length;

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPhotos.map((p) => p.id)));
    }
  }, [allSelected, filteredPhotos]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  // Bulk print: create print jobs for all selected photos
  const handleBulkPrint = useCallback(async () => {
    if (!activeEvent || selectedIds.size === 0) return;

    const count = selectedIds.size;
    Alert.alert(
      'Drukuj zaznaczone',
      `Czy chcesz wydrukować ${count} ${count === 1 ? 'zdjęcie' : count < 5 ? 'zdjęcia' : 'zdjęć'}?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Drukuj',
          onPress: async () => {
            try {
              const printJobs = Array.from(selectedIds).map((photoId) => ({
                photo_id: photoId,
                event_id: activeEvent.id,
                status: 'pending' as const,
                copies: 1,
                paper_size: '10x15',
              }));

              const { error } = await supabase
                .from('print_jobs')
                .insert(printJobs);

              if (error) throw error;

              // Mark photos as printed
              await supabase
                .from('photos')
                .update({ is_printed: true })
                .in('id', Array.from(selectedIds));

              Alert.alert(
                'Sukces',
                `Dodano ${count} ${count === 1 ? 'zdjęcie' : count < 5 ? 'zdjęcia' : 'zdjęć'} do kolejki druku.`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      exitSelectMode();
                      loadPhotos();
                    },
                  },
                ]
              );
            } catch {
              Alert.alert('Błąd', 'Nie udało się dodać do kolejki druku.');
            }
          },
        },
      ]
    );
  }, [activeEvent, selectedIds, exitSelectMode, loadPhotos]);

  // Bulk email: navigate to email compose screen with selected photo IDs
  const handleBulkEmail = useCallback(() => {
    if (selectedIds.size === 0) return;
    router.push({
      pathname: '/email-compose',
      params: {
        photoIds: Array.from(selectedIds).join(','),
        eventName: activeEvent?.name ?? '',
      },
    });
  }, [selectedIds, router, activeEvent]);

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

  const renderPhoto = ({ item }: { item: PhotoRow }) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <Pressable
        onPress={() => {
          if (selectMode) {
            togglePhotoSelection(item.id);
          } else {
            router.push({
              pathname: '/preview',
              params: { photoId: item.id },
            });
          }
        }}
        onLongPress={() => {
          if (!selectMode) {
            setSelectMode(true);
            setSelectedIds(new Set([item.id]));
          }
        }}
        style={({ pressed }) => ({
          width: cardWidth,
          height: cardWidth * 1.25,
          borderRadius: Radius.md,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: Colors.surface,
          opacity: pressed ? 0.85 : 1,
          borderWidth: isSelected ? 2 : 0,
          borderColor: isSelected ? Colors.primary : 'transparent',
        })}
      >
        <Image
          source={{ uri: item.original_url }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
        />

        {/* Selection overlay */}
        {selectMode && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isSelected
                ? 'rgba(200, 169, 110, 0.2)'
                : 'rgba(0, 0, 0, 0.15)',
            }}
          />
        )}

        {/* Checkmark */}
        {selectMode && (
          <View
            style={{
              position: 'absolute',
              top: Spacing.sm,
              right: Spacing.sm,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: isSelected
                ? Colors.primary
                : 'rgba(10, 10, 15, 0.5)',
              borderWidth: isSelected ? 0 : 2,
              borderColor: 'rgba(255, 255, 255, 0.6)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={18} color={Colors.background} />
            )}
          </View>
        )}

        {/* Status overlay */}
        {!selectMode && (
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
        )}
      </Pressable>
    );
  };

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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            {!selectMode && (
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
            )}

            {/* Select / Cancel button */}
            <Pressable
              onPress={selectMode ? exitSelectMode : toggleSelectMode}
              style={{
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                borderRadius: Radius.full,
                backgroundColor: selectMode
                  ? 'rgba(229, 57, 53, 0.12)'
                  : 'rgba(200, 169, 110, 0.12)',
                borderWidth: 1,
                borderColor: selectMode ? Colors.error : Colors.borderGold,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.semiBold,
                  fontSize: 13,
                  color: selectMode ? Colors.error : Colors.primary,
                }}
              >
                {selectMode ? 'Anuluj' : 'Zaznacz'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Select mode header bar */}
        {selectMode && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: Colors.surface,
              borderRadius: Radius.md,
              borderCurve: 'continuous',
              paddingHorizontal: Spacing.lg,
              paddingVertical: Spacing.md,
              borderWidth: 1,
              borderColor: Colors.borderGold,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.semiBold,
                fontSize: 14,
                color: Colors.text,
                fontVariant: ['tabular-nums'],
              }}
            >
              {selectedIds.size} zaznaczonych
            </Text>
            <Pressable
              onPress={toggleSelectAll}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.xs,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.xs,
                borderRadius: Radius.full,
                backgroundColor: allSelected
                  ? 'rgba(229, 57, 53, 0.1)'
                  : 'rgba(200, 169, 110, 0.1)',
              }}
            >
              <Ionicons
                name={allSelected ? 'remove-circle-outline' : 'checkmark-circle-outline'}
                size={16}
                color={allSelected ? Colors.error : Colors.primary}
              />
              <Text
                style={{
                  fontFamily: Fonts.semiBold,
                  fontSize: 12,
                  color: allSelected ? Colors.error : Colors.primary,
                }}
              >
                {allSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Filters (hidden in select mode to save space) */}
        {!selectMode && (
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
        )}
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
          extraData={selectedIds}
          contentContainerStyle={{
            padding: Spacing.lg,
            gap: cardGap,
            paddingBottom: selectMode && selectedIds.size > 0
              ? insets.bottom + 100
              : Spacing.lg,
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

      {/* Bottom action bar — only visible when photos are selected */}
      {selectMode && selectedIds.size > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingTop: Spacing.lg,
            paddingHorizontal: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.md,
            backgroundColor: Colors.surface,
            borderTopWidth: 1,
            borderTopColor: Colors.borderGold,
            flexDirection: 'row',
            gap: Spacing.sm,
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
          }}
        >
          <Pressable
            onPress={handleBulkPrint}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: Spacing.sm,
              height: 52,
              borderRadius: Radius.md,
              borderCurve: 'continuous',
              backgroundColor: Colors.primary,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="print" size={20} color={Colors.background} />
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 14,
                color: Colors.background,
              }}
            >
              Drukuj zaznaczone
            </Text>
          </Pressable>

          <Pressable
            onPress={handleBulkEmail}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: Spacing.sm,
              height: 52,
              borderRadius: Radius.md,
              borderCurve: 'continuous',
              backgroundColor: 'transparent',
              borderWidth: 1.5,
              borderColor: Colors.primary,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="mail" size={20} color={Colors.primary} />
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 14,
                color: Colors.primary,
              }}
            >
              Wyślij na e-mail
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
