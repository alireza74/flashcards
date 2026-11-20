// Sperrbildschirm, wenn die installierte Version zu alt ist.
// Store-Links folgen, sobald die App in den Stores ist (app-identity.json).
import { useTranslation } from 'react-i18next';

import { AppText } from '@/shared/ui/app-text';
import { Screen } from '@/shared/ui/screen';

import { installedAppVersion } from './use-min-version';

export function UpdateRequiredScreen() {
  const { t } = useTranslation();

  return (
    <Screen title={t('update.title')}>
      <AppText>{t('update.body')}</AppText>
      <AppText variant="caption" tone="secondary">
        {installedAppVersion()}
      </AppText>
    </Screen>
  );
}
