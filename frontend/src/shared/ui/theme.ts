// Gemeinsame Gestaltungswerte. Ausbau zum Design-System in M3.
// Regel fuer RTL (Persisch): Abstaende immer mit Start/End
// (paddingStart, marginEnd), nie mit Left/Right.
import { useColorScheme } from 'react-native';

export const colors = {
  light: {
    text: '#11181C',
    textSecondary: '#60646C',
    background: '#FFFFFF',
    surface: '#F0F0F3',
    border: '#D9D9E0',
    primary: '#208AEF',
    onPrimary: '#FFFFFF',
    danger: '#CE2C31',
    dangerSurface: '#FFEFEF',
    infoSurface: '#E6F4FE',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#B0B4BA',
    background: '#000000',
    surface: '#212225',
    border: '#3A3C42',
    primary: '#4BA3F5',
    onPrimary: '#FFFFFF',
    danger: '#FF6369',
    dangerSurface: '#3B1219',
    infoSurface: '#0D2847',
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type Palette = (typeof colors)[ColorScheme];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
} as const;

// Liefert die Farben passend zum hellen/dunklen Modus des Geraets.
export function usePalette(): Palette {
  return colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
