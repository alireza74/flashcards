// Profil: Knopf "Nach Updates suchen" mit Statusanzeige. Im Browser und im Entwicklungsmodus ausgeblendet.
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FormMessage } from '@/shared/ui/form-message';

import { checkAndDownloadUpdate, restartWithUpdate, updatesSupported } from './app-updates';

export function UpdateSection() {
  if (!updatesSupported) return null;
  return <UpdateSectionNative />;
}

function UpdateSectionNative() {
  const { t } = useTranslation();
  const { isUpdatePending, isChecking, isDownloading } = Updates.useUpdates();
  const [result, setResult] = useState<'upToDate' | 'error' | null>(null);

  const search = async () => {
    setResult(null);
    try {
      const outcome = await checkAndDownloadUpdate();
      if (outcome === 'none') setResult('upToDate');
    } catch {
      setResult('error');
    }
  };

  const busy = isChecking || isDownloading;

  return (
    <Card title={t('updates.title')}>
      {isDownloading ? <FormMessage tone="info" text={t('updates.downloading')} /> : null}
      {isUpdatePending ? <FormMessage tone="info" text={t('updates.ready')} /> : null}
      {!busy && !isUpdatePending && result === 'upToDate' ? (
        <FormMessage tone="info" text={t('updates.upToDate')} />
      ) : null}
      {!busy && result === 'error' ? <FormMessage tone="error" text={t('updates.error')} /> : null}
      {isUpdatePending ? (
        <Button title={t('updates.restartNow')} onPress={() => void restartWithUpdate()} />
      ) : (
        <Button variant="secondary" title={t('updates.check')} loading={busy} onPress={() => void search()} />
      )}
    </Card>
  );
}
