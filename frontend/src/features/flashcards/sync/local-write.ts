// Lokal schreiben. JEDE Aenderung an einer abgeglichenen Tabelle laeuft ueber diese Funktionen:
// Sie speichern die Zeile und tragen sie in die Warteschlange (sync_outbox) ein - in einer Transaktion.
// In der Warteschlange steht nur der Verweis; gesendet wird spaeter der dann aktuelle Stand der Zeile.

import { writeTransaction } from '../db/transactions';
import type { LocalDb } from '../db/local-db-types';
import type { SyncedTable } from '../db/schema';
import { isMutableTable, TABLE_COLUMNS, type LocalRow } from './table-specs';

/** Schreibt eine Zeile (anlegen oder ersetzen) ohne Warteschlange - auch fuer das Holen vom Server. */
export async function upsertLocalRow(db: LocalDb, table: SyncedTable, row: LocalRow): Promise<void> {
  const columns = Object.keys(TABLE_COLUMNS[table]);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((column) => row[column] ?? null);

  if (!isMutableTable(table)) {
    // Lernhistorie: nur anfuegen, vorhandene Eintraege bleiben unveraendert.
    await db.runAsync(`INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
    return;
  }

  const updates = columns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');
  // Nicht "INSERT OR REPLACE": das loescht und legt neu an und wuerde Fremdschluessel verletzen.
  await db.runAsync(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updates}`,
    values,
  );
}

async function enqueue(db: LocalDb, table: SyncedTable, rowId: string, now: number): Promise<void> {
  await db.runAsync('INSERT INTO sync_outbox (table_name, row_id, op, created_at) VALUES (?, ?, ?, ?)', [
    table,
    rowId,
    isMutableTable(table) ? 'upsert' : 'insert',
    now,
  ]);
}

/**
 * Speichert eine Zeile und merkt sie zum Senden vor. updated_at (und bei neuen Zeilen created_at)
 * setzt diese Funktion selbst auf die aktuelle Geraetezeit.
 * Die Zeile muss VOLLSTAENDIG sein (alle Spalten) - fehlende Spalten wuerden zu NULL.
 */
export async function saveRow(db: LocalDb, table: SyncedTable, row: LocalRow, now = Date.now()): Promise<void> {
  const id = row.id;
  if (typeof id !== 'string' || id.length === 0) throw new Error('saveRow: id fehlt');

  await writeTransaction(db, async () => {
    const stamped: LocalRow = { ...row };
    if (stamped.created_at === undefined || stamped.created_at === null) stamped.created_at = now;
    if (isMutableTable(table)) stamped.updated_at = now;
    await upsertLocalRow(db, table, stamped);
    await enqueue(db, table, id, now);
  });
}

/** Loeschen = Loeschmarker setzen; die Zeile bleibt, damit der Abgleich das Loeschen weitergeben kann. */
export async function markDeleted(db: LocalDb, table: SyncedTable, id: string, now = Date.now()): Promise<void> {
  if (!isMutableTable(table)) throw new Error(`markDeleted: ${table} ist nur anfuegbar`);
  await writeTransaction(db, async () => {
    const result = await db.runAsync(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
    if (result.changes > 0) await enqueue(db, table, id, now);
  });
}
