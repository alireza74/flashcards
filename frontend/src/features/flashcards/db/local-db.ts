// Oeffnet die lokale Datenbank und bringt sie auf den neuesten Stand (Migrationen).
// Es gibt genau eine Verbindung je App-Lauf; alle Zugriffe gehen ueber getLocalDb().

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { LOCAL_DB_MIGRATIONS } from './schema';

const DATABASE_NAME = 'flashcards.db';

let opening: Promise<SQLiteDatabase> | null = null;

/** Liefert die geoeffnete, migrierte Datenbank. Mehrfache Aufrufe teilen sich dieselbe Verbindung. */
export function getLocalDb(): Promise<SQLiteDatabase> {
  if (!opening) {
    opening = openAndMigrate().catch((error: unknown) => {
      opening = null; // naechster Aufruf versucht es erneut
      throw error;
    });
  }
  return opening;
}

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  // WAL: Lesen und Schreiben blockieren sich weniger. foreign_keys ist in SQLite standardmaessig aus.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  return db;
}

/** Fuehrt alle noch fehlenden Migrationen aus, jede in einer eigenen Transaktion. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  if (current > LOCAL_DB_MIGRATIONS.length) {
    // Datenbank stammt aus einer neueren App-Version (z. B. nach Zurueckspielen eines Updates).
    throw new Error(`local db version ${current} is newer than app (${LOCAL_DB_MIGRATIONS.length})`);
  }

  for (let version = current + 1; version <= LOCAL_DB_MIGRATIONS.length; version++) {
    const sql = LOCAL_DB_MIGRATIONS[version - 1];
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(sql);
      await txn.execAsync(`PRAGMA user_version = ${version}`);
    });
  }
}
