// Einheitliche Lade- und Fehlerzustaende. Jede Seite, die Daten laedt, nutzt diese
// statt eigener Spinner und Fehlermeldungen.
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from './app-text';
import { Button } from './button';
import { spacing, usePalette } from './theme';

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  const palette = usePalette();

  return (
    <View style={styles.container} aria-busy role="progressbar" aria-label={label ?? t('common.loading')}>
      <ActivityIndicator color={palette.primary} />
      <AppText tone="secondary" variant="caption">
        {label ?? t('common.loading')}
      </AppText>
    </View>
  );
}

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container} role="alert">
      <AppText tone="danger">{message}</AppText>
      {onRetry ? <Button variant="secondary" title={t('common.retry')} onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
});
