// Senden: Warteschlange (sync_outbox) an Supabase schicken.
//
// 1. Hoechste Nummer der Warteschlange merken ("Schnappschuss"). Spaeter dazukommende Eintraege
//    bleiben fuer den naechsten Durchgang.
// 2. Tabelle fuer Tabelle (Reihenfolge der Fremdschluessel), in Paketen zu 200 Zeilen,
//    jeweils den AKTUELLEN Stand der Zeile senden.
// 3. Erfolg: die gesendeten Eintraege loeschen.
//    Kein Netz: abbrechen, spaeter erneut.
//    Abgelehnt: Paket Zeile fuer Zeile senden; die schuldige Zeile als "failed" markieren.

import type { LocalDb } from '../db/local-db-types';
import { SYNCED_TABLES, type SyncedTable } from '../db/schema';
import { isRejection, type RemoteError, type SyncRemote } from './remote';
import { isMutableTable, toServerRow, type LocalRow } from './table-specs';

export const PUSH_BATCH_SIZE = 200;

export type PushResult = {
  sent: number;
  failed: number;
  offline: boolean;
  lastError?: RemoteError;
};

function inList(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

async function removeFromOutbox(db: LocalDb, table: SyncedTable, ids: string[], maxSeq: number): Promise<void> {
  if (ids.length === 0) return;
  await db.runAsync(`DELETE FROM sync_outbox WHERE table_name = ? AND seq <= ? AND row_id IN (${inList(ids.length)})`, [
    table,
    maxSeq,
    ...ids,
  ]);
}

async function markFailed(db: LocalDb, table: SyncedTable, id: string, maxSeq: number, error: RemoteError) {
  await db.runAsync(
    `UPDATE sync_outbox SET failed = 1, attempts = attempts + 1, last_error = ?
     WHERE table_name = ? AND row_id = ? AND seq <= ? AND failed = 0`,
    [`${error.code ?? ''} ${error.message}`.trim().slice(0, 500), table, id, maxSeq],
  );
}

export async function pushChanges(db: LocalDb, remote: SyncRemote): Promise<PushResult> {
  const snapshot = await db.getFirstAsync<{ maxSeq: number | null }>(
    'SELECT max(seq) AS maxSeq FROM sync_outbox WHERE failed = 0',
    [],
  );
  const maxSeq = snapshot?.maxSeq ?? null;
  const result: PushResult = { sent: 0, failed: 0, offline: false };
  if (maxSeq === null) return result;

  for (const table of SYNCED_TABLES) {
    const pending = await db.getAllAsync<{ row_id: string }>(
      'SELECT DISTINCT row_id FROM sync_outbox WHERE table_name = ? AND failed = 0 AND seq <= ? ORDER BY row_id',
      [table, maxSeq],
    );
    const ids = pending.map((p) => p.row_id);

    for (let start = 0; start < ids.length; start += PUSH_BATCH_SIZE) {
      const batchIds = ids.slice(start, start + PUSH_BATCH_SIZE);
      const rows = await db.getAllAsync<LocalRow>(
        `SELECT * FROM ${table} WHERE id IN (${inList(batchIds.length)})`,
        batchIds,
      );
      const ignoreDuplicates = !isMutableTable(table);

      const error = await remote.upsert(
        table,
        rows.map((row) => toServerRow(table, row)),
        ignoreDuplicates,
      );
      if (!error) {
        await removeFromOutbox(db, table, batchIds, maxSeq);
        result.sent += rows.length;
        continue;
      }
      if (!isRejection(error)) {
        return { ...result, offline: true, lastError: error };
      }

      // Abgelehnt: einzeln senden, um die schuldige(n) Zeile(n) zu finden.
      for (const row of rows) {
        const id = String(row.id);
        const single = await remote.upsert(table, [toServerRow(table, row)], ignoreDuplicates);
        if (!single) {
          await removeFromOutbox(db, table, [id], maxSeq);
          result.sent += 1;
        } else if (!isRejection(single)) {
          return { ...result, offline: true, lastError: single };
        } else {
          await markFailed(db, table, id, maxSeq, single);
          result.failed += 1;
          result.lastError = single;
        }
      }
    }
  }
  return result;
}
