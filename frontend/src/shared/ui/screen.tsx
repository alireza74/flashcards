// Rahmen fuer jede Seite: sicherer Bereich (Notch), Tastatur schiebt den Inhalt hoch,
// scrollbar, im Browser auf lesbare Breite begrenzt.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, usePalette } from './theme';

type ScreenProps = {
  title?: string;
  children: ReactNode;
};

export function Screen({ title, children }: ScreenProps) {
  const palette = usePalette();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            {title ? (
              <Text role="heading" style={[styles.title, { color: palette.text }]}>
                {title}
              </Text>
            ) : null}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
});
