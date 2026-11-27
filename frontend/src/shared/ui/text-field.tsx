// Eingabefeld mit Beschriftung, Hinweis und Fehlermeldung.
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { radius, spacing, usePalette } from './theme';

export type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, hint, error, style, ...inputProps }: TextFieldProps) {
  const palette = usePalette();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <TextInput
        aria-label={label}
        placeholderTextColor={palette.textSecondary}
        style={[
          styles.input,
          {
            color: palette.text,
            backgroundColor: palette.surface,
            borderColor: error ? palette.danger : palette.border,
          },
          style,
        ]}
        {...inputProps}
      />
      {error ? (
        <Text style={[styles.message, { color: palette.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.message, { color: palette.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { fontSize: 15, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    textAlign: 'auto',
    // Browser: Fokusrahmen nach innen - aussen schneidet ihn eine ScrollView am Rand ab
    outlineOffset: -2,
  },
  message: { fontSize: 13 },
});
