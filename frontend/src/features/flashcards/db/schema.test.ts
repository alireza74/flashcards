/**
 * @jest-environment node
 */
// Prueft die SQL-Migrationen der lokalen Datenbank mit dem in Node eingebauten SQLite (node:sqlite).
// Auf dem Handy laeuft dasselbe SQL ueber expo-sqlite.
import { LOCAL_DB_MIGRATIONS, SYNCED_TABLES } from './schema';
import { SYSTEM_NOTE_TYPE_IDS } from './system-note-types';

// Die App kennt keine Node-Typen (tsconfig "types": ["jest"]); daher nur die hier benoetigte Schnittstelle.
type Row = Record<string, unknown>;
type Statement = { all(...params: unknown[]): Row[]; get(...params: unknown[]): Row | undefined };
type SqliteDb = { exec(sql: string): void; prepare(sql: string): Statement };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb };

function freshDb(): SqliteDb {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const sql of LOCAL_DB_MIGRATIONS) db.exec(sql);
  return db;
}

describe('lokales Datenbankschema', () => {
  it('legt alle abgeglichenen Tabellen und die Sync-Tabellen an', () => {
    const db = freshDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);
    for (const table of [...SYNCED_TABLES, 'sync_outbox', 'sync_state']) {
      expect(tables).toContain(table);
    }
  });

  it('enthaelt die eingebauten Notiztypen mit Feldern und Vorlagen', () => {
    const db = freshDb();
    const keys = db
      .prepare('SELECT key FROM note_types WHERE organization_id IS NULL ORDER BY key')
      .all()
      .map((row) => (row as { key: string }).key);
    expect(keys).toEqual(['basic', 'basic_reverse', 'vocabulary']);

    const templates = db
      .prepare('SELECT count(*) AS n FROM card_templates WHERE note_type_id = ?')
      .get(SYSTEM_NOTE_TYPE_IDS.vocabulary) as { n: number };
    expect(templates.n).toBe(2);
  });

  it('prueft Fremdschluessel (Notiz ohne Deck wird abgelehnt)', () => {
    const db = freshDb();
    expect(() =>
      db.exec(`INSERT INTO notes (id, organization_id, note_type_id, deck_id, created_at, updated_at)
               VALUES ('n1', 'o1', '${SYSTEM_NOTE_TYPE_IDS.basic}', 'gibt-es-nicht', 0, 0)`),
    ).toThrow(/FOREIGN KEY/);
  });

  it('nimmt eine Vokabel mit Karte und Lernantwort auf', () => {
    const db = freshDb();
    db.exec(`
      INSERT INTO decks (id, organization_id, name, kind, lang, created_at, updated_at)
        VALUES ('d1', 'o1', 'Vokabeln', 'vocabulary', 'en', 1, 1);
      INSERT INTO notes (id, organization_id, note_type_id, deck_id, fields, level, lang, dedupe_key, created_at, updated_at)
        VALUES ('n1', 'o1', '${SYSTEM_NOTE_TYPE_IDS.vocabulary}', 'd1', '{"word":"house","meaning":"Haus"}',
                'B1', 'en', 'house', 1, 1);
      INSERT INTO cards (id, organization_id, note_id, template_ord, deck_id, due_at, created_at, updated_at)
        VALUES ('c1', 'o1', 'n1', 0, 'd1', 1, 1, 1);
      INSERT INTO review_logs (id, organization_id, card_id, rating, state, due_at, stability, difficulty,
                               scheduled_days, reviewed_at, created_at)
        VALUES ('r1', 'o1', 'c1', 3, 0, 1, 0, 0, 0, 2, 2);
    `);
    const row = db.prepare("SELECT json_extract(fields, '$.word') AS word FROM notes WHERE id = 'n1'").get() as {
      word: string;
    };
    expect(row.word).toBe('house');
  });

  it('lehnt ungueltiges Niveau ab', () => {
    const db = freshDb();
    db.exec("INSERT INTO decks (id, organization_id, name, created_at, updated_at) VALUES ('d1', 'o1', 'x', 1, 1)");
    expect(() =>
      db.exec(`INSERT INTO notes (id, organization_id, note_type_id, deck_id, level, created_at, updated_at)
               VALUES ('n1', 'o1', '${SYSTEM_NOTE_TYPE_IDS.basic}', 'd1', 'D9', 1, 1)`),
    ).toThrow(/CHECK/);
  });
});
