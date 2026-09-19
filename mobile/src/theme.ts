export type ThemeMode = 'dark' | 'light';

export interface AppTheme {
  mode: ThemeMode;
  colors: {
    backgroundTop: string;
    backgroundBottom: string;
    glass: string;
    glassBorder: string;
    accent: string;
    accentSoft: string;
    textPrimary: string;
    textSecondary: string;
    danger: string;
    success: string;
  };
  radius: {
    lg: number;
    md: number;
    sm: number;
  };
}

const radius = { lg: 28, md: 18, sm: 12 };

export const darkTheme: AppTheme = {
  mode: 'dark',
  colors: {
    backgroundTop: '#0B0F1F',
    backgroundBottom: '#161033',
    glass: 'rgba(255, 255, 255, 0.08)',
    glassBorder: 'rgba(255, 255, 255, 0.18)',
    accent: '#7C6CFF',
    accentSoft: 'rgba(124, 108, 255, 0.35)',
    textPrimary: '#F5F6FF',
    textSecondary: 'rgba(245, 246, 255, 0.62)',
    danger: '#FF6B6B',
    success: '#5DE0A0',
  },
  radius,
};

export const lightTheme: AppTheme = {
  mode: 'light',
  colors: {
    backgroundTop: '#F2F1FB',
    backgroundBottom: '#E4E7FB',
    glass: 'rgba(20, 20, 40, 0.05)',
    glassBorder: 'rgba(20, 20, 40, 0.12)',
    accent: '#5B4CDB',
    accentSoft: 'rgba(91, 76, 219, 0.18)',
    textPrimary: '#181828',
    textSecondary: 'rgba(24, 24, 40, 0.58)',
    danger: '#D8453A',
    success: '#2F9E6E',
  },
  radius,
};

// Kept for any file not yet migrated to ThemeContext - defaults to dark.
export const theme = darkTheme;
