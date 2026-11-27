// Ablauf eines Abgleichs: senden, dann holen. Es laeuft immer nur ein Abgleich gleichzeitig;
// wer waehrenddessen syncNow() aufruft, bekommt dasselbe Ergebnis.

import type { SupabaseClient } from '@supabase/supabase-js';

import { reportError } from '@/core/monitoring/error-sink';
import { supabase } from '@/core/supabase/client';

import { getLocalDb } from '../db/local-db';
import type { LocalDb } from '../db/local-db-types';
import { createSupabaseRemote } from './remote';
import { runSync, type SyncOutcome } from './run-sync';
import { setSyncStatus } from './sync-status';

const ORGANIZATION_KEY = 'organization_id';

export async function getStoredOrganizationId(db: LocalDb): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM local_meta WHERE key = ?', [
    ORGANIZATION_KEY,
  ]);
  return row?.value ?? null;
}

/** Aktive Organisation vom Server holen und lokal merken, damit offline geschrieben werden kann. */
async function refreshOrganizationId(db: LocalDb, client: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await client.from('profiles').select('active_organization_id').eq('id', userId).single();
  if (error || !data?.active_organization_id) return; // offline: gespeicherten Wert behalten
  await db.runAsync(
    `INSERT INTO local_meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [ORGANIZATION_KEY, data.active_organization_id as string],
  );
}

async function updateCounts(db: LocalDb): Promise<void> {
  const row = await db.getFirstAsync<{ pending: number; failed: number }>(
    `SELECT count(DISTINCT CASE WHEN failed = 0 THEN table_name || ':' || row_id END) AS pending,
            count(DISTINCT CASE WHEN failed = 1 THEN table_name || ':' || row_id END) AS failed
     FROM sync_outbox`,
    [],
  );
  setSyncStatus({ pendingCount: row?.pending ?? 0, failedCount: row?.failed ?? 0 });
}

let running: Promise<SyncOutcome> | null = null;

/** Abgleich fuer den angemeldeten Nutzer starten (oder an den laufenden anhaengen). */
export function syncNow(): Promise<SyncOutcome> {
  if (!running) {
    running = syncSignedInUser().finally(() => {
      running = null;
    });
  }
  return running;
}

async function syncSignedInUser(): Promise<SyncOutcome> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return 'skipped';

  setSyncStatus({ phase: 'syncing' });
  try {
    const db = await getLocalDb(userId);
    await refreshOrganizationId(db, supabase, userId);
    const outcome = await runSync(db, createSupabaseRemote(supabase));
    await updateCounts(db);
    if (outcome === 'done') {
      setSyncStatus({ phase: 'idle', lastSyncedAt: Date.now(), lastError: null });
    } else {
      setSyncStatus({ phase: outcome === 'offline' ? 'offline' : 'error', lastError: outcome });
    }
    return outcome;
  } catch (error) {
    reportError(error, { context: { source: 'flashcards sync' } });
    setSyncStatus({ phase: 'error', lastError: error instanceof Error ? error.message : String(error) });
    return 'error';
  }
}
