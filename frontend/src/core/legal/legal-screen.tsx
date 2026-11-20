// Datenschutzerklaerung und Impressum. Ohne Anmeldung erreichbar (Store-Pflicht).
// Die Texte sind Platzhalter und muessen vor der Veroeffentlichung juristisch geprueft werden.
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { FormMessage } from '@/shared/ui/form-message';
import { Screen } from '@/shared/ui/screen';

type LegalScreenProps = {
  kind: 'privacy' | 'imprint';
};

export function LegalScreen({ kind }: LegalScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen title={t(kind === 'privacy' ? 'legal.privacyTitle' : 'legal.imprintTitle')}>
      <FormMessage tone="info" text={t('legal.draftNotice')} />
      <AppText>{t(kind === 'privacy' ? 'legal.privacyBody' : 'legal.imprintBody')}</AppText>
      <Button
        variant="link"
        title={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </Screen>
  );
}
