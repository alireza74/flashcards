// Lernpensum: Tageslimits (neu pro Tag, Wiederholungen pro Tag) je Deck lesen und aendern.
//
// Was ein Limit begrenzt, steht in study/queue.ts (Kopfkommentar "Tageslimits"):
//   - ein Deck sich selbst und seine Unterdecks zusammen,
//   - ein oberstes Deck (Bereich) nur die Karten direkt darin.
// Darum zeigt die Seite fuer einen Bereich je Unterdeck eine Zeile (plus den Bereich selbst, falls direkt
// Karten darin liegen) und fuer jedes andere Deck genau eine Zeile.
//
// Aendern: Teilt sich das Deck seine Lernoptionen mit anderen Decks, bekommt es eine eigene Kopie -
// die anderen Decks bleiben unveraendert.

import type { LocalDb } from '../db/local-db-types';
import { DEFAULT_CONFIG } from '../study/queue';
import { saveRows } from '../sync/local-write';
import type { LocalRow } from '../sync/table-specs';
import type { DataContext } from './context';
import { getDeck, getDeckTreeIds, listChildDecks, type Deck } from './decks';

export type PensumRow = {
  deckId: string;
  name: string;
  newPerDay: number;
  reviewsPerDay: number;
  /** neue Karten, die noch warten (im Bereich der Zeile) */
  waitingNew: number;
  /** Zeile fuer die Karten DIREKT im Bereich (nicht in seinen Unterdecks) */
  direct: boolean;
};

/** Hoechstens so viele neue Karten kommen pro Tag: je Zeile Limit, aber nicht mehr als wartende. */
export function possibleNewPerDay(rows: { newPerDay: number; waitingNew: number }[]): number {
  return rows.reduce((sum, row) => sum + Math.min(row.newPerDay, row.waitingNew), 0);
}

export type Limits = { newPerDay: number; reviewsPerDay: number };

export const MAX_PER_DAY = 9999;

async function countNew(db: LocalDb, deckIds: string[]): Promise<number> {
  if (deckIds.length === 0) return 0;
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT count(*) AS n FROM cards
     WHERE deleted_at IS NULL AND suspended = 0 AND state = 0 AND deck_id IN (${deckIds.map(() => '?').join(', ')})`,
    deckIds,
  );
  return row?.n ?? 0;
}

async function limitsOf(db: LocalDb, deck: Deck): Promise<Limits> {
  const config = deck.config_id
    ? await db.getFirstAsync<{ new_per_day: number; reviews_per_day: number }>(
        'SELECT new_per_day, reviews_per_day FROM deck_configs WHERE id = ? AND deleted_at IS NULL',
        [deck.config_id],
      )
    : null;
  return {
    newPerDay: config?.new_per_day ?? DEFAULT_CONFIG.new_per_day,
    reviewsPerDay: config?.reviews_per_day ?? DEFAULT_CONFIG.reviews_per_day,
  };
}

export async function getPensum(db: LocalDb, deckId: string): Promise<PensumRow[]> {
  const deck = await getDeck(db, deckId);
  if (!deck) return [];
  const children = await listChildDecks(db, deckId);

  if (deck.parent_id !== null || children.length === 0) {
    return [
      {
        deckId: deck.id,
        name: deck.name,
        ...(await limitsOf(db, deck)),
        waitingNew: await countNew(db, await getDeckTreeIds(db, deck.id)),
        direct: false,
      },
    ];
  }

  const rows: PensumRow[] = [];
  const direct = await db.getFirstAsync<{ n: number }>(
    'SELECT count(*) AS n FROM cards WHERE deleted_at IS NULL AND deck_id = ?',
    [deck.id],
  );
  if ((direct?.n ?? 0) > 0) {
    rows.push({
      deckId: deck.id,
      name: deck.name,
      ...(await limitsOf(db, deck)),
      waitingNew: await countNew(db, [deck.id]),
      direct: true,
    });
  }
  for (const child of children) {
    rows.push({
      deckId: child.id,
      name: child.name,
      ...(await limitsOf(db, child)),
      waitingNew: await countNew(db, await getDeckTreeIds(db, child.id)),
      direct: false,
    });
  }
  return rows;
}

function clamp(value: number): number {
  return Math.min(MAX_PER_DAY, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}

/** Tageslimits eines Decks setzen (bei geteilten Lernoptionen mit eigener Kopie). */
export async function setDeckLimits(ctx: DataContext, deckId: string, limits: Limits): Promise<void> {
  const deck = await ctx.db.getFirstAsync<LocalRow>('SELECT * FROM decks WHERE id = ? AND deleted_at IS NULL', [
    deckId,
  ]);
  if (!deck) throw new Error('deck not found');
  const values = { new_per_day: clamp(limits.newPerDay), reviews_per_day: clamp(limits.reviewsPerDay) };

  const configId = deck.config_id as string | null;
  const config = configId
    ? await ctx.db.getFirstAsync<LocalRow>('SELECT * FROM deck_configs WHERE id = ? AND deleted_at IS NULL', [configId])
    : null;
  const shared = configId
    ? await ctx.db.getFirstAsync<{ n: number }>(
        'SELECT count(*) AS n FROM decks WHERE config_id = ? AND id <> ? AND deleted_at IS NULL',
        [configId, deckId],
      )
    : null;

  if (config && (shared?.n ?? 0) === 0) {
    if (config.new_per_day === values.new_per_day && config.reviews_per_day === values.reviews_per_day) return;
    await saveRows(ctx.db, [{ table: 'deck_configs', row: { ...config, ...values } }], ctx.now());
    return;
  }

  // eigene Kopie anlegen und dem Deck zuordnen - beides in einer Transaktion
  const newConfig: LocalRow = {
    id: ctx.newId(),
    organization_id: ctx.organizationId,
    name: String(deck.name),
    desired_retention: config?.desired_retention ?? DEFAULT_CONFIG.desired_retention,
    learning_steps: config?.learning_steps ?? DEFAULT_CONFIG.learning_steps,
    relearning_steps: config?.relearning_steps ?? DEFAULT_CONFIG.relearning_steps,
    answer_buttons: config?.answer_buttons ?? DEFAULT_CONFIG.answer_buttons,
    maximum_interval: config?.maximum_interval ?? DEFAULT_CONFIG.maximum_interval,
    ...values,
    created_at: null,
    updated_at: null,
    deleted_at: null,
  };
  await saveRows(
    ctx.db,
    [
      { table: 'deck_configs', row: newConfig },
      { table: 'decks', row: { ...deck, config_id: newConfig.id } },
    ],
    ctx.now(),
  );
}
