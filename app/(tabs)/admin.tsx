import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';
import { StatCard } from '@/components/stat-card';
import { GoldButton } from '@/components/gold-button';
import { EmptyState } from '@/components/empty-state';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import type { EventRow } from '@/lib/database';

interface EventStats {
  photoCount: number;
  printCount: number;
  shareCount: number;
}

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeEvent = useAppStore((s) => s.activeEvent);
  const setActiveEvent = useAppStore((s) => s.setActiveEvent);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [stats, setStats] = useState<EventStats>({
    photoCount: 0,
    printCount: 0,
    shareCount: 0,
  });
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Load all events
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      setEvents(eventsData ?? []);

      // Load stats for active event
      if (activeEvent) {
        const [photosResult, printsResult, sharesResult] = await Promise.all([
          supabase
            .from('photos')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', activeEvent.id),
          supabase
            .from('print_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', activeEvent.id)
            .eq('status', 'done'),
          supabase
            .from('shares')
            .select('photo_id', { count: 'exact', head: true })
            .in(
              'photo_id',
              (
                await supabase
                  .from('photos')
                  .select('id')
                  .eq('event_id', activeEvent.id)
              ).data?.map((p) => p.id) ?? []
            ),
        ]);

        setStats({
          photoCount: photosResult.count ?? 0,
          printCount: printsResult.count ?? 0,
          shareCount: sharesResult.count ?? 0,
        });
      }
    } catch {
      // Failed to load admin data
    } finally {
      setLoading(false);
    }
  }, [activeEvent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleArchiveEvent = useCallback(
    async (eventId: string) => {
      Alert.alert(
        'Archive Event',
        'Are you sure you want to archive this event?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            style: 'destructive',
            onPress: async () => {
              try {
                await supabase
                  .from('events')
                  .update({ is_active: false, is_archived: true })
                  .eq('id', eventId);

                if (activeEvent?.id === eventId) {
                  setActiveEvent(null);
                }
                loadData();
              } catch {
                Alert.alert('Error', 'Failed to archive event');
              }
            },
          },
        ]
      );
    },
    [activeEvent, setActiveEvent, loadData]
  );

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      Alert.alert(
        'Delete Event',
        'This will permanently delete the event and all its photos. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await supabase.from('events').delete().eq('id', eventId);
                if (activeEvent?.id === eventId) {
                  setActiveEvent(null);
                }
                loadData();
              } catch {
                Alert.alert('Error', 'Failed to delete event');
              }
            },
          },
        ]
      );
    },
    [activeEvent, setActiveEvent, loadData]
  );

  const handleActivateEvent = useCallback(
    async (event: EventRow) => {
      try {
        // Deactivate all events
        await supabase.from('events').update({ is_active: false }).eq('is_active', true);
        // Activate selected
        const { data } = await supabase
          .from('events')
          .update({ is_active: true, is_archived: false })
          .eq('id', event.id)
          .select()
          .single();

        if (data) {
          setActiveEvent(data);
        }
        loadData();
      } catch {
        Alert.alert('Error', 'Failed to activate event');
      }
    },
    [setActiveEvent, loadData]
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: insets.bottom + Spacing.huge,
        paddingHorizontal: Spacing.lg,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
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
        <Text
          style={{
            fontFamily: Fonts.bold,
            fontSize: 24,
            color: Colors.text,
          }}
        >
          Admin Panel
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Pressable
            onPress={() => router.push('/print')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: Colors.surface,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Ionicons name="print" size={20} color={Colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/setup')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: Colors.primary,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="add" size={22} color={Colors.background} />
          </Pressable>
        </View>
      </View>

      {/* Active Event Stats */}
      {activeEvent && (
        <View style={{ marginBottom: Spacing.xxxl }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
              marginBottom: Spacing.lg,
            }}
          >
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
                fontFamily: Fonts.semiBold,
                fontSize: 14,
                color: Colors.success,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Active Event
            </Text>
          </View>

          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: Radius.lg,
              borderCurve: 'continuous',
              padding: Spacing.xl,
              borderWidth: 1,
              borderColor: Colors.borderGold,
              marginBottom: Spacing.lg,
            }}
          >
            <Text
              selectable
              style={{
                fontFamily: Fonts.bold,
                fontSize: 20,
                color: Colors.text,
                marginBottom: Spacing.xs,
              }}
            >
              {activeEvent.name}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                gap: Spacing.lg,
                marginTop: Spacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.xs,
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={Colors.textSecondary}
                />
                <Text
                  selectable
                  style={{
                    fontFamily: Fonts.regular,
                    fontSize: 13,
                    color: Colors.textSecondary,
                  }}
                >
                  {activeEvent.date}
                </Text>
              </View>
              {activeEvent.location && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: Spacing.xs,
                  }}
                >
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={Colors.textSecondary}
                  />
                  <Text
                    selectable
                    style={{
                      fontFamily: Fonts.regular,
                      fontSize: 13,
                      color: Colors.textSecondary,
                    }}
                  >
                    {activeEvent.location}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Stats */}
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <StatCard
              icon="camera"
              label="Photos"
              value={stats.photoCount}
            />
            <StatCard
              icon="print"
              label="Printed"
              value={stats.printCount}
              color={Colors.success}
            />
            <StatCard
              icon="share"
              label="Shared"
              value={stats.shareCount}
              color={Colors.accent}
            />
          </View>
        </View>
      )}

      {/* All Events */}
      <View style={{ gap: Spacing.lg }}>
        <Text
          style={{
            fontFamily: Fonts.bold,
            fontSize: 18,
            color: Colors.text,
          }}
        >
          All Events
        </Text>

        {events.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No Events"
            subtitle="Create your first event to get started"
            action={
              <GoldButton
                title="Create Event"
                onPress={() => router.push('/setup')}
                variant="outline"
              />
            }
          />
        ) : (
          events.map((event) => (
            <View
              key={event.id}
              style={{
                backgroundColor: Colors.surface,
                borderRadius: Radius.lg,
                borderCurve: 'continuous',
                padding: Spacing.lg,
                borderWidth: 1,
                borderColor:
                  event.id === activeEvent?.id
                    ? Colors.borderGold
                    : Colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: Spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: Spacing.sm,
                    }}
                  >
                    <Text
                      selectable
                      style={{
                        fontFamily: Fonts.semiBold,
                        fontSize: 16,
                        color: Colors.text,
                      }}
                    >
                      {event.name}
                    </Text>
                    {event.is_active && (
                      <View
                        style={{
                          backgroundColor: 'rgba(76, 175, 80, 0.15)',
                          paddingHorizontal: Spacing.sm,
                          paddingVertical: 2,
                          borderRadius: Radius.full,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: Fonts.semiBold,
                            fontSize: 10,
                            color: Colors.success,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          Active
                        </Text>
                      </View>
                    )}
                    {event.is_archived && (
                      <View
                        style={{
                          backgroundColor: 'rgba(155, 155, 155, 0.15)',
                          paddingHorizontal: Spacing.sm,
                          paddingVertical: 2,
                          borderRadius: Radius.full,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: Fonts.semiBold,
                            fontSize: 10,
                            color: Colors.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          Archived
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    selectable
                    style={{
                      fontFamily: Fonts.regular,
                      fontSize: 13,
                      color: Colors.textSecondary,
                      marginTop: Spacing.xs,
                    }}
                  >
                    {event.date}
                    {event.location ? ` \u2022 ${event.location}` : ''}
                  </Text>
                </View>
              </View>

              {/* Event actions */}
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                {!event.is_active && (
                  <Pressable
                    onPress={() => handleActivateEvent(event)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: Spacing.xs,
                      paddingVertical: Spacing.sm,
                      backgroundColor: 'rgba(76, 175, 80, 0.1)',
                      borderRadius: Radius.sm,
                      borderCurve: 'continuous',
                    }}
                  >
                    <Ionicons name="play" size={14} color={Colors.success} />
                    <Text
                      style={{
                        fontFamily: Fonts.semiBold,
                        fontSize: 12,
                        color: Colors.success,
                      }}
                    >
                      Activate
                    </Text>
                  </Pressable>
                )}
                {!event.is_archived && (
                  <Pressable
                    onPress={() => handleArchiveEvent(event.id)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: Spacing.xs,
                      paddingVertical: Spacing.sm,
                      backgroundColor: 'rgba(255, 152, 0, 0.1)',
                      borderRadius: Radius.sm,
                      borderCurve: 'continuous',
                    }}
                  >
                    <Ionicons
                      name="archive"
                      size={14}
                      color={Colors.warning}
                    />
                    <Text
                      style={{
                        fontFamily: Fonts.semiBold,
                        fontSize: 12,
                        color: Colors.warning,
                      }}
                    >
                      Archive
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => handleDeleteEvent(event.id)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: Spacing.xs,
                    paddingVertical: Spacing.sm,
                    backgroundColor: 'rgba(229, 57, 53, 0.1)',
                    borderRadius: Radius.sm,
                    borderCurve: 'continuous',
                  }}
                >
                  <Ionicons name="trash" size={14} color={Colors.error} />
                  <Text
                    style={{
                      fontFamily: Fonts.semiBold,
                      fontSize: 12,
                      color: Colors.error,
                    }}
                  >
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
