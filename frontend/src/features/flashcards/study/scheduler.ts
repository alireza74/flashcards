// Anbindung an ts-fsrs (FSRS-7). Hier - und nur hier - wird die Bibliothek benutzt
// (Grundsatz: Lernalgorithmus hinter einer Schnittstelle, austauschbar).
//
// allowModelOverride: false  -> die Lernschritte (1 min, 10 min) werden eingehalten. Ohne diese Einstellung
//                               setzt FSRS-7 eine neue Karte nach "Gut" sofort auf mehrere Tage (Probelauf 27.11.).

import { DefaultScheduler } from 'ts-fsrs';

import type { LocalRow } from '../sync/table-specs';

export type Rating = 1 | 2 | 3 | 4; // Nochmal, Schwer, Gut, Einfach

export type SchedulerConfig = {
  desiredRetention: number;
  learningSteps: string[];
  relearningSteps: string[];
  maximumInterval: number;
  /** Zufall bei laengeren Abstaenden (verteilt die Arbeit); in Tests aus. */
  enableFuzz: boolean;
};

type Scheduler = Awaited<ReturnType<typeof DefaultScheduler>>;
// Die Typen von ts-fsrs unterscheiden je Modellversion; hier genuegt die Sicht als Datensatz.
type FsrsCard = Record<string, unknown>;
type FsrsRevlog = Record<string, unknown>;

const cache = new Map<string, Promise<Scheduler>>();

export function getScheduler(config: SchedulerConfig): Promise<Scheduler> {
  const key = JSON.stringify(config);
  let scheduler = cache.get(key);
  if (!scheduler) {
    scheduler = DefaultScheduler({
      version: 'FSRS-7',
      desiredRetention: config.desiredRetention,
      enableShortTerm: true,
      learningSteps: config.learningSteps as never,
      relearningSteps: config.relearningSteps as never,
      maximumInterval: config.maximumInterval,
      enableFuzz: config.enableFuzz,
      allowModelOverride: false,
    });
    cache.set(key, scheduler);
  }
  return scheduler;
}

/** FSRS-Zustand einer Karte aus unserer Tabelle (cards). */
export type CardState = {
  state: number;
  due_at: number;
  last_review_at: number | null;
  stability: number;
  stability_fast: number;
  difficulty: number;
  scheduled_days: number;
  learning_step: number;
  reps: number;
  lapses: number;
};

function scheduleStatusOf(state: number): 'new' | 'learning' | 'review' {
  if (state === 0) return 'new';
  if (state === 2) return 'review';
  return 'learning'; // 1 lernen, 3 neu lernen
}

export function toFsrsCard(id: string, row: CardState): FsrsCard {
  return {
    cardId: id,
    state: row.state,
    scheduleStatus: scheduleStatusOf(row.state),
    dueAt: new Date(row.due_at),
    lastReviewAt: row.last_review_at === null ? null : new Date(row.last_review_at),
    stability: row.stability,
    stabilityFast: row.stability_fast,
    difficulty: row.difficulty,
    scheduledDays: row.scheduled_days,
    learningStep: row.learning_step,
    reps: row.reps,
    lapses: row.lapses,
  };
}

function time(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
}

export function fromFsrsCard(card: FsrsCard): CardState {
  const c = card;
  return {
    state: Number(c.state),
    due_at: time(c.dueAt)!,
    last_review_at: time(c.lastReviewAt),
    stability: Number(c.stability),
    stability_fast: Number(c.stabilityFast ?? 0),
    difficulty: Number(c.difficulty),
    scheduled_days: Number(c.scheduledDays),
    learning_step: Number(c.learningStep ?? 0),
    reps: Number(c.reps),
    lapses: Number(c.lapses),
  };
}

/** Eintrag fuer review_logs aus dem ts-fsrs-Protokoll (enthaelt den Zustand VOR der Antwort). */
export function reviewLogColumns(revlog: FsrsRevlog): LocalRow {
  const r = revlog;
  return {
    rating: Number(r.rating),
    state: Number(r.state),
    due_at: time(r.dueAt),
    last_review_at: time(r.lastReviewAt),
    stability: Number(r.stability),
    stability_fast: Number(r.stabilityFast ?? 0),
    difficulty: Number(r.difficulty),
    scheduled_days: Number(r.scheduledDays),
    learning_step: Number(r.learningStep ?? 0),
    reviewed_at: time(r.reviewTime),
  };
}

export type ScheduleResult = { card: CardState; log: LocalRow };

export async function schedule(
  config: SchedulerConfig,
  id: string,
  row: CardState,
  rating: Rating,
  now: number,
): Promise<ScheduleResult> {
  const scheduler = await getScheduler(config);
  const result = scheduler.review({ card: toFsrsCard(id, row) as never, grade: rating, now: new Date(now) });
  return { card: fromFsrsCard(result.card as FsrsCard), log: reviewLogColumns(result.revlog as FsrsRevlog) };
}

/** Naechster Termin je Knopf (fuer die Beschriftung "10 min", "3 T"). */
export async function previewDue(
  config: SchedulerConfig,
  id: string,
  row: CardState,
  now: number,
): Promise<Record<Rating, number>> {
  const scheduler = await getScheduler(config);
  const result = {} as Record<Rating, number>;
  for (const item of scheduler.preview({ card: toFsrsCard(id, row) as never, now: new Date(now) })) {
    result[item.grade as Rating] = fromFsrsCard(item.card as FsrsCard).due_at;
  }
  return result;
}
