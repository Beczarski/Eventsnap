import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { Colors } from '@/constants/Theme';

export default function Index() {
  const router = useRouter();
  const activeEvent = useAppStore((s) => s.activeEvent);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeEvent && activeEvent.is_active) {
        router.replace('/(tabs)/camera');
      } else {
        router.replace('/setup');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeEvent, router]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}
