// Hinweisbox fuer Fehler oder Informationen ueber dem Formular.
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, usePalette } from './theme';

type FormMessageProps = {
  tone: 'error' | 'info';
  text: string;
};

export function FormMessage({ tone, text }: FormMessageProps) {
  const palette = usePalette();
  const isError = tone === 'error';

  return (
    <View
      aria-live="polite"
      role={isError ? 'alert' : undefined}
      style={[styles.box, { backgroundColor: isError ? palette.dangerSurface : palette.infoSurface }]}
    >
      <Text style={{ color: isError ? palette.danger : palette.text }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.sm, padding: spacing.md },
});
