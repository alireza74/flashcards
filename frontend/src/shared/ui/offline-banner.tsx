// Leiste "Keine Verbindung" oben auf jeder Seite (steckt in Screen), solange das Geraet offline ist.
// Sonst scheitern Knoepfe still oder erst nach langem Warten. isConnected ist beim Start kurz null
// (unbekannt) - dann nichts anzeigen.
import { useNetInfo } from '@react-native-community/netinfo';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, usePalette } from './theme';

export function OfflineBanner() {
  const { t } = useTranslation();
  const palette = usePalette();
  const { isConnected } = useNetInfo();

  if (isConnected !== false) return null;

  return (
    <View role="alert" style={[styles.banner, { backgroundColor: palette.dangerSurface }]}>
      <Text style={[styles.text, { color: palette.danger }]}>{t('common.offline')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg, alignItems: 'center' },
  text: { fontSize: 13, fontWeight: '600' },
});
