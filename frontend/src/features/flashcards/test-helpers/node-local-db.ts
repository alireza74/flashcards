// NUR FUER TESTS: LocalDb-Schnittstelle ueber das in Node eingebaute SQLite (node:sqlite).
// So laeuft die echte Abgleich-Logik in Jest, ohne expo-sqlite und ohne Handy.

import type { LocalDb, SqlValue } from '../db/local-db-types';
import { migrate } from '../db/transactions';

type Row = Record<string, unknown>;
type Statement = {
  all(...params: SqlValue[]): Row[];
  get(...params: SqlValue[]): Row | undefined;
  run(...params: SqlValue[]): { changes: number | bigint };
};
type NodeSqlite = {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
};

// Die App kennt keine Node-Typen (tsconfig "types": ["jest"]); daher require mit eigener Beschreibung.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => NodeSqlite;
};

export type TestDb = LocalDb & { raw: NodeSqlite };

export function createNodeLocalDb(): TestDb {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  return {
    raw,
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, params) {
      const { changes } = raw.prepare(source).run(...params);
      return { changes: Number(changes) };
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]) {
      return (raw.prepare(source).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(source: string, params: SqlValue[]) {
      return raw.prepare(source).all(...params) as T[];
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

export async function createMigratedTestDb(): Promise<TestDb> {
  const db = createNodeLocalDb();
  await migrate(db);
  return db;
}
