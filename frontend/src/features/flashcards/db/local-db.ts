// Oeffnet die lokale Datenbank des angemeldeten Nutzers und bringt sie auf den neuesten Stand.
//
// Eine Datei je Nutzer (flashcards-<userId>.db): meldet sich jemand anderes auf dem Geraet an,
// vermischen sich die Daten nicht. Nach dem Abmelden bleibt die Datei (offline wieder anmelden).

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { LocalDb } from './local-db-types';
import { migrate } from './transactions';

let current: { userId: string; db: Promise<SQLiteDatabase> } | null = null;

/** Liefert die geoeffnete, migrierte Datenbank des Nutzers. Wechselt der Nutzer, wird die alte geschlossen. */
export function getLocalDb(userId: string): Promise<LocalDb> {
  if (current?.userId === userId) return current.db;

  const previous = current;
  const db = (async () => {
    if (previous) {
      await previous.db.then((old) => old.closeAsync()).catch(() => undefined);
    }
    return openAndMigrate(userId);
  })();
  current = { userId, db };
  db.catch(() => {
    if (current?.db === db) current = null; // naechster Aufruf versucht es erneut
  });
  return db;
}

async function openAndMigrate(userId: string): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(`flashcards-${userId}.db`);
  // Verbindungseinstellungen ausserhalb der Migrations-Transaktion.
  // WAL: Lesen und Schreiben blockieren sich weniger. foreign_keys ist in SQLite standardmaessig aus.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  return db;
}
