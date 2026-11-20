// Startseite der leeren Grundapp (M0).
// Wird in M2 durch Anmeldung bzw. Startseite nach Login ersetzt.
// Texte sind hier noch fest; ab M3 nur noch ueber i18n-Schluessel.
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appIdentity } from '@/config/app.config';
import { colors, spacing } from '@/shared/ui/theme';

export function HomeScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = colors[scheme];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: palette.text }]}>{appIdentity.name}</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Version {appIdentity.version}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
  },
});
