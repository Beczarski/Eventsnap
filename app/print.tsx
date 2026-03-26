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
import { EmptyState } from '@/components/empty-state';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import type { PrintJobRow } from '@/lib/database';

const PAPER_SIZES = [
  { id: '10x15', label: '10x15 cm' },
  { id: 'A4', label: 'A4' },
  { id: 'strip', label: 'Strip' },
];

const STATUS_CONFIG: Record<
  string,
  { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  pending: { color: Colors.warning, icon: 'time', label: 'Pending' },
  printing: { color: Colors.primary, icon: 'print', label: 'Printing' },
  done: { color: Colors.success, icon: 'checkmark-circle', label: 'Done' },
  error: { color: Colors.error, icon: 'alert-circle', label: 'Error' },
};

export default function PrintScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeEvent = useAppStore((s) => s.activeEvent);
  const preferences = useAppStore((s) => s.preferences);
  const setPrintSize = useAppStore((s) => s.setPrintSize);

  const [printJobs, setPrintJobs] = useState<PrintJobRow[]>([]);
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSize, setSelectedSize] = useState(
    preferences.lastPrintSize || '10x15'
  );

  const loadPrintJobs = useCallback(async () => {
    if (!activeEvent) return;
    try {
      const { data, error } = await supabase
        .from('print_jobs')
        .select('*')
        .eq('event_id', activeEvent.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrintJobs(data ?? []);
    } catch {
      // Failed to load print jobs
    } finally {
      setLoading(false);
    }
  }, [activeEvent]);

  useEffect(() => {
    loadPrintJobs();
  }, [loadPrintJobs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPrintJobs();
    setRefreshing(false);
  }, [loadPrintJobs]);

  const handleCancelJob = useCallback(
    async (jobId: string) => {
      try {
        await supabase.from('print_jobs').delete().eq('id', jobId);
        setPrintJobs((prev) => prev.filter((j) => j.id !== jobId));
      } catch {
        Alert.alert('Error', 'Failed to cancel print job');
      }
    },
    []
  );

  const handleRetryJob = useCallback(
    async (jobId: string) => {
      try {
        await supabase
          .from('print_jobs')
          .update({ status: 'pending' })
          .eq('id', jobId);
        loadPrintJobs();
      } catch {
        Alert.alert('Error', 'Failed to retry print job');
      }
    },
    [loadPrintJobs]
  );

  // Simulate marking as done (in real app, AirPrint callback)
  const handleMarkDone = useCallback(
    async (jobId: string) => {
      try {
        await supabase
          .from('print_jobs')
          .update({ status: 'done' })
          .eq('id', jobId);
        loadPrintJobs();
      } catch {
        Alert.alert('Error', 'Failed to update job');
      }
    },
    [loadPrintJobs]
  );

  const pendingCount = printJobs.filter((j) => j.status === 'pending').length;
  const printingCount = printJobs.filter((j) => j.status === 'printing').length;
  const doneCount = printJobs.filter((j) => j.status === 'done').length;

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
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </Pressable>
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 24,
              color: Colors.text,
            }}
          >
            Print Queue
          </Text>
        </View>
      </View>

      {/* Printer Status */}
      <View
        style={{
          backgroundColor: Colors.surface,
          borderRadius: Radius.lg,
          borderCurve: 'continuous',
          padding: Spacing.xl,
          borderWidth: 1,
          borderColor: Colors.borderGold,
          marginBottom: Spacing.xxl,
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.lg,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(76, 175, 80, 0.12)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="print" size={24} color={Colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: Fonts.semiBold,
              fontSize: 15,
              color: Colors.text,
            }}
          >
            AirPrint Ready
          </Text>
          <Text
            style={{
              fontFamily: Fonts.regular,
              fontSize: 12,
              color: Colors.textSecondary,
              marginTop: 2,
            }}
          >
            Searching for nearby printers...
          </Text>
        </View>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: Colors.success,
          }}
        />
      </View>

      {/* Print Settings */}
      <View style={{ marginBottom: Spacing.xxl }}>
        <Text
          style={{
            fontFamily: Fonts.semiBold,
            fontSize: 14,
            color: Colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: Spacing.md,
          }}
        >
          Default Paper Size
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {PAPER_SIZES.map((size) => (
            <Pressable
              key={size.id}
              onPress={() => {
                setSelectedSize(size.id);
                setPrintSize(size.id);
              }}
              style={{
                flex: 1,
                paddingVertical: Spacing.md,
                backgroundColor:
                  selectedSize === size.id
                    ? 'rgba(200, 169, 110, 0.15)'
                    : Colors.surface,
                borderRadius: Radius.md,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor:
                  selectedSize === size.id ? Colors.primary : Colors.border,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.semiBold,
                  fontSize: 13,
                  color:
                    selectedSize === size.id
                      ? Colors.primary
                      : Colors.textMuted,
                }}
              >
                {size.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Stats row */}
      <View
        style={{
          flexDirection: 'row',
          gap: Spacing.sm,
          marginBottom: Spacing.xxl,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: Colors.surface,
            borderRadius: Radius.md,
            borderCurve: 'continuous',
            padding: Spacing.md,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 20,
              color: Colors.warning,
              fontVariant: ['tabular-nums'],
            }}
          >
            {pendingCount}
          </Text>
          <Text
            style={{
              fontFamily: Fonts.medium,
              fontSize: 11,
              color: Colors.textSecondary,
            }}
          >
            Pending
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: Colors.surface,
            borderRadius: Radius.md,
            borderCurve: 'continuous',
            padding: Spacing.md,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 20,
              color: Colors.primary,
              fontVariant: ['tabular-nums'],
            }}
          >
            {printingCount}
          </Text>
          <Text
            style={{
              fontFamily: Fonts.medium,
              fontSize: 11,
              color: Colors.textSecondary,
            }}
          >
            Printing
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: Colors.surface,
            borderRadius: Radius.md,
            borderCurve: 'continuous',
            padding: Spacing.md,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 20,
              color: Colors.success,
              fontVariant: ['tabular-nums'],
            }}
          >
            {doneCount}
          </Text>
          <Text
            style={{
              fontFamily: Fonts.medium,
              fontSize: 11,
              color: Colors.textSecondary,
            }}
          >
            Done
          </Text>
        </View>
      </View>

      {/* Print Jobs List */}
      <Text
        style={{
          fontFamily: Fonts.bold,
          fontSize: 18,
          color: Colors.text,
          marginBottom: Spacing.lg,
        }}
      >
        Print History
      </Text>

      {printJobs.length === 0 ? (
        <EmptyState
          icon="print-outline"
          title="No Print Jobs"
          subtitle="Print jobs will appear here when you print photos"
        />
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {printJobs.map((job) => {
            const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
            return (
              <View
                key={job.id}
                style={{
                  backgroundColor: Colors.surface,
                  borderRadius: Radius.md,
                  borderCurve: 'continuous',
                  padding: Spacing.lg,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.md,
                }}
              >
                <Ionicons name={config.icon} size={22} color={config.color} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.semiBold,
                      fontSize: 14,
                      color: Colors.text,
                    }}
                  >
                    {config.label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.regular,
                      fontSize: 12,
                      color: Colors.textSecondary,
                    }}
                  >
                    {job.paper_size} \u2022 {job.copies}{' '}
                    {job.copies === 1 ? 'copy' : 'copies'}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: Fonts.regular,
                    fontSize: 11,
                    color: Colors.textMuted,
                  }}
                >
                  {new Date(job.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>

                {/* Actions */}
                {job.status === 'pending' && (
                  <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
                    <Pressable
                      onPress={() => handleMarkDone(job.id)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: 'rgba(76, 175, 80, 0.12)',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={Colors.success}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => handleCancelJob(job.id)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: 'rgba(229, 57, 53, 0.12)',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons
                        name="close"
                        size={16}
                        color={Colors.error}
                      />
                    </Pressable>
                  </View>
                )}
                {job.status === 'error' && (
                  <Pressable
                    onPress={() => handleRetryJob(job.id)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: 'rgba(200, 169, 110, 0.12)',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons
                      name="refresh"
                      size={16}
                      color={Colors.primary}
                    />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
