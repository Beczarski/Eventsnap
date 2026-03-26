export const Colors = {
  background: '#0A0A0F',
  primary: '#C8A96E',
  secondary: '#1A1A2E',
  accent: '#E8D5A3',
  surface: '#141420',
  surfaceLight: '#1E1E30',
  text: '#F5F5F5',
  textSecondary: '#9A9AB0',
  textMuted: '#6B6B80',
  success: '#4CAF50',
  error: '#E53935',
  warning: '#FF9800',
  border: '#2A2A3E',
  borderGold: 'rgba(200, 169, 110, 0.3)',
  overlay: 'rgba(10, 10, 15, 0.85)',
  goldGradientStart: '#C8A96E',
  goldGradientEnd: '#E8D5A3',
  cardShadow: 'rgba(0, 0, 0, 0.4)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const;
