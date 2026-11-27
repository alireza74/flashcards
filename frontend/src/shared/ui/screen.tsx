// Rahmen fuer jede Seite: sicherer Bereich (Notch), Tastatur schiebt den Inhalt hoch,
// scrollbar, im Browser auf lesbare Breite begrenzt. Ohne Netz oben die Leiste "Keine Verbindung".
//
// Mit headerAction oder headerLeft bekommt die Seite eine feste Kopfzeile (links z. B. Zurueck,
// dann der Titel, rechts eine Aktion wie der Profil-Knopf), die beim Scrollen stehen bleibt.
// footer: feste Leiste unten fuer den Hauptknopf der Seite (naechster Arbeitsschritt). Ohne headerAction steht der
// Titel wie bisher ueber dem Inhalt (Anmeldeseiten, mittig ausgerichtet).
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfflineBanner } from './offline-banner';
import { spacing, usePalette } from './theme';

type ScreenProps = {
  title?: string;
  headerAction?: ReactNode;
  headerLeft?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
};

export function Screen({ title, headerAction, headerLeft, footer, children }: ScreenProps) {
  const palette = usePalette();
  const withHeader = headerAction !== undefined || headerLeft !== undefined;

  const titleText = title ? (
    <Text role="heading" style={[styles.title, withHeader && styles.headerTitle, { color: palette.text }]}>
      {title}
    </Text>
  ) : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <OfflineBanner />
      {withHeader ? (
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <View style={[styles.content, styles.headerRow]}>
            {headerLeft}
            <View style={styles.flex}>{titleText}</View>
            {headerAction}
          </View>
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, withHeader && styles.scrollTop]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {withHeader ? null : titleText}
            {children}
          </View>
        </ScrollView>
        {footer ? (
          <View style={[styles.footer, { borderTopColor: palette.border, backgroundColor: palette.background }]}>
            <View style={styles.content}>{footer}</View>
          </View>
        ) : null}
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
  // mit Kopfzeile beginnt der Inhalt oben, nicht mittig
  scrollTop: { justifyContent: 'flex-start', paddingTop: spacing.lg },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  headerTitle: { fontSize: 18, marginBottom: 0 },
});
