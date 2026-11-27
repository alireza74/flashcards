// Profil: "Feedback senden" oeffnet das Mailprogramm mit Adresse, Betreff und App-Stand.
// Adresse in app-identity.json (supportEmail); leer = Abschnitt ausgeblendet.
// Das Fehlerprotokoll haengt NICHT automatisch an - der Nutzer teilt es bei Bedarf selbst (Datenschutz-Abschnitt).
import { useState } from 'react';
import { Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { appIdentity } from '@/config/app.config';
import { appMeta } from '@/core/monitoring/log-file';
import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FormMessage } from '@/shared/ui/form-message';

import { feedbackMailUrl } from './feedback-mail';

export function FeedbackSection() {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const email = appIdentity.supportEmail;

  if (!email) return null;

  const send = async () => {
    setFailed(false);
    const meta = appMeta();
    // nur technischer Stand, keine Nutzerdaten
    const details = `${appIdentity.name} ${meta.appVersion ?? '-'} · ${Platform.OS} · ${meta.updateId?.slice(0, 8) ?? '-'}`;
    const url = feedbackMailUrl(
      email,
      t('feedback.subject', { app: appIdentity.name }),
      `${t('feedback.bodyHint')}\n\n\n---\n${details}`,
    );
    try {
      await Linking.openURL(url);
    } catch {
      setFailed(true);
    }
  };

  return (
    <Card title={t('feedback.title')}>
      <AppText tone="secondary">{t('feedback.intro')}</AppText>
      {failed ? <FormMessage tone="error" text={t('feedback.noMailApp', { email })} /> : null}
      <Button variant="secondary" title={t('feedback.send')} onPress={() => void send()} />
    </Card>
  );
}
