// Zaehlungen fuer "Heute" und die Kartei-Box.
//
// Kartei-Box (aus FSRS-Zustand, state: 0 neu, 1 lernen, 2 wiederholen, 3 neu lernen):
//   Neu       state 0
//   Lernen    state 1 oder 3
//   Jung      state 2 und Abstand < 21 Tage
//   Gefestigt state 2 und Abstand >= 21 Tage   ("gelernt")

import type { LocalDb } from '../db/local-db-types';
import { getDeckTreeIds } from './decks';

export const MATURE_DAYS = 21;

export type BoxCounts = {
  new: number;
  learning: number;
  young: number;
  mature: number;
  total: number;
};

export type DeckCounts = BoxCounts & {
  /** faellige Wiederholungen und Lernschritte (state != 0, due_at <= jetzt) */
  due: number;
  /** neue Karten, die heute noch drankommen (begrenzt durch das Tageslimit) */
  newToday: number;
};

function inList(ids: string[]): string {
  return ids.map(() => '?').join(', ');
}

/** Beginn des heutigen Tages (lokale Zeit des Geraets) in Millisekunden. */
export function startOfToday(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

async function countsForDecks(db: LocalDb, deckIds: string[], now: number, newPerDay: number): Promise<DeckCounts> {
  const empty: DeckCounts = {
    new: 0,
    learning: 0,
    young: 0,
    mature: 0,
    total: 0,
    due: 0,
    newToday: 0,
  };
  if (deckIds.length === 0) return empty;

  const row = await db.getFirstAsync<{
    new: number;
    learning: number;
    young: number;
    mature: number;
    total: number;
    due: number;
  }>(
    `SELECT
       coalesce(sum(state = 0), 0) AS new,
       coalesce(sum(state IN (1, 3)), 0) AS learning,
       coalesce(sum(state = 2 AND scheduled_days < ${MATURE_DAYS}), 0) AS young,
       coalesce(sum(state = 2 AND scheduled_days >= ${MATURE_DAYS}), 0) AS mature,
       count(*) AS total,
       coalesce(sum(state <> 0 AND due_at <= ?), 0) AS due
     FROM cards
     WHERE deleted_at IS NULL AND suspended = 0 AND deck_id IN (${inList(deckIds)})`,
    [now, ...deckIds],
  );

  // Heute schon eingefuehrte neue Karten (erste Antwort heute, ohne Testmodus)
  const introduced = await db.getFirstAsync<{ n: number }>(
    `SELECT count(DISTINCT r.card_id) AS n FROM review_logs r JOIN cards c ON c.id = r.card_id
     WHERE r.state = 0 AND r.is_test = 0 AND r.reviewed_at >= ? AND c.deck_id IN (${inList(deckIds)})`,
    [startOfToday(now), ...deckIds],
  );

  const counts = { ...empty, ...row };
  counts.newToday = Math.max(0, Math.min(counts.new, newPerDay - (introduced?.n ?? 0)));
  return counts;
}

async function newPerDayFor(db: LocalDb, deckId: string | null): Promise<number> {
  const row = await db.getFirstAsync<{ new_per_day: number }>(
    deckId
      ? `SELECT c.new_per_day FROM decks d JOIN deck_configs c ON c.id = d.config_id WHERE d.id = ?`
      : 'SELECT new_per_day FROM deck_configs WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1',
    deckId ? [deckId] : [],
  );
  return row?.new_per_day ?? 20;
}

/** Zaehlungen fuer ein Deck einschliesslich aller Unterdecks. */
export async function getDeckCounts(db: LocalDb, deckId: string, now: number): Promise<DeckCounts> {
  const ids = await getDeckTreeIds(db, deckId);
  return countsForDecks(db, ids, now, await newPerDayFor(db, deckId));
}

/** Zaehlungen ueber alle Decks (Startseite "Heute"). */
export async function getTodayCounts(db: LocalDb, now: number): Promise<DeckCounts> {
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM decks WHERE deleted_at IS NULL', []);
  return countsForDecks(
    db,
    rows.map((r) => r.id),
    now,
    await newPerDayFor(db, null),
  );
}
