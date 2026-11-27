// Decks: lesen, anlegen, umbenennen, loeschen (Loeschmarker fuer das ganze Teilbaum).

import type { LocalDb } from '../db/local-db-types';
import { markDeleted, saveRow } from '../sync/local-write';
import type { LocalRow } from '../sync/table-specs';
import type { DataContext } from './context';

export type DeckKind = 'general' | 'vocabulary' | 'phrases' | 'grammar';

export type Deck = {
  id: string;
  parent_id: string | null;
  name: string;
  kind: DeckKind;
  lang: string | null;
  config_id: string | null;
  position: number;
};

const DECK_COLUMNS = 'id, parent_id, name, kind, lang, config_id, position';

export async function listChildDecks(db: LocalDb, parentId: string | null): Promise<Deck[]> {
  return db.getAllAsync<Deck>(
    `SELECT ${DECK_COLUMNS} FROM decks
     WHERE deleted_at IS NULL AND ${parentId === null ? 'parent_id IS NULL' : 'parent_id = ?'}
     ORDER BY position, name COLLATE NOCASE`,
    parentId === null ? [] : [parentId],
  );
}

export async function getDeck(db: LocalDb, id: string): Promise<Deck | null> {
  return db.getFirstAsync<Deck>(`SELECT ${DECK_COLUMNS} FROM decks WHERE id = ? AND deleted_at IS NULL`, [id]);
}

/** Pfad vom obersten Deck bis zu diesem, z. B. ["Englisch", "Vokabeln"]. */
export async function getDeckPath(db: LocalDb, id: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `WITH RECURSIVE up(id, parent_id, name, depth) AS (
       SELECT id, parent_id, name, 0 FROM decks WHERE id = ?
       UNION ALL
       SELECT d.id, d.parent_id, d.name, up.depth + 1 FROM decks d JOIN up ON d.id = up.parent_id
     )
     SELECT name FROM up ORDER BY depth DESC`,
    [id],
  );
  return rows.map((row) => row.name);
}

/** IDs des Decks und aller Unterdecks (beliebig tief, ohne geloeschte). */
export async function getDeckTreeIds(db: LocalDb, id: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ id: string }>(
    `WITH RECURSIVE down(id) AS (
       SELECT id FROM decks WHERE id = ? AND deleted_at IS NULL
       UNION ALL
       SELECT d.id FROM decks d JOIN down ON d.parent_id = down.id WHERE d.deleted_at IS NULL
     )
     SELECT id FROM down`,
    [id],
  );
  return rows.map((row) => row.id);
}

/** Neue Lernoptionen anlegen (Standardwerte, einzelne Werte ueberschreibbar). */
export async function createConfig(
  ctx: DataContext,
  name: string,
  values: Partial<Pick<LocalRow, 'new_per_day' | 'reviews_per_day'>> = {},
): Promise<string> {
  const id = ctx.newId();
  await saveRow(
    ctx.db,
    'deck_configs',
    {
      id,
      organization_id: ctx.organizationId,
      name,
      desired_retention: 0.9,
      learning_steps: JSON.stringify(['1m', '10m']),
      relearning_steps: JSON.stringify(['10m']),
      new_per_day: 20,
      reviews_per_day: 200,
      answer_buttons: 2,
      maximum_interval: 36500,
      ...values,
      created_at: null,
      updated_at: null,
      deleted_at: null,
    },
    ctx.now(),
  );
  return id;
}

/** Standard-Lernoptionen der Organisation; beim ersten Aufruf anlegen. */
export async function ensureDefaultConfig(ctx: DataContext, name: string): Promise<string> {
  const existing = await ctx.db.getFirstAsync<{ id: string }>(
    'SELECT id FROM deck_configs WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1',
    [],
  );
  return existing ? existing.id : createConfig(ctx, name);
}

export type NewDeck = {
  name: string;
  parentId: string | null;
  kind: DeckKind;
  lang: string | null;
};

export async function createDeck(ctx: DataContext, deck: NewDeck, configId: string | null): Promise<string> {
  const id = ctx.newId();
  const siblings = await listChildDecks(ctx.db, deck.parentId);
  const row: LocalRow = {
    id,
    organization_id: ctx.organizationId,
    parent_id: deck.parentId,
    name: deck.name.trim(),
    kind: deck.kind,
    lang: deck.lang,
    config_id: configId,
    position: siblings.length,
    created_at: null,
    updated_at: null,
    deleted_at: null,
  };
  await saveRow(ctx.db, 'decks', row, ctx.now());
  return id;
}

export async function renameDeck(ctx: DataContext, id: string, name: string): Promise<void> {
  const row = await ctx.db.getFirstAsync<LocalRow>('SELECT * FROM decks WHERE id = ?', [id]);
  if (!row) throw new Error('deck not found');
  await saveRow(ctx.db, 'decks', { ...row, name: name.trim() }, ctx.now());
}

/** Deck mit allen Unterdecks, Notizen und Karten als geloescht markieren. */
export async function deleteDeckTree(ctx: DataContext, id: string): Promise<void> {
  const deckIds = await getDeckTreeIds(ctx.db, id);
  if (deckIds.length === 0) return;
  const marks = deckIds.map(() => '?').join(', ');
  const now = ctx.now();

  const cards = await ctx.db.getAllAsync<{ id: string }>(
    `SELECT id FROM cards WHERE deleted_at IS NULL AND deck_id IN (${marks})`,
    deckIds,
  );
  const notes = await ctx.db.getAllAsync<{ id: string }>(
    `SELECT id FROM notes WHERE deleted_at IS NULL AND deck_id IN (${marks})`,
    deckIds,
  );
  for (const card of cards) await markDeleted(ctx.db, 'cards', card.id, now);
  for (const note of notes) await markDeleted(ctx.db, 'notes', note.id, now);
  // Unterdecks zuerst (umgekehrte Reihenfolge des Baums)
  for (const deckId of [...deckIds].reverse()) await markDeleted(ctx.db, 'decks', deckId, now);
}
