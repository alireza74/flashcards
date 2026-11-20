// Text mit festen Stufen statt freier Schriftgroessen ueberall im Code.
// Neue Stufe noetig? Hier ergaenzen, nicht lokal mit fontSize arbeiten.
import { StyleSheet, Text, type TextProps } from 'react-native';

import { usePalette } from './theme';

type Variant = 'title' | 'heading' | 'body' | 'label' | 'caption';
type Tone = 'default' | 'secondary' | 'danger' | 'primary';

type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
};

export function AppText({ variant = 'body', tone = 'default', style, ...props }: AppTextProps) {
  const palette = usePalette();
  const color = {
    default: palette.text,
    secondary: palette.textSecondary,
    danger: palette.danger,
    primary: palette.primary,
  }[tone];

  return (
    <Text
      role={variant === 'title' || variant === 'heading' ? 'heading' : undefined}
      style={[styles[variant], { color }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '600', textAlign: 'auto' },
  heading: { fontSize: 20, fontWeight: '600', textAlign: 'auto' },
  body: { fontSize: 16, textAlign: 'auto' },
  label: { fontSize: 15, fontWeight: '500', textAlign: 'auto' },
  caption: { fontSize: 13, textAlign: 'auto' },
});
