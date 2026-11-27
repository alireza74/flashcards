// Ein Abgleich: erst senden, dann holen. Ohne Bezug zur App (Sitzung, Supabase-Client), damit Tests
// zwei "Geraete" gegen das lokale Supabase laufen lassen koennen.

import type { LocalDb } from '../db/local-db-types';
import { pullChanges } from './pull';
import { pushChanges } from './push';
import type { SyncRemote } from './remote';

export type SyncOutcome = 'done' | 'offline' | 'error' | 'skipped';

export async function runSync(db: LocalDb, remote: SyncRemote): Promise<SyncOutcome> {
  const pushed = await pushChanges(db, remote);
  if (pushed.offline) return 'offline';
  const pulled = await pullChanges(db, remote);
  if (pulled.error) return 'offline';
  return pushed.failed > 0 ? 'error' : 'done';
}
