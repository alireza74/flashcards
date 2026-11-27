// Zaehlungen fuer "Heute" und die Kartei-Box.
//
// Kartei-Box (aus FSRS-Zustand, state: 0 neu, 1 lernen, 2 wiederholen, 3 neu lernen):
//   Neu       state 0
//   Lernen    state 1 oder 3
//   Jung      state 2 und Abstand < 21 Tage
//   Gefestigt state 2 und Abstand >= 21 Tage   ("gelernt")

import type { LocalDb } from '../db/local-db-types';
import { LEARN_AHEAD_MS, loadStudyCards } from '../study/queue';
import { startOfNextStudyDay, startOfStudyDay } from '../study/study-day';
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

export type TodayProgress = {
  /** heute schon beantwortete Karten (jede Karte einmal gezaehlt, ohne Testmodus) */
  done: number;
  /** jetzt noch offen: faellig + neue fuer heute (wie die Lernsitzung) */
  open: number;
  /** Lernkarten, die heute spaeter noch einmal kommen (nach dem 20-Minuten-Fenster) */
  comingBack: number;
  /** 0..1 fuer den Ring */
  ratio: number;
  /** nothing = heute nichts zu tun, open = noch offen, done = alles fuer heute geschafft */
  status: 'nothing' | 'open' | 'done';
};

/**
 * Fortschritt fuer den Ring: alle Decks (Startseite) oder nur die angegebenen (Bereich mit Unterdecks).
 * totals muss zu denselben Decks gehoeren (getTodayCounts bzw. getDeckCounts).
 */
export async function getTodayProgress(
  db: LocalDb,
  now: number,
  totals: DeckCounts,
  deckIds?: string[],
): Promise<TodayProgress> {
  const dayStart = startOfStudyDay(now);
  const deckFilter = deckIds ? `AND c.deck_id IN (${inList(deckIds) || 'NULL'})` : '';
  const doneRow = await db.getFirstAsync<{ n: number }>(
    `SELECT count(DISTINCT r.card_id) AS n FROM review_logs r JOIN cards c ON c.id = r.card_id
     WHERE r.is_test = 0 AND r.reviewed_at >= ? ${deckFilter}`,
    [dayStart, ...(deckIds ?? [])],
  );
  const laterRow = await db.getFirstAsync<{ n: number }>(
    `SELECT count(*) AS n FROM cards c JOIN decks d ON d.id = c.deck_id
     WHERE c.deleted_at IS NULL AND d.deleted_at IS NULL AND c.suspended = 0 AND c.state IN (1, 3)
       AND c.due_at > ? AND c.due_at < ? ${deckFilter}`,
    [now + LEARN_AHEAD_MS, startOfNextStudyDay(now), ...(deckIds ?? [])],
  );
  const done = doneRow?.n ?? 0;
  const open = totals.due + totals.newToday;
  const status = open > 0 ? 'open' : done > 0 ? 'done' : 'nothing';
  return {
    done,
    open,
    comingBack: laterRow?.n ?? 0,
    ratio: done + open === 0 ? 0 : done / (done + open),
    status,
  };
}
