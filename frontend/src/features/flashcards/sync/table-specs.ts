// Spalten jeder abgeglichenen Tabelle und die Umwandlung zwischen Handy (SQLite) und Server (Postgres).
//
// | Art       | Handy (SQLite)          | Server (Postgres)       |
// |-----------|-------------------------|-------------------------|
// | text      | TEXT                    | text / uuid             |
// | number    | INTEGER / REAL          | integer / numeric / ... |
// | bool      | 0 / 1                   | boolean                 |
// | time      | Millisekunden (UTC)     | timestamptz (ISO-Text)  |
// | json      | JSON-Text               | jsonb (Objekt)          |
// | textArray | JSON-Text '["a","b"]'   | text[]                  |
//
// server_updated_at gibt es nur auf dem Server; beim Holen wird es fuer den Abgleich-Stand gelesen.

import type { SqlValue } from '../db/local-db-types';
import type { SyncedTable } from '../db/schema';

type ColumnKind = 'text' | 'number' | 'bool' | 'time' | 'json' | 'textArray';
type Columns = Record<string, ColumnKind>;

const SYNC_COLUMNS: Columns = {
  created_at: 'time',
  updated_at: 'time',
  deleted_at: 'time',
};

export const TABLE_COLUMNS: Record<SyncedTable, Columns> = {
  deck_configs: {
    id: 'text',
    organization_id: 'text',
    name: 'text',
    desired_retention: 'number',
    learning_steps: 'textArray',
    relearning_steps: 'textArray',
    new_per_day: 'number',
    reviews_per_day: 'number',
    answer_buttons: 'number',
    maximum_interval: 'number',
    ...SYNC_COLUMNS,
  },
  decks: {
    id: 'text',
    organization_id: 'text',
    parent_id: 'text',
    name: 'text',
    kind: 'text',
    lang: 'text',
    config_id: 'text',
    position: 'number',
    ...SYNC_COLUMNS,
  },
  note_types: {
    id: 'text',
    organization_id: 'text',
    key: 'text',
    name: 'text',
    kind: 'text',
    ...SYNC_COLUMNS,
  },
  note_type_fields: {
    id: 'text',
    organization_id: 'text',
    note_type_id: 'text',
    ord: 'number',
    field_key: 'text',
    name: 'text',
    ...SYNC_COLUMNS,
  },
  card_templates: {
    id: 'text',
    organization_id: 'text',
    note_type_id: 'text',
    ord: 'number',
    name: 'text',
    front_template: 'text',
    back_template: 'text',
    ...SYNC_COLUMNS,
  },
  notes: {
    id: 'text',
    organization_id: 'text',
    note_type_id: 'text',
    deck_id: 'text',
    fields: 'json',
    tags: 'textArray',
    level: 'text',
    topic: 'text',
    source: 'text',
    lang: 'text',
    dedupe_key: 'text',
    external_guid: 'text',
    ...SYNC_COLUMNS,
  },
  cards: {
    id: 'text',
    organization_id: 'text',
    note_id: 'text',
    template_ord: 'number',
    deck_id: 'text',
    state: 'number',
    due_at: 'time',
    last_review_at: 'time',
    stability: 'number',
    stability_fast: 'number',
    difficulty: 'number',
    scheduled_days: 'number',
    learning_step: 'number',
    reps: 'number',
    lapses: 'number',
    suspended: 'bool',
    fsrs_model: 'text',
    ...SYNC_COLUMNS,
  },
  // Nur anfuegen: kein updated_at, kein deleted_at.
  review_logs: {
    id: 'text',
    organization_id: 'text',
    card_id: 'text',
    rating: 'number',
    state: 'number',
    due_at: 'time',
    last_review_at: 'time',
    stability: 'number',
    stability_fast: 'number',
    difficulty: 'number',
    scheduled_days: 'number',
    learning_step: 'number',
    reviewed_at: 'time',
    duration_ms: 'number',
    is_test: 'bool',
    created_at: 'time',
  },
};

/** Tabellen, deren Zeilen geaendert werden koennen ("neuere Aenderung gewinnt"). */
export function isMutableTable(table: SyncedTable): boolean {
  return 'updated_at' in TABLE_COLUMNS[table];
}

export type LocalRow = Record<string, SqlValue>;
export type ServerRow = Record<string, unknown>;

function toServerValue(kind: ColumnKind, value: SqlValue): unknown {
  if (value === null) return null;
  switch (kind) {
    case 'time':
      return new Date(Number(value)).toISOString();
    case 'bool':
      return Number(value) === 1;
    case 'json':
    case 'textArray':
      return JSON.parse(String(value)) as unknown;
    default:
      return value;
  }
}

/**
 * Zeitstempel vom Server -> Millisekunden. Postgres liefert Mikrosekunden ("...00.123456+00:00");
 * nicht jede JS-Engine liest mehr als 3 Nachkommastellen, daher vorher kuerzen.
 */
export function parseServerTime(value: string): number {
  const ms = Date.parse(value.replace(/(\.\d{3})\d+/, '$1'));
  if (Number.isNaN(ms)) throw new Error(`invalid server time: ${value}`);
  return ms;
}

function toLocalValue(kind: ColumnKind, value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  switch (kind) {
    case 'time':
      return parseServerTime(String(value));
    case 'bool':
      return value === true ? 1 : 0;
    case 'json':
    case 'textArray':
      return JSON.stringify(value);
    case 'number':
      return Number(value);
    default:
      return String(value);
  }
}

/** Zeile vom Handy -> Format fuer Supabase. */
export function toServerRow(table: SyncedTable, row: LocalRow): ServerRow {
  const result: ServerRow = {};
  for (const [column, kind] of Object.entries(TABLE_COLUMNS[table])) {
    result[column] = toServerValue(kind, row[column] ?? null);
  }
  return result;
}

/** Zeile von Supabase -> Format fuer das Handy (server_updated_at faellt weg). */
export function toLocalRow(table: SyncedTable, row: ServerRow): LocalRow {
  const result: LocalRow = {};
  for (const [column, kind] of Object.entries(TABLE_COLUMNS[table])) {
    result[column] = toLocalValue(kind, row[column]);
  }
  return result;
}
