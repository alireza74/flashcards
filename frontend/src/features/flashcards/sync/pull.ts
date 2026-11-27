// Holen: alles, was sich auf dem Server seit dem letzten Abholen geaendert hat.
//
// - Je Tabelle steht in sync_state der Stand (server_updated_at der neuesten geholten Zeile).
// - Sicherheitsfenster: es wird ab "Stand minus 5 Minuten" geholt. So geht keine Zeile verloren, die auf
//   dem Server mit etwas aelterem Zeitstempel erst spaeter festgeschrieben wurde. Doppelt geholte Zeilen
//   schaden nicht (gleicher Inhalt).
// - Eine geholte Zeile ersetzt die lokale nur, wenn sie mindestens so neu ist (updated_at).
//   Eine neuere lokale Aenderung bleibt stehen und wird beim naechsten Senden uebertragen.
// - Beim Holen entstehen KEINE Eintraege in der Warteschlange.

import { writeTransaction } from '../db/transactions';
import type { LocalDb } from '../db/local-db-types';
import { SYNCED_TABLES, type SyncedTable } from '../db/schema';
import { upsertLocalRow } from './local-write';
import type { PullCursor, RemoteError, SyncRemote } from './remote';
import { isMutableTable, parseServerTime, toLocalRow, type ServerRow } from './table-specs';

export const PULL_PAGE_SIZE = 1000;
export const PULL_OVERLAP_MS = 5 * 60 * 1000;

export type PullResult = {
  received: number;
  applied: number;
  error?: RemoteError;
};

async function applyRows(db: LocalDb, table: SyncedTable, rows: ServerRow[]): Promise<number> {
  let applied = 0;
  await writeTransaction(db, async () => {
    // Fremdschluessel erst am Ende der Transaktion pruefen (z. B. Unterdeck vor Elterndeck geliefert).
    await db.execAsync('PRAGMA defer_foreign_keys = ON');
    for (const serverRow of rows) {
      const local = toLocalRow(table, serverRow);
      if (isMutableTable(table)) {
        const existing = await db.getFirstAsync<{ updated_at: number }>(
          `SELECT updated_at FROM ${table} WHERE id = ?`,
          [local.id],
        );
        if (existing && Number(local.updated_at) < existing.updated_at) continue; // lokal neuer
      }
      await upsertLocalRow(db, table, local);
      applied += 1;
    }
  });
  return applied;
}

async function pullTable(db: LocalDb, remote: SyncRemote, table: SyncedTable): Promise<PullResult> {
  const state = await db.getFirstAsync<{ last_pulled_at: string | null }>(
    'SELECT last_pulled_at FROM sync_state WHERE table_name = ?',
    [table],
  );
  const lastPulledAt = state?.last_pulled_at ?? null;
  const since = lastPulledAt ? new Date(parseServerTime(lastPulledAt) - PULL_OVERLAP_MS).toISOString() : null;

  const result: PullResult = { received: 0, applied: 0 };
  let after: PullCursor | null = null;
  let newest = lastPulledAt;

  for (;;) {
    const page = await remote.pull(table, since, after, PULL_PAGE_SIZE);
    if (page.error) return { ...result, error: page.error };
    if (page.rows.length === 0) break;

    result.received += page.rows.length;
    result.applied += await applyRows(db, table, page.rows);

    const last = page.rows[page.rows.length - 1];
    after = {
      serverUpdatedAt: String(last.server_updated_at),
      id: String(last.id),
    };
    // Seiten sind aufsteigend sortiert: die letzte Zeile ist die neueste.
    if (!newest || parseServerTime(after.serverUpdatedAt) >= parseServerTime(newest)) newest = after.serverUpdatedAt;

    if (page.rows.length < PULL_PAGE_SIZE) break;
  }

  if (newest && newest !== lastPulledAt) {
    await db.runAsync(
      `INSERT INTO sync_state (table_name, last_pulled_at) VALUES (?, ?)
       ON CONFLICT (table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
      [table, newest],
    );
  }
  return result;
}

export async function pullChanges(db: LocalDb, remote: SyncRemote): Promise<PullResult> {
  const total: PullResult = { received: 0, applied: 0 };
  for (const table of SYNCED_TABLES) {
    const result = await pullTable(db, remote, table);
    total.received += result.received;
    total.applied += result.applied;
    if (result.error) return { ...total, error: result.error };
  }
  return total;
}
