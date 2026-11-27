// Hinweis "Neue Version geladen - jetzt neu starten?" (wie bei SAP Mobile Services).
//
// Erscheint, sobald ein Update heruntergeladen ist: beim App-Start (automatische Suche von expo-updates) oder
// nachdem die App aus dem Hintergrund zurueckkommt (eigene Suche, hoechstens alle 10 Minuten).
// "Spaeter" blendet den Hinweis bis zum naechsten App-Start aus; das Update wird dann beim naechsten
// Kaltstart ohnehin aktiv.
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/shared/ui/app-text';
import { BottomSheet } from '@/shared/ui/bottom-sheet';
import { Button } from '@/shared/ui/button';

import { checkAndDownloadUpdate, restartWithUpdate, updatesSupported } from './app-updates';

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

export function UpdatePrompt() {
  if (!updatesSupported) return null;
  return <UpdatePromptNative />;
}

function UpdatePromptNative() {
  const { t } = useTranslation();
  const { isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);

  // Beim Wechsel in den Vordergrund suchen. Nicht beim Start: dort sucht expo-updates schon selbst.
  useEffect(() => {
    let lastCheck = Date.now();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
      lastCheck = Date.now();
      // ohne Netz scheitert die Suche - kein Fehler fuer den Nutzer, beim naechsten Mal erneut
      checkAndDownloadUpdate().catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  return (
    <BottomSheet
      centered
      visible={isUpdatePending && !dismissed}
      title={t('updates.promptTitle')}
      onClose={() => setDismissed(true)}
      footer={
        <>
          <Button title={t('updates.restartNow')} onPress={() => void restartWithUpdate()} />
          <Button variant="link" title={t('updates.later')} onPress={() => setDismissed(true)} />
        </>
      }
    >
      <AppText>{t('updates.promptText')}</AppText>
    </BottomSheet>
  );
}
