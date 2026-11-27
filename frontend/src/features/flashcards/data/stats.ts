// Zaehlungen fuer "Heute" und die Kartei-Box.
//
// Kartei-Box (aus FSRS-Zustand, state: 0 neu, 1 lernen, 2 wiederholen, 3 neu lernen):
//   Neu       state 0
//   Lernen    state 1 oder 3
//   Jung      state 2 und Abstand < 21 Tage
//   Gefestigt state 2 und Abstand >= 21 Tage   ("gelernt")

import type { LocalDb } from '../db/local-db-types';
import { loadStudyCards } from '../study/queue';
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
  /** faellig: Lernkarten bis jetzt + 20 min, Wiederholungen bis Ende des Lerntags (wie die Lernsitzung) */
  due: number;
  /** neue Karten, die heute noch drankommen (begrenzt durch das Tageslimit) */
  newToday: number;
};

function inList(ids: string[]): string {
  return ids.map(() => '?').join(', ');
}

async function countsForDecks(
  db: LocalDb,
  deckIds: string[],
  now: number,
  startDeckId: string | null,
): Promise<DeckCounts> {
  const empty: DeckCounts = { new: 0, learning: 0, young: 0, mature: 0, total: 0, due: 0, newToday: 0 };
  if (deckIds.length === 0) return empty;

  const row = await db.getFirstAsync<BoxCounts>(
    `SELECT
       coalesce(sum(state = 0), 0) AS new,
       coalesce(sum(state IN (1, 3)), 0) AS learning,
       coalesce(sum(state = 2 AND scheduled_days < ${MATURE_DAYS}), 0) AS young,
       coalesce(sum(state = 2 AND scheduled_days >= ${MATURE_DAYS}), 0) AS mature,
       count(*) AS total
     FROM cards
     WHERE deleted_at IS NULL AND suspended = 0 AND deck_id IN (${inList(deckIds)})`,
    deckIds,
  );

  // Faellig und neu heute: dieselbe Auswahl wie die Lernsitzung (Tageslimits, Gegenrichtung bis morgen)
  const load = await loadStudyCards(db, deckIds, startDeckId, now);
  const newToday = load.queue.filter((card) => card.state === 0).length;
  return { ...empty, ...row, due: load.learning.length + load.queue.length - newToday, newToday };
}

/** Zaehlungen fuer ein Deck einschliesslich aller Unterdecks. */
export async function getDeckCounts(db: LocalDb, deckId: string, now: number): Promise<DeckCounts> {
  return countsForDecks(db, await getDeckTreeIds(db, deckId), now, deckId);
}

/** Zaehlungen ueber alle Decks (Startseite "Heute"). */
export async function getTodayCounts(db: LocalDb, now: number): Promise<DeckCounts> {
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM decks WHERE deleted_at IS NULL', []);
  return countsForDecks(
    db,
    rows.map((r) => r.id),
    now,
    null,
  );
}
