// Anzeige, wenn eine Seite wegen eines Fehlers nicht dargestellt werden kann.
// Zeigt die Fehler-ID, die der Nutzer dem Support nennen kann.
import { useTranslation } from 'react-i18next';

import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';

type ErrorScreenProps = {
  errorId: string | null;
  onRetry: () => void;
};

export function ErrorScreen({ errorId, onRetry }: ErrorScreenProps) {
  const { t } = useTranslation();

  return (
    <Screen title={t('monitoring.title')}>
      <AppText>{t('monitoring.body')}</AppText>
      {errorId ? (
        <AppText variant="label" selectable>
          {t('monitoring.errorId', { id: errorId })}
        </AppText>
      ) : null}
      <Button title={t('common.retry')} onPress={onRetry} />
    </Screen>
  );
}
