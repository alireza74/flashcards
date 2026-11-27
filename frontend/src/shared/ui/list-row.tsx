// Antippbare Zeile mit Titel, Untertitel und Pfeil (fuer Listen von Objekten, Raeumen ...).
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { addBreadcrumb } from '@/core/monitoring/breadcrumbs';
import { AppText } from '@/shared/ui/app-text';
import { radius, spacing, usePalette } from '@/shared/ui/theme';

type ListRowProps = {
  title: string;
  subtitle?: string;
  /** optional links vor dem Text (z. B. ein kleines Symbol oder Diagramm) */
  leading?: ReactNode;
  onPress: () => void;
};

export function ListRow({ title, subtitle, leading, onPress }: ListRowProps) {
  const palette = usePalette();

  return (
    <Pressable
      role="button"
      aria-label={title}
      onPress={() => {
        addBreadcrumb('ui', `Zeile: ${title}`);
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && styles.pressed,
      ]}
    >
      {leading}
      <View style={styles.texts}>
        <AppText variant="label">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <AppText tone="secondary">›</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  texts: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
});
