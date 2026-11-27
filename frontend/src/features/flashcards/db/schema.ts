// Schema der lokalen Datenbank (SQLite auf dem Geraet). Sie ist die Hauptquelle der App;
// Supabase wird im Hintergrund abgeglichen. Erklaerung: docs/lernen/10-datenmodell.md
//
// Unterschiede zu Supabase (Postgres):
// - Zeiten als Zahl: Millisekunden seit 1970, UTC
// - Listen (tags, learning_steps) und notes.fields als JSON-Text
// - Wahrheitswerte als 0/1
// - kein server_updated_at (nur der Server braucht es); dafuer sync_outbox und sync_state
//
// Regel: Eine einmal ausgelieferte Migration wird nie mehr geaendert - Aenderungen immer als neue
// Migration hinten anfuegen. Die Nummer steht in PRAGMA user_version.

import { SYSTEM_NOTE_TYPES } from './system-note-types';

// Spalten, die jede abgeglichene Tabelle hat
const SYNC_COLUMNS = `
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER`;

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

function systemNoteTypeInserts(): string {
  const now = 0; // eingebaute Datensaetze: fester Zeitpunkt, damit sie nie "neuer" als der Server sind
  const rows: string[] = [];
  for (const type of SYSTEM_NOTE_TYPES) {
    rows.push(
      `INSERT INTO note_types (id, organization_id, key, name, kind, created_at, updated_at)
       VALUES (${sqlString(type.id)}, NULL, ${sqlString(type.key)}, ${sqlString(type.name)}, 'standard', ${now}, ${now});`,
    );
    for (const field of type.fields) {
      rows.push(
        `INSERT INTO note_type_fields (id, organization_id, note_type_id, ord, field_key, name, created_at, updated_at)
         VALUES (${sqlString(field.id)}, NULL, ${sqlString(type.id)}, ${field.ord}, ${sqlString(field.fieldKey)},
                 ${sqlString(field.name)}, ${now}, ${now});`,
      );
    }
    for (const template of type.templates) {
      rows.push(
        `INSERT INTO card_templates (id, organization_id, note_type_id, ord, name, front_template, back_template,
                                     created_at, updated_at)
         VALUES (${sqlString(template.id)}, NULL, ${sqlString(type.id)}, ${template.ord}, ${sqlString(template.name)},
                 ${sqlString(template.front)}, ${sqlString(template.back)}, ${now}, ${now});`,
      );
    }
  }
  return rows.join('\n');
}

const MIGRATION_1 = `
CREATE TABLE deck_configs (
  id                TEXT PRIMARY KEY NOT NULL,
  organization_id   TEXT NOT NULL,
  name              TEXT NOT NULL,
  desired_retention REAL NOT NULL DEFAULT 0.9,
  learning_steps    TEXT NOT NULL DEFAULT '["1m","10m"]',
  relearning_steps  TEXT NOT NULL DEFAULT '["10m"]',
  new_per_day       INTEGER NOT NULL DEFAULT 20,
  reviews_per_day   INTEGER NOT NULL DEFAULT 200,
  answer_buttons    INTEGER NOT NULL DEFAULT 2 CHECK (answer_buttons IN (2, 4)),
  maximum_interval  INTEGER NOT NULL DEFAULT 36500,
  ${SYNC_COLUMNS}
);

CREATE TABLE decks (
  id              TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  parent_id       TEXT REFERENCES decks (id),
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general', 'vocabulary', 'phrases', 'grammar')),
  lang            TEXT,
  config_id       TEXT REFERENCES deck_configs (id),
  position        INTEGER NOT NULL DEFAULT 0,
  ${SYNC_COLUMNS}
);
CREATE INDEX decks_parent_idx ON decks (parent_id);

CREATE TABLE note_types (
  id              TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT,
  key             TEXT,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'standard' CHECK (kind IN ('standard', 'cloze')),
  ${SYNC_COLUMNS}
);

CREATE TABLE note_type_fields (
  id              TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT,
  note_type_id    TEXT NOT NULL REFERENCES note_types (id),
  ord             INTEGER NOT NULL,
  field_key       TEXT NOT NULL,
  name            TEXT NOT NULL,
  ${SYNC_COLUMNS},
  UNIQUE (note_type_id, ord),
  UNIQUE (note_type_id, field_key)
);

CREATE TABLE card_templates (
  id              TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT,
  note_type_id    TEXT NOT NULL REFERENCES note_types (id),
  ord             INTEGER NOT NULL,
  name            TEXT NOT NULL,
  front_template  TEXT NOT NULL,
  back_template   TEXT NOT NULL,
  ${SYNC_COLUMNS},
  UNIQUE (note_type_id, ord)
);

CREATE TABLE notes (
  id              TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  note_type_id    TEXT NOT NULL REFERENCES note_types (id),
  deck_id         TEXT NOT NULL REFERENCES decks (id),
  fields          TEXT NOT NULL DEFAULT '{}',
  tags            TEXT NOT NULL DEFAULT '[]',
  level           TEXT CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  topic           TEXT,
  source          TEXT,
  lang            TEXT,
  dedupe_key      TEXT,
  external_guid   TEXT,
  ${SYNC_COLUMNS}
);
CREATE INDEX notes_dedupe_idx ON notes (lang, dedupe_key) WHERE deleted_at IS NULL;
CREATE INDEX notes_external_guid_idx ON notes (external_guid) WHERE external_guid IS NOT NULL;
CREATE INDEX notes_deck_idx ON notes (deck_id);

CREATE TABLE cards (
  id              TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  note_id         TEXT NOT NULL REFERENCES notes (id),
  template_ord    INTEGER NOT NULL,
  deck_id         TEXT NOT NULL REFERENCES decks (id),
  state           INTEGER NOT NULL DEFAULT 0 CHECK (state BETWEEN 0 AND 3),
  due_at          INTEGER NOT NULL,
  last_review_at  INTEGER,
  stability       REAL NOT NULL DEFAULT 0,
  stability_fast  REAL NOT NULL DEFAULT 0,
  difficulty      REAL NOT NULL DEFAULT 0,
  scheduled_days  REAL NOT NULL DEFAULT 0,
  learning_step   INTEGER NOT NULL DEFAULT 0,
  reps            INTEGER NOT NULL DEFAULT 0,
  lapses          INTEGER NOT NULL DEFAULT 0,
  suspended       INTEGER NOT NULL DEFAULT 0,
  fsrs_model      TEXT NOT NULL DEFAULT 'fsrs-7',
  ${SYNC_COLUMNS},
  UNIQUE (note_id, template_ord)
);
CREATE INDEX cards_due_idx ON cards (due_at) WHERE deleted_at IS NULL AND suspended = 0;
CREATE INDEX cards_deck_idx ON cards (deck_id);

CREATE TABLE review_logs (
  id              TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  card_id         TEXT NOT NULL REFERENCES cards (id),
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  state           INTEGER NOT NULL,
  due_at          INTEGER NOT NULL,
  last_review_at  INTEGER,
  stability       REAL NOT NULL,
  stability_fast  REAL NOT NULL DEFAULT 0,
  difficulty      REAL NOT NULL,
  scheduled_days  REAL NOT NULL,
  learning_step   INTEGER NOT NULL DEFAULT 0,
  reviewed_at     INTEGER NOT NULL,
  duration_ms     INTEGER,
  is_test         INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);
CREATE INDEX review_logs_card_idx ON review_logs (card_id, reviewed_at);

-- Warteschlange: Aenderungen, die noch nicht an Supabase gesendet wurden.
CREATE TABLE sync_outbox (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name  TEXT NOT NULL,
  row_id      TEXT NOT NULL,
  op          TEXT NOT NULL CHECK (op IN ('upsert', 'insert')),
  created_at  INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  failed      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sync_outbox_pending_idx ON sync_outbox (failed, seq);

-- Stand des letzten Abgleichs je Tabelle (Server-Zeit als ISO-Text, wie von Supabase geliefert).
CREATE TABLE sync_state (
  table_name      TEXT PRIMARY KEY NOT NULL,
  last_pulled_at  TEXT
);

-- Lokale Einstellungen ohne Abgleich, z. B. organization_id (damit offline geschrieben werden kann).
CREATE TABLE local_meta (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

${systemNoteTypeInserts()}
`;

/** Migrationen in Reihenfolge; Index + 1 = Versionsnummer in PRAGMA user_version. */
export const LOCAL_DB_MIGRATIONS: readonly string[] = [MIGRATION_1];

/** Tabellen, die mit Supabase abgeglichen werden - in der Reihenfolge, in der gesendet wird (Fremdschluessel). */
export const SYNCED_TABLES = [
  'deck_configs',
  'decks',
  'note_types',
  'note_type_fields',
  'card_templates',
  'notes',
  'cards',
  'review_logs',
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];
