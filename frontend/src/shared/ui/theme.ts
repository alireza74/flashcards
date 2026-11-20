// Gemeinsame Gestaltungswerte. Ausbau zum Design-System in M3.
// Regel fuer RTL (Persisch): Abstaende immer mit Start/End
// (paddingStart, marginEnd), nie mit Left/Right.

export const colors = {
  light: {
    text: '#11181C',
    textSecondary: '#60646C',
    background: '#FFFFFF',
    surface: '#F0F0F3',
    primary: '#208AEF',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#B0B4BA',
    background: '#000000',
    surface: '#212225',
    primary: '#4BA3F5',
  },
} as const;

export type ColorScheme = keyof typeof colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
