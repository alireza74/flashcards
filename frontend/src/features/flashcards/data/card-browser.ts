// Kartenliste: Notizen eines Decks (mit Unterdecks) suchen, filtern, seitenweise laden, verschieben.
//
// Filter: Suchtext, Niveau, Kartei-Box-Fach. Das Fach ist eine Eigenschaft der KARTE; eine Notiz passt,
// wenn mindestens eine ihrer Karten in dem Fach liegt (Vokabel = zwei Karten, je Richtung eine).

import type { LocalDb, SqlValue } from '../db/local-db-types';
import { saveRows } from '../sync/local-write';
import type { LocalRow } from '../sync/table-specs';
import type { DataContext } from './context';
import { getDeckTreeIds } from './decks';
import { getNoteTypeFields, type Level, type NoteTypeField } from './notes';
import { MATURE_DAYS } from './stats';

export type BoxFilter = 'new' | 'learning' | 'young' | 'mature';
export const BOX_FILTERS: BoxFilter[] = ['new', 'learning', 'young', 'mature'];
export const NO_LEVEL = 'none';

export type NoteFilter = {
  deckId: string;
  search: string;
  /** null = alle, 'none' = ohne Niveau */
  level: Level | typeof NO_LEVEL | null;
  box: BoxFilter | null;
};

export type BrowseItem = {
  id: string;
  title: string;
  subtitle: string;
  level: Level | null;
  deckId: string;
};

const BOX_CONDITIONS: Record<BoxFilter, string> = {
  new: 'c.state = 0',
  learning: 'c.state IN (1, 3)',
  young: `c.state = 2 AND c.scheduled_days < ${MATURE_DAYS}`,
  mature: `c.state = 2 AND c.scheduled_days >= ${MATURE_DAYS}`,
};

async function whereClause(db: LocalDb, filter: NoteFilter): Promise<{ sql: string; params: SqlValue[] }> {
  const deckIds = await getDeckTreeIds(db, filter.deckId);
  const parts = [`n.deleted_at IS NULL`, `n.deck_id IN (${deckIds.map(() => '?').join(', ') || 'NULL'})`];
  const params: SqlValue[] = [...deckIds];
  const term = filter.search.trim().toLowerCase();
  if (term) {
    parts.push('lower(n.fields) LIKE ?');
    params.push(`%${term}%`);
  }
  if (filter.level === NO_LEVEL) parts.push('n.level IS NULL');
  else if (filter.level) {
    parts.push('n.level = ?');
    params.push(filter.level);
  }
  if (filter.box) {
    parts.push(
      `EXISTS (SELECT 1 FROM cards c WHERE c.note_id = n.id AND c.deleted_at IS NULL AND ${BOX_CONDITIONS[filter.box]})`,
    );
  }
  return { sql: parts.join(' AND '), params };
}

export async function countNotes(db: LocalDb, filter: NoteFilter): Promise<number> {
  const where = await whereClause(db, filter);
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT count(*) AS n FROM notes n WHERE ${where.sql}`,
    where.params,
  );
  return row?.n ?? 0;
}

/** Notizen nach Filter, neueste zuerst; Titel = erstes Feld, Untertitel = zweites. */
export async function browseNotes(db: LocalDb, filter: NoteFilter, limit: number): Promise<BrowseItem[]> {
  const where = await whereClause(db, filter);
  const rows = await db.getAllAsync<{
    id: string;
    fields: string;
    level: Level | null;
    note_type_id: string;
    deck_id: string;
  }>(
    `SELECT n.id, n.fields, n.level, n.note_type_id, n.deck_id FROM notes n WHERE ${where.sql}
     ORDER BY n.created_at DESC, n.id LIMIT ?`,
    [...where.params, limit],
  );
  const orderCache = new Map<string, NoteTypeField[]>();
  const result: BrowseItem[] = [];
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
      deckId: row.deck_id,
    });
  }
  return result;
}

const MOVE_BATCH = 200;

/** Alle Notizen nach Filter (mit ihren Karten) in ein anderes Deck verschieben. Lernstand bleibt. */
export async function moveNotes(ctx: DataContext, filter: NoteFilter, targetDeckId: string): Promise<number> {
  const where = await whereClause(ctx.db, filter);
  const ids = (
    await ctx.db.getAllAsync<{ id: string }>(`SELECT n.id FROM notes n WHERE ${where.sql} AND n.deck_id <> ?`, [
      ...where.params,
      targetDeckId,
    ])
  ).map((row) => row.id);

  for (let offset = 0; offset < ids.length; offset += MOVE_BATCH) {
    const batch = ids.slice(offset, offset + MOVE_BATCH);
    const marks = batch.map(() => '?').join(', ');
    const notes = await ctx.db.getAllAsync<LocalRow>(`SELECT * FROM notes WHERE id IN (${marks})`, batch);
    const cards = await ctx.db.getAllAsync<LocalRow>(
      `SELECT * FROM cards WHERE deleted_at IS NULL AND note_id IN (${marks})`,
      batch,
    );
    await saveRows(
      ctx.db,
      [
        ...notes.map((row) => ({ table: 'notes' as const, row: { ...row, deck_id: targetDeckId } })),
        ...cards.map((row) => ({ table: 'cards' as const, row: { ...row, deck_id: targetDeckId } })),
      ],
      ctx.now(),
    );
  }
  return ids.length;
}
