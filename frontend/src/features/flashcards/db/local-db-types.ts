// Der Teil der expo-sqlite-Schnittstelle, den die App benutzt. Eigene Beschreibung, damit dieselbe Logik
// in Tests mit dem in Node eingebauten SQLite laufen kann (siehe test-helpers/node-local-db.ts).

export type SqlValue = string | number | null;

export type LocalDb = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};
