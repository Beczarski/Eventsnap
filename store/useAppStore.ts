import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Preferences, EventRow, PhotoRow, EmailSettingsRow } from './types';

interface AppState {
  preferences: Preferences;
  activeEvent: EventRow | null;
  photos: PhotoRow[];
  emailSettings: EmailSettingsRow | null;
  setActiveEvent: (event: EventRow | null) => void;
  setActiveEventId: (id: string | undefined) => void;
  setPhotos: (photos: PhotoRow[]) => void;
  addPhoto: (photo: PhotoRow) => void;
  removePhoto: (id: string) => void;
  updatePhoto: (id: string, updates: Partial<PhotoRow>) => void;
  setPrintSize: (size: string) => void;
  setDefaultCopies: (copies: number) => void;
  setEmailSettings: (settings: EmailSettingsRow | null) => void;
}

export type AppStore = AppState;

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      preferences: {
        lastPrintSize: '10x15',
        defaultCopies: 1,
      },
      activeEvent: null,
      photos: [],
      emailSettings: null,
      setActiveEvent: (event) =>
        set((state) => ({
          activeEvent: event,
          preferences: { ...state.preferences, activeEventId: event?.id },
        })),
      setActiveEventId: (id) =>
        set((state) => ({
          preferences: { ...state.preferences, activeEventId: id },
        })),
      setPhotos: (photos) => set({ photos }),
      addPhoto: (photo) =>
        set((state) => ({ photos: [photo, ...state.photos] })),
      removePhoto: (id) =>
        set((state) => ({
          photos: state.photos.filter((p) => p.id !== id),
        })),
      updatePhoto: (id, updates) =>
        set((state) => ({
          photos: state.photos.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      setPrintSize: (size) =>
        set((state) => ({
          preferences: { ...state.preferences, lastPrintSize: size },
        })),
      setDefaultCopies: (copies) =>
        set((state) => ({
          preferences: { ...state.preferences, defaultCopies: copies },
        })),
      setEmailSettings: (settings) => set({ emailSettings: settings }),
    }),
    {
      name: 'photobooth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        activeEvent: state.activeEvent,
        emailSettings: state.emailSettings,
      }),
    }
  )
);
