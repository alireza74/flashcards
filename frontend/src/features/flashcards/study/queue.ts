// Welche Karten kommen in eine Lernsitzung, und in welcher Reihenfolge?
//
// loadStudyCards (Datenbank):
//   - Lernkarten (Lernen / Neu lernen) mit Termin bis "jetzt + 20 min"
//   - Wiederholungen mit Termin bis Ende des Lerntags (4 Uhr), hoechstens Tageslimit minus heute gelernte
//   - neue Karten bis zum Tageslimit, in der Reihenfolge des Anlegens
//   - Gegenrichtung: hatte eine andere Karte derselben Notiz heute schon eine Antwort, bleibt diese
//     Karte (neu oder Wiederholung) bis morgen liegen; je Notiz hoechstens eine neue/Wiederholungskarte
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

export type StudyLoad = { learning: StudyCard[]; queue: StudyCard[]; config: DeckConfig };

const CARD_COLUMNS = `c.id, c.note_id, c.template_ord, c.deck_id, c.state, c.due_at, c.last_review_at, c.stability,
  c.stability_fast, c.difficulty, c.scheduled_days, c.learning_step, c.reps, c.lapses, d.config_id`;

const DEFAULT_CONFIG: DeckConfig = {
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

export async function loadStudyCards(
  db: LocalDb,
  deckIds: string[],
  startDeckId: string | null,
  now: number,
): Promise<StudyLoad> {
  const config = await loadConfig(db, startDeckId);
  if (deckIds.length === 0) return { learning: [], queue: [], config };
  const dayStart = startOfStudyDay(now);
  const decks = inList(deckIds);
  const base = `FROM cards c JOIN decks d ON d.id = c.deck_id
    WHERE c.deleted_at IS NULL AND c.suspended = 0 AND c.deck_id IN (${decks})`;

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

  const reviewedToday = await db.getFirstAsync<{ reviews: number; fresh: number }>(
    `SELECT coalesce(sum(r.state = 2), 0) AS reviews, count(DISTINCT CASE WHEN r.state = 0 THEN r.card_id END) AS fresh
     FROM review_logs r JOIN cards c ON c.id = r.card_id
     WHERE r.is_test = 0 AND r.reviewed_at >= ? AND c.deck_id IN (${decks})`,
    [dayStart, ...deckIds],
  );

  const usedNotes = new Set(learning.map((c) => c.note_id));
  const pick = (cards: StudyCard[], limit: number) => {
    const picked: StudyCard[] = [];
    for (const card of cards) {
      if (picked.length >= limit) break;
      if (isBuriedSibling(card) || usedNotes.has(card.note_id)) continue;
      usedNotes.add(card.note_id);
      picked.push(card);
    }
    return picked;
  };

  const reviewCandidates = await db.getAllAsync<StudyCard>(
    `SELECT ${CARD_COLUMNS} ${base} AND c.state = 2 AND c.due_at < ? ORDER BY c.due_at`,
    [...deckIds, startOfNextStudyDay(now)],
  );
  const reviews = pick(reviewCandidates, Math.max(0, config.reviews_per_day - (reviewedToday?.reviews ?? 0)));

  const newCandidates = await db.getAllAsync<StudyCard>(
    `SELECT ${CARD_COLUMNS} ${base} AND c.state = 0 ORDER BY c.created_at, c.template_ord`,
    deckIds,
  );
  const fresh = pick(newCandidates, Math.max(0, config.new_per_day - (reviewedToday?.fresh ?? 0)));

  return { learning, queue: interleave(reviews, fresh), config };
}

/** Ablauf einer Sitzung im Speicher. */
export class StudySession {
  private learning: StudyCard[];
  private queue: StudyCard[];

  constructor(load: { learning: StudyCard[]; queue: StudyCard[] }) {
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
