// Hinweis, wenn Aenderungen noch nicht gesendet oder vom Server abgelehnt wurden.
// Ruhig gehalten: offline zu lernen ist normal, kein Fehler.

import { useTranslation } from 'react-i18next';

import { FormMessage } from '@/shared/ui/form-message';

import { useSyncStatus } from '../sync/sync-status';

export function SyncNotice() {
  const { t } = useTranslation();
  const { pendingCount, failedCount, phase } = useSyncStatus();

  if (failedCount > 0) return <FormMessage tone="error" text={t('flashcards.sync.failed', { count: failedCount })} />;
  if (pendingCount > 0 && phase !== 'syncing') {
    return <FormMessage tone="info" text={t('flashcards.sync.pending', { count: pendingCount })} />;
  }
  return null;
}
