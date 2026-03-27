import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Fonts } from '@/constants/Typography';
import { GoldButton } from '@/components/gold-button';
import { GoldInput } from '@/components/gold-input';
import { EmptyState } from '@/components/empty-state';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import type { CanonCameraRow } from '@/lib/database';
import {
  getCameraInfo,
  triggerShutter,
  getShootingSettings,
  getLiveViewUrl,
  startLiveView,
  listContents,
  downloadPhoto,
  detectModel,
  scanLocalNetwork,
  type CameraInfo,
  type ConnectionStatus,
  type ExposureSettings,
} from '@/lib/canon-ccapi';

const CANON_MODELS = [
  { id: 'EOS R3', label: 'EOS R3' },
  { id: 'EOS R5 Mark II', label: 'R5 Mark II' },
  { id: 'EOS R8', label: 'EOS R8' },
  { id: 'EOS R6 Mark II', label: 'R6 Mark II' },
  { id: 'EOS R5', label: 'EOS R5' },
];

export default function CanonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeEvent = useAppStore((s) => s.activeEvent);
  const addPhoto = useAppStore((s) => s.addPhoto);

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [cameraIp, setCameraIp] = useState('');
  const [cameraInfo, setCameraInfo] = useState<CameraInfo | null>(null);
  const [savedCameras, setSavedCameras] = useState<CanonCameraRow[]>([]);

  // Live view
  const [liveViewActive, setLiveViewActive] = useState(false);
  const [liveViewFrame, setLiveViewFrame] = useState<string | null>(null);
  const liveViewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Shooting controls
  const [exposure, setExposure] = useState<ExposureSettings>({});
  const [shooting, setShooting] = useState(false);

  // Auto-import
  const [autoImport, setAutoImport] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const knownPhotosRef = useRef<Set<string>>(new Set());
  const autoImportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scanning
  const [scanning, setScanning] = useState(false);
  const [discoveredCameras, setDiscoveredCameras] = useState<
    { ip: string; info: CameraInfo }[]
  >([]);

  const loadSavedCameras = useCallback(async () => {
    if (!activeEvent) return;
    try {
      const { data } = await supabase
        .from('canon_cameras')
        .select('*')
        .eq('event_id', activeEvent.id)
        .order('last_connected', { ascending: false });
      setSavedCameras(data ?? []);
    } catch {
      // Silently fail
    }
  }, [activeEvent]);

  // Load saved cameras on mount
  useEffect(() => {
    if (activeEvent) {
      loadSavedCameras();
    }
  }, [activeEvent, loadSavedCameras]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (liveViewIntervalRef.current) clearInterval(liveViewIntervalRef.current);
      if (autoImportIntervalRef.current) clearInterval(autoImportIntervalRef.current);
    };
  }, []);

  const handleConnect = useCallback(
    async (ip?: string) => {
      const targetIp = ip || cameraIp.trim();
      if (!targetIp) {
        Alert.alert('Missing IP', 'Please enter the camera IP address');
        return;
      }
      if (!activeEvent) {
        Alert.alert('No Event', 'Please create an event first');
        return;
      }

      setConnectionStatus('connecting');
      try {
        const info = await getCameraInfo(targetIp);
        setCameraInfo(info);
        setCameraIp(targetIp);
        setConnectionStatus('connected');

        const model = detectModel(info);

        // Save/update camera in database
        const existing = savedCameras.find((c) => c.ip_address === targetIp);
        if (existing) {
          await supabase
            .from('canon_cameras')
            .update({ last_connected: new Date().toISOString(), model })
            .eq('id', existing.id);
        } else {
          await supabase.from('canon_cameras').insert({
            event_id: activeEvent.id,
            model,
            ip_address: targetIp,
            nickname: info.productname || model,
            last_connected: new Date().toISOString(),
          });
        }
        loadSavedCameras();

        // Load shooting settings
        const settings = await getShootingSettings(targetIp);
        setExposure(settings);

        // Initialize known photos set for auto-import
        const existingPhotos = await listContents(targetIp);
        knownPhotosRef.current = new Set(existingPhotos);
      } catch {
        setConnectionStatus('error');
        Alert.alert(
          'Connection Failed',
          `Could not connect to Canon camera at ${targetIp}. Make sure:\n\n1. Camera WiFi is enabled\n2. CCAPI is activated\n3. You are on the same WiFi network`
        );
      }
    },
    [cameraIp, activeEvent, savedCameras, loadSavedCameras]
  );

  const handleDisconnect = useCallback(() => {
    setConnectionStatus('disconnected');
    setCameraInfo(null);
    setLiveViewActive(false);
    setLiveViewFrame(null);
    setAutoImport(false);
    if (liveViewIntervalRef.current) {
      clearInterval(liveViewIntervalRef.current);
      liveViewIntervalRef.current = null;
    }
    if (autoImportIntervalRef.current) {
      clearInterval(autoImportIntervalRef.current);
      autoImportIntervalRef.current = null;
    }
  }, []);

  const handleToggleLiveView = useCallback(async () => {
    if (!cameraIp) return;

    if (liveViewActive) {
      setLiveViewActive(false);
      setLiveViewFrame(null);
      if (liveViewIntervalRef.current) {
        clearInterval(liveViewIntervalRef.current);
        liveViewIntervalRef.current = null;
      }
    } else {
      try {
        await startLiveView(cameraIp);
        setLiveViewActive(true);

        // Poll live view frames — the CCAPI flip endpoint returns the latest JPEG
        const pollFrame = () => {
          const url = getLiveViewUrl(cameraIp);
          setLiveViewFrame(`${url}?t=${Date.now()}`);
        };
        pollFrame();
        liveViewIntervalRef.current = setInterval(pollFrame, 500);
      } catch {
        Alert.alert('Live View Error', 'Could not start live view');
      }
    }
  }, [cameraIp, liveViewActive]);

  const handleAutoImportCheck = useCallback(async () => {
    if (!cameraIp || !activeEvent || importing) return;
    setImporting(true);
    try {
      const allUrls = await listContents(cameraIp);
      const newUrls = allUrls.filter((url) => !knownPhotosRef.current.has(url));

      for (const photoUrl of newUrls) {
        try {
          const blob = await downloadPhoto(photoUrl);
          const filename = `${activeEvent.id}/canon_${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('event-photos')
            .upload(filename, blob, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (uploadError) continue;

          const { data: urlData } = supabase.storage
            .from('event-photos')
            .getPublicUrl(filename);

          const { data: photo } = await supabase
            .from('photos')
            .insert({
              event_id: activeEvent.id,
              original_url: urlData.publicUrl,
              source: 'canon_import',
            })
            .select()
            .single();

          if (photo) {
            addPhoto(photo);
            setImportedCount((c) => c + 1);
          }

          knownPhotosRef.current.add(photoUrl);
        } catch {
          // Skip individual photo failures
        }
      }
    } catch {
      // Failed to poll camera
    } finally {
      setImporting(false);
    }
  }, [cameraIp, activeEvent, importing, addPhoto]);

  const handleRemoteShutter = useCallback(async () => {
    if (connectionStatus !== 'connected') return;
    setShooting(true);
    try {
      await triggerShutter(cameraIp);

      // Brief delay then check for new photos if auto-import is on
      if (autoImport) {
        setTimeout(() => handleAutoImportCheck(), 2000);
      }
    } catch (err: any) {
      Alert.alert('Shutter Error', err.message || 'Failed to trigger shutter');
    } finally {
      setShooting(false);
    }
  }, [connectionStatus, cameraIp, autoImport, handleAutoImportCheck]);

  const handleToggleAutoImport = useCallback(() => {
    if (autoImport) {
      setAutoImport(false);
      if (autoImportIntervalRef.current) {
        clearInterval(autoImportIntervalRef.current);
        autoImportIntervalRef.current = null;
      }
    } else {
      setAutoImport(true);
      handleAutoImportCheck();
      autoImportIntervalRef.current = setInterval(handleAutoImportCheck, 5000);
    }
  }, [autoImport, handleAutoImportCheck]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setDiscoveredCameras([]);
    try {
      const found = await scanLocalNetwork('192.168.1', 1, 30);
      if (found.length === 0) {
        // Try another common subnet
        const found2 = await scanLocalNetwork('192.168.0', 1, 30);
        setDiscoveredCameras([...found, ...found2]);
      } else {
        setDiscoveredCameras(found);
      }
      if (found.length === 0) {
        Alert.alert(
          'No Cameras Found',
          'Make sure the Canon camera has WiFi enabled with CCAPI active, and both devices are on the same network.'
        );
      }
    } catch {
      Alert.alert('Scan Error', 'Failed to scan the network');
    } finally {
      setScanning(false);
    }
  }, []);

  // No active event state
  if (!activeEvent) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <EmptyState
          icon="wifi-outline"
          title="No Active Event"
          subtitle="Create an event first to connect a Canon camera"
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

  // Connected state UI
  if (connectionStatus === 'connected' && cameraInfo) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + Spacing.md,
            paddingBottom: insets.bottom + Spacing.huge,
            paddingHorizontal: Spacing.lg,
            gap: Spacing.lg,
          }}
        >
          {/* Connection Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: Fonts.bold,
                  fontSize: 22,
                  color: Colors.text,
                }}
              >
                Canon {detectModel(cameraInfo)}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.sm,
                  marginTop: Spacing.xs,
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
                  selectable
                  style={{
                    fontFamily: Fonts.medium,
                    fontSize: 13,
                    color: Colors.success,
                  }}
                >
                  Connected \u2022 {cameraIp}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleDisconnect}
              style={{
                paddingHorizontal: Spacing.lg,
                paddingVertical: Spacing.sm,
                backgroundColor: 'rgba(229, 57, 53, 0.12)',
                borderRadius: Radius.full,
                borderWidth: 1,
                borderColor: 'rgba(229, 57, 53, 0.3)',
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.semiBold,
                  fontSize: 12,
                  color: Colors.error,
                }}
              >
                Disconnect
              </Text>
            </Pressable>
          </View>

          {/* Live View / Remote Shutter Area */}
          <View
            style={{
              backgroundColor: Colors.secondary,
              borderRadius: Radius.xl,
              borderCurve: 'continuous',
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: Colors.border,
              minHeight: 280,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {liveViewActive && liveViewFrame ? (
              <Image
                source={{ uri: liveViewFrame }}
                style={{ width: '100%', height: 280 }}
                contentFit="contain"
                cachePolicy="none"
              />
            ) : (
              <View style={{ alignItems: 'center', gap: Spacing.md, padding: Spacing.xl }}>
                <Ionicons name="videocam-outline" size={48} color={Colors.textMuted} />
                <Text
                  style={{
                    fontFamily: Fonts.medium,
                    fontSize: 14,
                    color: Colors.textSecondary,
                    textAlign: 'center',
                  }}
                >
                  {liveViewActive ? 'Loading live view...' : 'Live view off'}
                </Text>
              </View>
            )}

            {/* Gold corner decorations */}
            {(['top', 'bottom'] as const).map((v) =>
              (['left', 'right'] as const).map((h) => (
                <View
                  key={`${v}-${h}`}
                  style={{
                    position: 'absolute',
                    [v]: Spacing.md,
                    [h]: Spacing.md,
                    width: 28,
                    height: 28,
                    [`border${v === 'top' ? 'Top' : 'Bottom'}Width` as any]: 2,
                    [`border${h === 'left' ? 'Left' : 'Right'}Width` as any]: 2,
                    borderColor: Colors.primary,
                    [`border${v === 'top' ? 'Top' : 'Bottom'}${h === 'left' ? 'Left' : 'Right'}Radius` as any]: Radius.sm,
                  }}
                />
              ))
            )}
          </View>

          {/* Control buttons row */}
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <Pressable
              onPress={handleToggleLiveView}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: Spacing.sm,
                paddingVertical: Spacing.md,
                backgroundColor: liveViewActive
                  ? 'rgba(76, 175, 80, 0.15)'
                  : Colors.surface,
                borderRadius: Radius.md,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: liveViewActive ? Colors.success : Colors.border,
              }}
            >
              <Ionicons
                name={liveViewActive ? 'videocam' : 'videocam-outline'}
                size={18}
                color={liveViewActive ? Colors.success : Colors.textMuted}
              />
              <Text
                style={{
                  fontFamily: Fonts.semiBold,
                  fontSize: 12,
                  color: liveViewActive ? Colors.success : Colors.textMuted,
                }}
              >
                Live View
              </Text>
            </Pressable>

            <Pressable
              onPress={handleToggleAutoImport}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: Spacing.sm,
                paddingVertical: Spacing.md,
                backgroundColor: autoImport
                  ? 'rgba(200, 169, 110, 0.15)'
                  : Colors.surface,
                borderRadius: Radius.md,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: autoImport ? Colors.primary : Colors.border,
              }}
            >
              <Ionicons
                name={autoImport ? 'cloud-download' : 'cloud-download-outline'}
                size={18}
                color={autoImport ? Colors.primary : Colors.textMuted}
              />
              <Text
                style={{
                  fontFamily: Fonts.semiBold,
                  fontSize: 12,
                  color: autoImport ? Colors.primary : Colors.textMuted,
                }}
              >
                Auto-Import{importedCount > 0 ? ` (${importedCount})` : ''}
              </Text>
            </Pressable>
          </View>

          {/* Remote Shutter Button */}
          <View style={{ alignItems: 'center', paddingVertical: Spacing.md }}>
            <Pressable
              onPress={handleRemoteShutter}
              disabled={shooting}
              style={({ pressed }) => ({
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: pressed ? Colors.accent : Colors.primary,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 5,
                borderColor: 'rgba(200, 169, 110, 0.3)',
                boxShadow: '0 4px 24px rgba(200, 169, 110, 0.5)',
                transform: [{ scale: pressed ? 0.9 : 1 }],
                opacity: shooting ? 0.6 : 1,
              })}
            >
              {shooting ? (
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <View
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    borderWidth: 3,
                    borderColor: Colors.background,
                  }}
                />
              )}
            </Pressable>
            <Text
              style={{
                fontFamily: Fonts.medium,
                fontSize: 12,
                color: Colors.textSecondary,
                marginTop: Spacing.sm,
              }}
            >
              Remote Shutter
            </Text>
          </View>

          {/* Exposure Settings */}
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: Radius.lg,
              borderCurve: 'continuous',
              padding: Spacing.lg,
              borderWidth: 1,
              borderColor: Colors.border,
              gap: Spacing.md,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 15,
                color: Colors.text,
              }}
            >
              Exposure Settings
            </Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <ExposureChip
                label="ISO"
                value={exposure.iso ?? '--'}
                icon="sunny-outline"
              />
              <ExposureChip
                label="Aperture"
                value={exposure.av ? `f/${exposure.av}` : '--'}
                icon="aperture-outline"
              />
              <ExposureChip
                label="Shutter"
                value={exposure.tv ?? '--'}
                icon="timer-outline"
              />
            </View>
            <Text
              style={{
                fontFamily: Fonts.regular,
                fontSize: 11,
                color: Colors.textMuted,
              }}
            >
              Settings are read from camera. Change exposure on the camera body or via CCAPI when supported.
            </Text>
          </View>

          {/* Camera Details */}
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: Radius.lg,
              borderCurve: 'continuous',
              padding: Spacing.lg,
              borderWidth: 1,
              borderColor: Colors.border,
              gap: Spacing.sm,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 15,
                color: Colors.text,
                marginBottom: Spacing.xs,
              }}
            >
              Camera Details
            </Text>
            {cameraInfo.serialnumber && (
              <DetailRow label="Serial" value={cameraInfo.serialnumber} />
            )}
            {cameraInfo.firmwareversion && (
              <DetailRow label="Firmware" value={cameraInfo.firmwareversion} />
            )}
            {cameraInfo.macaddress && (
              <DetailRow label="MAC" value={cameraInfo.macaddress} />
            )}
            <DetailRow label="IP Address" value={cameraIp} />
          </View>

          {/* Import status */}
          {importing && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.sm,
                padding: Spacing.md,
                backgroundColor: 'rgba(200, 169, 110, 0.08)',
                borderRadius: Radius.md,
                borderCurve: 'continuous',
              }}
            >
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text
                style={{
                  fontFamily: Fonts.medium,
                  fontSize: 13,
                  color: Colors.primary,
                }}
              >
                Importing photos from camera...
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // Disconnected / pairing state
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: insets.bottom + Spacing.huge,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.xxl,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View>
        <Text
          style={{
            fontFamily: Fonts.bold,
            fontSize: 24,
            color: Colors.text,
          }}
        >
          Canon WiFi
        </Text>
        <Text
          style={{
            fontFamily: Fonts.regular,
            fontSize: 14,
            color: Colors.textSecondary,
            marginTop: Spacing.xs,
          }}
        >
          Connect to a Canon camera via CCAPI
        </Text>
      </View>

      {/* Connection status banner */}
      {connectionStatus === 'error' && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
            padding: Spacing.lg,
            backgroundColor: 'rgba(229, 57, 53, 0.08)',
            borderRadius: Radius.lg,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: 'rgba(229, 57, 53, 0.2)',
          }}
        >
          <Ionicons name="alert-circle" size={22} color={Colors.error} />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: Fonts.semiBold,
                fontSize: 14,
                color: Colors.error,
              }}
            >
              Connection Failed
            </Text>
            <Text
              style={{
                fontFamily: Fonts.regular,
                fontSize: 12,
                color: Colors.textSecondary,
                marginTop: 2,
              }}
            >
              Check camera WiFi and CCAPI settings
            </Text>
          </View>
        </View>
      )}

      {connectionStatus === 'connecting' && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
            padding: Spacing.lg,
            backgroundColor: 'rgba(200, 169, 110, 0.08)',
            borderRadius: Radius.lg,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: Colors.borderGold,
          }}
        >
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text
            style={{
              fontFamily: Fonts.semiBold,
              fontSize: 14,
              color: Colors.primary,
            }}
          >
            Connecting to camera...
          </Text>
        </View>
      )}

      {/* Manual IP entry */}
      <View
        style={{
          backgroundColor: Colors.surface,
          borderRadius: Radius.lg,
          borderCurve: 'continuous',
          padding: Spacing.xl,
          borderWidth: 1,
          borderColor: Colors.border,
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
            <Ionicons name="link" size={18} color={Colors.primary} />
          </View>
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 16,
              color: Colors.text,
            }}
          >
            Manual Connection
          </Text>
        </View>

        <GoldInput
          label="Camera IP Address"
          value={cameraIp}
          onChangeText={setCameraIp}
          placeholder="192.168.1.100"
          icon="globe-outline"
          keyboardType="numeric"
        />

        <GoldButton
          title="Connect"
          onPress={() => handleConnect()}
          loading={connectionStatus === 'connecting'}
          icon={<Ionicons name="wifi" size={18} color={Colors.background} />}
        />
      </View>

      {/* Auto-discover */}
      <View
        style={{
          backgroundColor: Colors.surface,
          borderRadius: Radius.lg,
          borderCurve: 'continuous',
          padding: Spacing.xl,
          borderWidth: 1,
          borderColor: Colors.border,
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
            <Ionicons name="search" size={18} color={Colors.primary} />
          </View>
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 16,
              color: Colors.text,
            }}
          >
            Auto-Discover
          </Text>
        </View>

        <GoldButton
          title={scanning ? 'Scanning...' : 'Scan Local Network'}
          onPress={handleScan}
          loading={scanning}
          variant="outline"
          icon={<Ionicons name="scan-outline" size={18} color={Colors.primary} />}
        />

        {discoveredCameras.length > 0 && (
          <View style={{ gap: Spacing.sm }}>
            {discoveredCameras.map((cam) => (
              <Pressable
                key={cam.ip}
                onPress={() => handleConnect(cam.ip)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.md,
                  padding: Spacing.md,
                  backgroundColor: pressed
                    ? 'rgba(200, 169, 110, 0.1)'
                    : Colors.surfaceLight,
                  borderRadius: Radius.md,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: Colors.borderGold,
                })}
              >
                <Ionicons name="camera" size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.semiBold,
                      fontSize: 14,
                      color: Colors.text,
                    }}
                  >
                    {detectModel(cam.info)}
                  </Text>
                  <Text
                    selectable
                    style={{
                      fontFamily: Fonts.regular,
                      fontSize: 12,
                      color: Colors.textSecondary,
                    }}
                  >
                    {cam.ip}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Saved cameras */}
      {savedCameras.length > 0 && (
        <View style={{ gap: Spacing.md }}>
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 18,
              color: Colors.text,
            }}
          >
            Saved Cameras
          </Text>
          {savedCameras.map((cam) => (
            <Pressable
              key={cam.id}
              onPress={() => {
                setCameraIp(cam.ip_address);
                handleConnect(cam.ip_address);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.md,
                padding: Spacing.lg,
                backgroundColor: pressed
                  ? 'rgba(200, 169, 110, 0.08)'
                  : Colors.surface,
                borderRadius: Radius.lg,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: Colors.border,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(200, 169, 110, 0.1)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="camera" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: Fonts.semiBold,
                    fontSize: 15,
                    color: Colors.text,
                  }}
                >
                  {cam.nickname || cam.model}
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
                  {cam.ip_address} \u2022 {cam.model}
                </Text>
                {cam.last_connected && (
                  <Text
                    style={{
                      fontFamily: Fonts.regular,
                      fontSize: 11,
                      color: Colors.textMuted,
                      marginTop: 2,
                    }}
                  >
                    Last: {new Date(cam.last_connected).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          ))}
        </View>
      )}

      {/* Supported Models Info */}
      <View
        style={{
          backgroundColor: Colors.surface,
          borderRadius: Radius.lg,
          borderCurve: 'continuous',
          padding: Spacing.xl,
          borderWidth: 1,
          borderColor: Colors.border,
          gap: Spacing.md,
        }}
      >
        <Text
          style={{
            fontFamily: Fonts.bold,
            fontSize: 15,
            color: Colors.text,
          }}
        >
          Supported Models
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
          {CANON_MODELS.map((m) => (
            <View
              key={m.id}
              style={{
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                backgroundColor: 'rgba(200, 169, 110, 0.08)',
                borderRadius: Radius.full,
                borderWidth: 1,
                borderColor: Colors.borderGold,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.medium,
                  fontSize: 12,
                  color: Colors.accent,
                }}
              >
                {m.label}
              </Text>
            </View>
          ))}
        </View>
        <Text
          style={{
            fontFamily: Fonts.regular,
            fontSize: 12,
            color: Colors.textMuted,
            lineHeight: 18,
          }}
        >
          Enable CCAPI on your Canon camera via WiFi settings. Connect camera and iPad to the same WiFi network.
        </Text>
      </View>
    </ScrollView>
  );
}

function ExposureChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        gap: Spacing.xs,
        padding: Spacing.md,
        backgroundColor: Colors.surfaceLight,
        borderRadius: Radius.md,
        borderCurve: 'continuous',
      }}
    >
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text
        selectable
        style={{
          fontFamily: Fonts.bold,
          fontSize: 14,
          color: Colors.text,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: Fonts.medium,
          fontSize: 10,
          color: Colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
      }}
    >
      <Text
        style={{
          fontFamily: Fonts.medium,
          fontSize: 13,
          color: Colors.textSecondary,
        }}
      >
        {label}
      </Text>
      <Text
        selectable
        style={{
          fontFamily: Fonts.regular,
          fontSize: 13,
          color: Colors.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
