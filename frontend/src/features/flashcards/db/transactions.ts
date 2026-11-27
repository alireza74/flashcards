// Schreibsperre und Migrationslauf - ohne Bezug zu expo-sqlite, damit Tests dieselbe Logik mit
// dem in Node eingebauten SQLite nutzen koennen.
//
// Alle schreibenden Transaktionen laufen nacheinander ueber writeTransaction(). Grund: Im Browser gibt es
// withExclusiveTransactionAsync nicht, und bei withTransactionAsync wuerden gleichzeitige Abfragen in die
// laufende Transaktion geraten. Nie writeTransaction innerhalb von writeTransaction aufrufen (wartet ewig).

import type { LocalDb } from './local-db-types';
import { LOCAL_DB_MIGRATIONS } from './schema';

let queue: Promise<unknown> = Promise.resolve();

/** Fuehrt fn in einer Transaktion aus; mehrere Aufrufe laufen streng nacheinander. */
export function writeTransaction<T>(db: LocalDb, fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    let result!: T;
    await db.withTransactionAsync(async () => {
      result = await fn();
    });
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Fuehrt alle noch fehlenden Migrationen aus, jede in einer eigenen Transaktion (Nummer in PRAGMA user_version). */
export async function migrate(db: LocalDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const version = row?.user_version ?? 0;

  if (version > LOCAL_DB_MIGRATIONS.length) {
    // Datenbank stammt aus einer neueren App-Version (z. B. nach Zurueckspielen eines Updates).
    throw new Error(`local db version ${version} is newer than app (${LOCAL_DB_MIGRATIONS.length})`);
  }

  for (let next = version + 1; next <= LOCAL_DB_MIGRATIONS.length; next++) {
    const sql = LOCAL_DB_MIGRATIONS[next - 1];
    await writeTransaction(db, async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
  }
}
