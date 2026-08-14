import { MD3LightTheme } from 'react-native-paper';

export const colors = {
  primary: '#5C6BC0',
  primaryContainer: '#E8EAF6',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceVariant: '#F2F1ED',
  success: '#E8F5E9',
  successText: '#2E7D32',
  warning: '#FFF8E1',
  warningText: '#F57F17',
  danger: '#FFEBEE',
  dangerText: '#C62828',
  textPrimary: '#1C1B1F',
  textSecondary: '#49454F',
  textMuted: '#79747E',
  border: '#E7E0EC',
  borderSoft: 'rgba(38, 32, 54, 0.06)',
};

export const radius = { card: 16, chip: 20, button: 12, pill: 999 };
export const fontSize = { h1: 28, h2: 22, h3: 18, body: 14, small: 12 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.primaryContainer,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    onSurface: colors.textPrimary,
    onSurfaceVariant: colors.textSecondary,
    outline: colors.border,
  },
};
