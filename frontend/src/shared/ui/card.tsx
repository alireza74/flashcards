// Abschnitt mit Hintergrund, optional mit Ueberschrift.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { radius, spacing, usePalette } from './theme';

type CardProps = {
  title?: string;
  children: ReactNode;
};

export function Card({ title, children }: CardProps) {
  const palette = usePalette();

  return (
    <View style={[styles.card, { backgroundColor: palette.surface }]}>
      {title ? <AppText variant="heading">{title}</AppText> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
});
