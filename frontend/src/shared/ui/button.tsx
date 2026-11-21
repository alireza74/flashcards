// Schaltflaeche in drei Varianten: primary (Hauptaktion), secondary, link (Textlink).
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

// Ausnahme von der Schichtregel: breadcrumbs.ts hat keine weiteren Abhaengigkeiten.
import { addBreadcrumb } from '@/core/monitoring/breadcrumbs';

import { radius, spacing, usePalette } from './theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'link';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false }: ButtonProps) {
  const palette = usePalette();
  const inactive = disabled || loading;

  const containerStyle =
    variant === 'primary'
      ? { backgroundColor: palette.primary }
      : variant === 'secondary'
        ? { borderColor: palette.border, borderWidth: 1 }
        : undefined;
  const textColor = variant === 'primary' ? palette.onPrimary : palette.primary;

  return (
    <Pressable
      // role/aria-* statt accessibility*: wird von iOS, Android und Web gleich verstanden
      role="button"
      // Name fuer Screenreader; sonst ist die Schaltflaeche waehrend des Ladens namenlos
      aria-label={title}
      aria-disabled={inactive}
      aria-busy={loading}
      disabled={inactive}
      onPress={() => {
        // Schritt fuer Fehlerberichte: welcher Knopf (Beschriftung ist ein fester App-Text)
        addBreadcrumb('ui', `Knopf: ${title}`);
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        variant === 'link' ? styles.link : styles.box,
        containerStyle,
        (pressed || inactive) && styles.dimmed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  box: { borderRadius: radius.md, paddingVertical: spacing.sm + 6, paddingHorizontal: spacing.md, minHeight: 48 },
  link: { paddingVertical: spacing.sm },
  text: { fontSize: 16, fontWeight: '600' },
  dimmed: { opacity: 0.6 },
});
