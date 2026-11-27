// Statistik: alles aus Karten und Lernhistorie berechnet (nichts zusaetzlich gespeichert, ausser der Marke
// "Tag geschafft" auf dem Geraet). Ein Tag laeuft wie ueberall von 4 bis 4 Uhr (study/study-day.ts).
// Testantworten (is_test = 1) zaehlen nur in "Test", nirgends sonst.
//
// Serie: Ein Tag zaehlt, sobald mindestens eine Karte gelernt wurde. Die Serie gilt noch, wenn heute
// noch nichts gelernt wurde, aber gestern (sie reisst erst am Ende des heutigen Tages).

import type { LocalDb } from '../db/local-db-types';
import { startOfNextStudyDay, startOfStudyDay } from '../study/study-day';
import { getDeckTreeIds } from './decks';
import { LEVELS, type Level } from './notes';
import { MATURE_DAYS, type BoxCounts } from './stats';

export const ACTIVITY_DAYS = 30;
export const FORECAST_DAYS = 14;
export const WEEK_DAYS = 7;
const STREAK_WINDOW_DAYS = 400;

export type LevelRow = BoxCounts & { level: Level | null };
export type DayValue = { dayStart: number; value: number };
export type WeekDay = { dayStart: number; status: 'full' | 'partial' | 'none' };

export type Statistics = {
  box: BoxCounts;
  levels: LevelRow[];
  streak: { current: number; best: number };
  week: WeekDay[];
  /** gelernte Karten je Tag, aeltester zuerst, letzter = heute */
  activity: DayValue[];
  /** Lernzeit der letzten 7 Tage in Minuten */
  weekMinutes: number;
  /** faellige Karten je Tag, erster = heute (inkl. ueberfaellige) */
  forecast: DayValue[];
  /** Trefferquote bei Wiederholungen (letzte 30 Tage); null = keine Wiederholungen */
  retention: { ratio: number | null; reviews: number; target: number };
  test: { ratio: number | null; answers: number };
};

const ALL_SCOPE = 'all';
const dayDonePrefix = (scope: string | null) => `day-done:${scope ?? ALL_SCOPE}:`;

/**
 * Merkt auf dem Geraet, dass das Tagespensum heute geschafft wurde (fuer die 7-Tage-Leiste) - fuer alles
 * (deckId = null) oder einen Bereich. Nur lokal: auf einem anderen Geraet fehlen diese Marken.
 */
export async function markDayDone(db: LocalDb, now: number, deckId: string | null): Promise<void> {
  await db.runAsync('INSERT OR IGNORE INTO local_meta (key, value) VALUES (?, ?)', [
    `${dayDonePrefix(deckId)}${startOfStudyDay(now)}`,
    '1',
  ]);
}

/** Beginn des Lerntags davor. */
export function previousStudyDay(dayStart: number): number {
  return startOfStudyDay(dayStart - 1);
}

/** Lerntage rueckwaerts ab heute: [heute, gestern, ...] */
function studyDaysBack(now: number, count: number): number[] {
  const days = [startOfStudyDay(now)];
  while (days.length < count) days.push(previousStudyDay(days[days.length - 1]));
  return days;
}

/** Serie aus der Menge der Lerntage mit Aktivitaet. */
export function computeStreak(activeDays: Set<number>, now: number): { current: number; best: number } {
  const today = startOfStudyDay(now);
  let day = activeDays.has(today) ? today : previousStudyDay(today);
  let current = 0;
  while (activeDays.has(day)) {
    current++;
    day = previousStudyDay(day);
  }
  const sorted = [...activeDays].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let last: number | null = null;
  for (const start of sorted) {
    run = last !== null && previousStudyDay(start) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = start;
  }
  return { current, best: Math.max(best, current) };
}

function deckFilter(deckIds: string[] | null, column = 'c.deck_id') {
  if (!deckIds) return { sql: '', params: [] as string[] };
  return { sql: `AND ${column} IN (${deckIds.map(() => '?').join(', ') || 'NULL'})`, params: deckIds };
}

/** Statistik fuer ein Deck (mit Unterdecks) oder fuer alles (deckId = null). */
export async function getStatistics(
  db: LocalDb,
  deckId: string | null,
  now: number,
  todayDone: boolean,
): Promise<Statistics> {
  const deckIds = deckId ? await getDeckTreeIds(db, deckId) : null;
  const decks = deckFilter(deckIds);
  const boxSql = `coalesce(sum(c.state = 0), 0) AS new,
       coalesce(sum(c.state IN (1, 3)), 0) AS learning,
       coalesce(sum(c.state = 2 AND c.scheduled_days < ${MATURE_DAYS}), 0) AS young,
       coalesce(sum(c.state = 2 AND c.scheduled_days >= ${MATURE_DAYS}), 0) AS mature,
       count(*) AS total`;
  const live = 'c.deleted_at IS NULL AND c.suspended = 0';

  const box = (await db.getFirstAsync<BoxCounts>(`SELECT ${boxSql} FROM cards c WHERE ${live} ${decks.sql}`, [
    ...decks.params,
  ]))!;

  const levelRows = await db.getAllAsync<LevelRow>(
    `SELECT n.level AS level, ${boxSql} FROM cards c JOIN notes n ON n.id = c.note_id
     WHERE ${live} ${decks.sql} GROUP BY n.level`,
    [...decks.params],
  );
  const levelOrder = (level: Level | null) => (level === null ? LEVELS.length : LEVELS.indexOf(level));
  const levels = levelRows.sort((a, b) => levelOrder(a.level) - levelOrder(b.level));

  // Lernhistorie (ohne Test) der letzten 400 Tage: Tage mit Aktivitaet, Karten und Zeit je Tag
  const today = startOfStudyDay(now);
  const windowStart = studyDaysBack(now, STREAK_WINDOW_DAYS).at(-1)!;
  const logs = await db.getAllAsync<{ card_id: string; reviewed_at: number; duration_ms: number | null }>(
    `SELECT r.card_id, r.reviewed_at, r.duration_ms FROM review_logs r JOIN cards c ON c.id = r.card_id
     WHERE r.is_test = 0 AND r.reviewed_at >= ? ${decks.sql}`,
    [windowStart, ...decks.params],
  );
  const cardsByDay = new Map<number, Set<string>>();
  const weekStart = studyDaysBack(now, WEEK_DAYS).at(-1)!;
  let weekMs = 0;
  for (const log of logs) {
    const day = startOfStudyDay(log.reviewed_at);
    if (!cardsByDay.has(day)) cardsByDay.set(day, new Set());
    cardsByDay.get(day)!.add(log.card_id);
    if (log.reviewed_at >= weekStart) weekMs += log.duration_ms ?? 0;
  }
  const activeDays = new Set(cardsByDay.keys());

  const prefix = dayDonePrefix(deckId);
  const doneRows = await db.getAllAsync<{ key: string }>('SELECT key FROM local_meta WHERE key LIKE ?', [`${prefix}%`]);
  const doneDays = new Set(doneRows.map((row) => Number(row.key.slice(prefix.length))));
  if (todayDone) doneDays.add(today);
  const week: WeekDay[] = studyDaysBack(now, WEEK_DAYS)
    .reverse()
    .map((dayStart) => ({
      dayStart,
      status:
        doneDays.has(dayStart) && activeDays.has(dayStart) ? 'full' : activeDays.has(dayStart) ? 'partial' : 'none',
    }));

  const activity = studyDaysBack(now, ACTIVITY_DAYS)
    .reverse()
    .map((dayStart) => ({ dayStart, value: cardsByDay.get(dayStart)?.size ?? 0 }));

  // Vorschau: Karten im Lernen oder Wiederholen nach Termin; heute schliesst Ueberfaelliges ein
  const forecastDays: number[] = [today];
  while (forecastDays.length < FORECAST_DAYS) forecastDays.push(startOfNextStudyDay(forecastDays.at(-1)!));
  const forecastEnd = startOfNextStudyDay(forecastDays.at(-1)!);
  const dueRows = await db.getAllAsync<{ due_at: number }>(
    `SELECT c.due_at FROM cards c WHERE ${live} AND c.state IN (1, 2, 3) AND c.due_at < ? ${decks.sql}`,
    [forecastEnd, ...decks.params],
  );
  const forecastCounts = new Map<number, number>();
  for (const row of dueRows) {
    const day = row.due_at < today ? today : startOfStudyDay(row.due_at);
    forecastCounts.set(day, (forecastCounts.get(day) ?? 0) + 1);
  }
  const forecast = forecastDays.map((dayStart) => ({ dayStart, value: forecastCounts.get(dayStart) ?? 0 }));

  // Trefferquote: Wiederholungen (Zustand vorher = 2) der letzten 30 Tage, "gewusst" = nicht "Nochmal"
  const monthStart = studyDaysBack(now, ACTIVITY_DAYS).at(-1)!;
  const quality = async (isTest: 0 | 1, onlyReviews: boolean) =>
    (await db.getFirstAsync<{ total: number; good: number }>(
      `SELECT count(*) AS total, coalesce(sum(r.rating > 1), 0) AS good FROM review_logs r JOIN cards c ON c.id = r.card_id
       WHERE r.is_test = ? AND r.reviewed_at >= ? ${onlyReviews ? 'AND r.state = 2' : ''} ${decks.sql}`,
      [isTest, monthStart, ...decks.params],
    ))!;
  const reviews = await quality(0, true);
  const tests = await quality(1, false);
  const target = await db.getFirstAsync<{ desired_retention: number }>(
    deckId
      ? 'SELECT k.desired_retention FROM decks d JOIN deck_configs k ON k.id = d.config_id WHERE d.id = ?'
      : 'SELECT desired_retention FROM deck_configs WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1',
    deckId ? [deckId] : [],
  );

  return {
    box,
    levels,
    streak: computeStreak(activeDays, now),
    week,
    activity,
    weekMinutes: Math.round(weekMs / 60_000),
    forecast,
    retention: {
      ratio: reviews.total ? reviews.good / reviews.total : null,
      reviews: reviews.total,
      target: target?.desired_retention ?? 0.9,
    },
    test: { ratio: tests.total ? tests.good / tests.total : null, answers: tests.total },
  };
}
