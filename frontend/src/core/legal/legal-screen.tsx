// Datenschutzerklaerung und Impressum. Ohne Anmeldung erreichbar (Store-Pflicht).
// Die Texte sind Platzhalter und muessen vor der Veroeffentlichung juristisch geprueft werden.
import { useTranslation } from 'react-i18next';

import { AppText } from '@/shared/ui/app-text';
import { FormMessage } from '@/shared/ui/form-message';
import { BackButton } from '@/shared/ui/header-buttons';
import { Screen } from '@/shared/ui/screen';

type LegalScreenProps = {
  kind: 'privacy' | 'imprint';
};

export function LegalScreen({ kind }: LegalScreenProps) {
  const { t } = useTranslation();

  return (
    <Screen headerLeft={<BackButton />} title={t(kind === 'privacy' ? 'legal.privacyTitle' : 'legal.imprintTitle')}>
      <FormMessage tone="info" text={t('legal.draftNotice')} />
      <AppText>{t(kind === 'privacy' ? 'legal.privacyBody' : 'legal.imprintBody')}</AppText>
    </Screen>
  );
}
