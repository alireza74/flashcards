// Notizen: anlegen (mit Karten je Vorlage), bearbeiten, suchen, Duplikate finden.

import type { LocalDb } from '../db/local-db-types';
import { markDeleted, saveRow } from '../sync/local-write';
import type { LocalRow } from '../sync/table-specs';
import type { DataContext } from './context';
import { getDeckPath } from './decks';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];

export type NoteTypeField = { field_key: string; name: string; ord: number };

export async function getNoteTypeFields(db: LocalDb, noteTypeId: string): Promise<NoteTypeField[]> {
  return db.getAllAsync<NoteTypeField>(
    'SELECT field_key, name, ord FROM note_type_fields WHERE note_type_id = ? AND deleted_at IS NULL ORDER BY ord',
    [noteTypeId],
  );
}

// Artikel und Zusaetze, die beim Duplikat-Vergleich wegfallen ("the house" = "house", "to go" = "go").
const LEADING_WORDS: Record<string, string[]> = {
  en: ['the', 'a', 'an', 'to'],
  de: ['der', 'die', 'das', 'ein', 'eine'],
  fr: ['le', 'la', 'les', 'un', 'une', "l'"],
  es: ['el', 'la', 'los', 'las', 'un', 'una'],
  it: ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', "l'"],
};

/** Bereinigter Vergleichsschluessel: ohne HTML, Klein, ohne Artikel, Leerzeichen zusammengefasst. */
export function normalizeDedupeKey(text: string, lang: string | null): string {
  let key = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const words = LEADING_WORDS[lang?.split('-')[0] ?? ''] ?? [];
  for (const word of words) {
    if (word.endsWith("'") && key.startsWith(word)) {
      key = key.slice(word.length).trim();
      break;
    }
    if (key.startsWith(`${word} `)) {
      key = key.slice(word.length + 1).trim();
      break;
    }
  }
  return key;
}

export type Duplicate = { noteId: string; deckPath: string[] };

/** Gleiche Notizen (gleicher Schluessel, gleiche Sprache) in allen Decks. */
export async function findDuplicates(
  db: LocalDb,
  lang: string | null,
  dedupeKey: string,
  excludeNoteId?: string,
): Promise<Duplicate[]> {
  if (!dedupeKey) return [];
  const rows = await db.getAllAsync<{ id: string; deck_id: string }>(
    `SELECT id, deck_id FROM notes
     WHERE deleted_at IS NULL AND dedupe_key = ? AND ${lang === null ? 'lang IS NULL' : 'lang = ?'} AND id <> ?
     LIMIT 5`,
    lang === null ? [dedupeKey, excludeNoteId ?? ''] : [dedupeKey, lang, excludeNoteId ?? ''],
  );
  const result: Duplicate[] = [];
  for (const row of rows)
    result.push({
      noteId: row.id,
      deckPath: await getDeckPath(db, row.deck_id),
    });
  return result;
}

export type NoteInput = {
  deckId: string;
  noteTypeId: string;
  fields: Record<string, string>;
  level: Level | null;
  lang: string | null;
};

function firstFieldValue(fields: Record<string, string>, order: NoteTypeField[]): string {
  const first = order[0]?.field_key;
  return first ? (fields[first] ?? '') : '';
}

/** Legt die Notiz und je Kartenvorlage eine neue Karte an (sofort faellig). */
export async function createNote(ctx: DataContext, input: NoteInput): Promise<string> {
  const fieldOrder = await getNoteTypeFields(ctx.db, input.noteTypeId);
  const templates = await ctx.db.getAllAsync<{ ord: number }>(
    'SELECT ord FROM card_templates WHERE note_type_id = ? AND deleted_at IS NULL ORDER BY ord',
    [input.noteTypeId],
  );
  const now = ctx.now();
  const noteId = ctx.newId();

  const note: LocalRow = {
    id: noteId,
    organization_id: ctx.organizationId,
    note_type_id: input.noteTypeId,
    deck_id: input.deckId,
    fields: JSON.stringify(input.fields),
    tags: '[]',
    level: input.level,
    topic: null,
    source: null,
    lang: input.lang,
    dedupe_key: normalizeDedupeKey(firstFieldValue(input.fields, fieldOrder), input.lang) || null,
    external_guid: null,
    created_at: null,
    updated_at: null,
    deleted_at: null,
  };
  await saveRow(ctx.db, 'notes', note, now);

  for (const template of templates) {
    await saveRow(
      ctx.db,
      'cards',
      {
        id: ctx.newId(),
        organization_id: ctx.organizationId,
        note_id: noteId,
        template_ord: template.ord,
        deck_id: input.deckId,
        state: 0,
        due_at: now,
        last_review_at: null,
        stability: 0,
        stability_fast: 0,
        difficulty: 0,
        scheduled_days: 0,
        learning_step: 0,
        reps: 0,
        lapses: 0,
        suspended: 0,
        fsrs_model: 'fsrs-7',
        created_at: null,
        updated_at: null,
        deleted_at: null,
      },
      now,
    );
  }
  return noteId;
}

export type NoteForEdit = {
  id: string;
  deck_id: string;
  note_type_id: string;
  fields: Record<string, string>;
  level: Level | null;
  lang: string | null;
};

export async function getNote(db: LocalDb, id: string): Promise<NoteForEdit | null> {
  const row = await db.getFirstAsync<{
    id: string;
    deck_id: string;
    note_type_id: string;
    fields: string;
    level: Level | null;
    lang: string | null;
  }>('SELECT id, deck_id, note_type_id, fields, level, lang FROM notes WHERE id = ? AND deleted_at IS NULL', [id]);
  return row ? { ...row, fields: JSON.parse(row.fields) as Record<string, string> } : null;
}

/** Inhalt und Niveau aendern. Der Lernstand der Karten bleibt unveraendert. */
export async function updateNote(
  ctx: DataContext,
  id: string,
  changes: { fields: Record<string, string>; level: Level | null },
): Promise<void> {
  const row = await ctx.db.getFirstAsync<LocalRow>('SELECT * FROM notes WHERE id = ?', [id]);
  if (!row) throw new Error('note not found');
  const fieldOrder = await getNoteTypeFields(ctx.db, String(row.note_type_id));
  const lang = (row.lang as string | null) ?? null;
  await saveRow(
    ctx.db,
    'notes',
    {
      ...row,
      fields: JSON.stringify(changes.fields),
      level: changes.level,
      dedupe_key: normalizeDedupeKey(firstFieldValue(changes.fields, fieldOrder), lang) || null,
    },
    ctx.now(),
  );
}

/** Notiz und ihre Karten als geloescht markieren. */
export async function deleteNote(ctx: DataContext, id: string): Promise<void> {
  const now = ctx.now();
  const cards = await ctx.db.getAllAsync<{ id: string }>(
    'SELECT id FROM cards WHERE note_id = ? AND deleted_at IS NULL',
    [id],
  );
  for (const card of cards) await markDeleted(ctx.db, 'cards', card.id, now);
  await markDeleted(ctx.db, 'notes', id, now);
}

export type NoteListItem = {
  id: string;
  title: string;
  subtitle: string;
  level: Level | null;
};

/** Notizen eines Decks (ohne Unterdecks), optional gefiltert; Titel = erstes Feld, Untertitel = zweites. */
export async function listNotes(db: LocalDb, deckId: string, search: string, limit = 200): Promise<NoteListItem[]> {
  const term = search.trim().toLowerCase();
  const rows = await db.getAllAsync<{
    id: string;
    fields: string;
    level: Level | null;
    note_type_id: string;
  }>(
    `SELECT id, fields, level, note_type_id FROM notes
     WHERE deck_id = ? AND deleted_at IS NULL ${term ? 'AND lower(fields) LIKE ?' : ''}
     ORDER BY created_at DESC LIMIT ?`,
    term ? [deckId, `%${term}%`, limit] : [deckId, limit],
  );
  const orderCache = new Map<string, NoteTypeField[]>();
  const result: NoteListItem[] = [];
  for (const row of rows) {
    if (!orderCache.has(row.note_type_id))
      orderCache.set(row.note_type_id, await getNoteTypeFields(db, row.note_type_id));
    const order = orderCache.get(row.note_type_id)!;
    const fields = JSON.parse(row.fields) as Record<string, string>;
    result.push({
      id: row.id,
      title: fields[order[0]?.field_key ?? ''] ?? '',
      subtitle: fields[order[1]?.field_key ?? ''] ?? '',
      level: row.level,
    });
  }
  return result;
}
