// Welche Karten kommen in eine Lernsitzung, und in welcher Reihenfolge?
//
// loadStudyCards (Datenbank):
//   - Lernkarten (Lernen / Neu lernen) mit Termin bis "jetzt + 20 min"
//   - Wiederholungen mit Termin bis Ende des Lerntags (4 Uhr) und neue Karten in der Reihenfolge des Anlegens,
//     jeweils begrenzt durch die Tageslimits der Decks (siehe "Tageslimits" unten)
//   - Gegenrichtung: hatte eine andere Karte derselben Notiz heute schon eine Antwort, bleibt diese
//     Karte (neu oder Wiederholung) bis morgen liegen; je Notiz hoechstens eine neue/Wiederholungskarte
//
// Tageslimits (neu pro Tag, Wiederholungen pro Tag) gelten je Deck:
//   - Ein Deck begrenzt sich selbst und alle seine Unterdecks zusammen ("Vokabeln" 20 = alle Lektionen zusammen).
//   - Ausnahme oberstes Deck (Bereich, z. B. "Spanisch"): begrenzt nur Karten, die direkt in ihm liegen.
//     Ein Bereich hat so kein Gesamtlimit - die Summe ergibt sich aus seinen Decks (20 + 10 + 5 = 35).
//   - Eine Karte kommt nur, wenn ALLE Decks, die sie begrenzen, noch Platz haben.
//   - Heute schon gelernte Karten zaehlen mit, egal von wo aus gelernt wurde.
//
// StudySession (ohne Datenbank, testbar): liefert die naechste Karte und nimmt Antworten entgegen.

import type { LocalDb } from '../db/local-db-types';
import type { CardState } from './scheduler';
import { startOfNextStudyDay, startOfStudyDay } from './study-day';

export const LEARN_AHEAD_MS = 20 * 60 * 1000;

export type StudyCard = CardState & {
  id: string;
  note_id: string;
  template_ord: number;
  deck_id: string;
  config_id: string | null;
};

export type DeckConfig = {
  desired_retention: number;
  learning_steps: string;
  relearning_steps: string;
  new_per_day: number;
  reviews_per_day: number;
  answer_buttons: number;
  maximum_interval: number;
};

export type StudyLoad = {
  learning: StudyCard[];
  queue: StudyCard[];
  /** Lernoptionen des Startdecks (Zahl der Antwortknoepfe) */
  config: DeckConfig;
  /** Lernoptionen je config_id - fuer die Termine gelten die des Decks der Karte */
  configs: Record<string, DeckConfig>;
};

const CARD_COLUMNS = `c.id, c.note_id, c.template_ord, c.deck_id, c.state, c.due_at, c.last_review_at, c.stability,
  c.stability_fast, c.difficulty, c.scheduled_days, c.learning_step, c.reps, c.lapses, d.config_id`;

export const DEFAULT_CONFIG: DeckConfig = {
  desired_retention: 0.9,
  learning_steps: '["1m","10m"]',
  relearning_steps: '["10m"]',
  new_per_day: 20,
  reviews_per_day: 200,
  answer_buttons: 2,
  maximum_interval: 36500,
};

function inList(ids: string[]): string {
  return ids.map(() => '?').join(', ');
}

/** Lernoptionen fuer die Sitzung: die des Startdecks, sonst die ersten der Organisation. */
async function loadConfig(db: LocalDb, deckId: string | null): Promise<DeckConfig> {
  const row = deckId
    ? await db.getFirstAsync<DeckConfig>(
        `SELECT c.* FROM decks d JOIN deck_configs c ON c.id = d.config_id WHERE d.id = ?`,
        [deckId],
      )
    : null;
  return (
    row ??
    (await db.getFirstAsync<DeckConfig>(
      'SELECT * FROM deck_configs WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1',
      [],
    )) ??
    DEFAULT_CONFIG
  );
}

/** Mischt neue Karten gleichmaessig zwischen die Wiederholungen. */
export function interleave(reviews: StudyCard[], fresh: StudyCard[]): StudyCard[] {
  if (fresh.length === 0) return [...reviews];
  if (reviews.length === 0) return [...fresh];
  const result: StudyCard[] = [];
  const step = (reviews.length + fresh.length) / fresh.length;
  let nextFreshAt = step / 2;
  let r = 0;
  let f = 0;
  for (let i = 0; r < reviews.length || f < fresh.length; i++) {
    if (f < fresh.length && (i >= nextFreshAt || r >= reviews.length)) {
      result.push(fresh[f++]);
      nextFreshAt += step;
    } else {
      result.push(reviews[r++]);
    }
  }
  return result;
}

type DeckLimitInfo = { id: string; parent_id: string | null; config_id: string | null };

/** Decks, deren Tageslimit eine Karte dieses Decks begrenzt (siehe Kopfkommentar). */
export function limitingDecks(deckId: string, parents: Map<string, string | null>): string[] {
  if (!parents.has(deckId)) return [];
  if (parents.get(deckId) === null) return [deckId];
  const chain: string[] = [];
  let current: string | null | undefined = deckId;
  while (current && parents.get(current) !== null && parents.has(current)) {
    chain.push(current);
    current = parents.get(current);
  }
  return chain;
}

type LimitCounter = { take(deckId: string): boolean };

/** Zaehler: Platz je begrenzendem Deck = Limit minus heute schon gelernt (ueber alle Unterdecks). */
function limitCounter(
  parents: Map<string, string | null>,
  limitOf: (deckId: string) => number,
  usedByDeck: Map<string, number>,
): LimitCounter {
  const used = new Map<string, number>();
  for (const [deckId, count] of usedByDeck)
    for (const limiting of limitingDecks(deckId, parents)) used.set(limiting, (used.get(limiting) ?? 0) + count);
  const left = new Map<string, number>();
  const leftOf = (id: string) => {
    if (!left.has(id)) left.set(id, Math.max(0, limitOf(id) - (used.get(id) ?? 0)));
    return left.get(id)!;
  };
  return {
    take(deckId) {
      const chain = limitingDecks(deckId, parents);
      if (chain.length === 0 || chain.some((id) => leftOf(id) <= 0)) return false;
      for (const id of chain) left.set(id, leftOf(id) - 1);
      return true;
    },
  };
}

export async function loadStudyCards(
  db: LocalDb,
  deckIds: string[],
  startDeckId: string | null,
  now: number,
): Promise<StudyLoad> {
  const config = await loadConfig(db, startDeckId);
  const configRows = await db.getAllAsync<DeckConfig & { id: string }>(
    'SELECT * FROM deck_configs WHERE deleted_at IS NULL',
    [],
  );
  const configs: Record<string, DeckConfig> = Object.fromEntries(configRows.map((row) => [row.id, row]));
  if (deckIds.length === 0) return { learning: [], queue: [], config, configs };
  const dayStart = startOfStudyDay(now);
  const decks = inList(deckIds);
  const base = `FROM cards c JOIN decks d ON d.id = c.deck_id
    WHERE c.deleted_at IS NULL AND c.suspended = 0 AND c.deck_id IN (${decks})`;

  // Deckbaum und Lernoptionen fuer die Tageslimits
  const deckRows = await db.getAllAsync<DeckLimitInfo>(
    'SELECT id, parent_id, config_id FROM decks WHERE deleted_at IS NULL',
    [],
  );
  const parents = new Map(deckRows.map((d) => [d.id, d.parent_id]));
  const deckConfig = new Map(deckRows.map((d) => [d.id, (d.config_id && configs[d.config_id]) || DEFAULT_CONFIG]));

  // Notizen, von denen heute schon eine Karte beantwortet wurde (fuer die Gegenrichtung)
  const answeredToday = await db.getAllAsync<{ note_id: string; card_id: string }>(
    `SELECT DISTINCT c.note_id, r.card_id FROM review_logs r JOIN cards c ON c.id = r.card_id
     WHERE r.is_test = 0 AND r.reviewed_at >= ?`,
    [dayStart],
  );
  const answeredCardIds = new Set(answeredToday.map((a) => a.card_id));
  const answeredNoteIds = new Set(answeredToday.map((a) => a.note_id));
  const isBuriedSibling = (card: StudyCard) => answeredNoteIds.has(card.note_id) && !answeredCardIds.has(card.id);

  const learning = await db.getAllAsync<StudyCard>(
    `SELECT ${CARD_COLUMNS} ${base} AND c.state IN (1, 3) AND c.due_at <= ? ORDER BY c.due_at`,
    [...deckIds, now + LEARN_AHEAD_MS],
  );

  // Heute schon gelernt, je Deck (in ALLEN Decks - Limits gelten unabhaengig vom Startdeck)
  const usedRows = await db.getAllAsync<{ deck_id: string; reviews: number; fresh: number }>(
    `SELECT c.deck_id, coalesce(sum(r.state = 2), 0) AS reviews,
            count(DISTINCT CASE WHEN r.state = 0 THEN r.card_id END) AS fresh
     FROM review_logs r JOIN cards c ON c.id = r.card_id
     WHERE r.is_test = 0 AND r.reviewed_at >= ?
     GROUP BY c.deck_id`,
    [dayStart],
  );
  const reviewLimit = limitCounter(
    parents,
    (id) => deckConfig.get(id)?.reviews_per_day ?? DEFAULT_CONFIG.reviews_per_day,
    new Map(usedRows.map((r) => [r.deck_id, r.reviews])),
  );
  const newLimit = limitCounter(
    parents,
    (id) => deckConfig.get(id)?.new_per_day ?? DEFAULT_CONFIG.new_per_day,
    new Map(usedRows.map((r) => [r.deck_id, r.fresh])),
  );

  const usedNotes = new Set(learning.map((c) => c.note_id));
  const pick = (cards: StudyCard[], limit: LimitCounter) => {
    const picked: StudyCard[] = [];
    for (const card of cards) {
      if (isBuriedSibling(card) || usedNotes.has(card.note_id)) continue;
      if (!limit.take(card.deck_id)) continue;
      usedNotes.add(card.note_id);
      picked.push(card);
    }
    return picked;
  };

  const reviewCandidates = await db.getAllAsync<StudyCard>(
    `SELECT ${CARD_COLUMNS} ${base} AND c.state = 2 AND c.due_at < ? ORDER BY c.due_at`,
    [...deckIds, startOfNextStudyDay(now)],
  );
  const reviews = pick(reviewCandidates, reviewLimit);

  const newCandidates = await db.getAllAsync<StudyCard>(
    `SELECT ${CARD_COLUMNS} ${base} AND c.state = 0 ORDER BY c.created_at, c.template_ord`,
    deckIds,
  );
  const fresh = pick(newCandidates, newLimit);

  return { learning, queue: interleave(reviews, fresh), config, configs };
}

/** Ablauf einer Sitzung im Speicher. */
export class StudySession {
  private learning: StudyCard[];
  private queue: StudyCard[];

  constructor(load: Pick<StudyLoad, 'learning' | 'queue'>) {
    this.learning = [...load.learning].sort((a, b) => a.due_at - b.due_at);
    this.queue = [...load.queue];
  }

  /** Karten, die in dieser Sitzung noch sicher drankommen (fuer die Fortschrittsleiste). */
  get remaining(): number {
    return this.learning.length + this.queue.length;
  }

  /**
   * Naechste Karte: faellige Lernkarte vor allem anderen; dann Wiederholungen/neue; ist nichts mehr da,
   * eine Lernkarte bis zu 20 Minuten frueher. null = fertig.
   */
  next(now: number): StudyCard | null {
    const firstLearning = this.learning[0];
    if (firstLearning && firstLearning.due_at <= now) return this.take(firstLearning);
    const queued = this.queue.shift();
    if (queued) return queued;
    if (firstLearning && firstLearning.due_at <= now + LEARN_AHEAD_MS) return this.take(firstLearning);
    return null;
  }

  /** Nach der Antwort: Lernkarte mit Termin noch in dieser Sitzung wieder einreihen. */
  answered(card: StudyCard, now: number): void {
    if ((card.state === 1 || card.state === 3) && card.due_at <= now + LEARN_AHEAD_MS) {
      this.learning.push(card);
      this.learning.sort((a, b) => a.due_at - b.due_at);
    }
  }

  /** Rueckgaengig: die Karte kommt als naechste wieder dran (eingereihte Wiederholung vorher entfernen). */
  undo(card: StudyCard): void {
    this.learning = this.learning.filter((c) => c.id !== card.id);
    this.queue.unshift(card);
  }

  private take(card: StudyCard): StudyCard {
    this.learning = this.learning.filter((c) => c !== card);
    return card;
  }
}
