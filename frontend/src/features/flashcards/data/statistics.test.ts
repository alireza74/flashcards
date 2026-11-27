/**
 * @jest-environment node
 */
// Statistik: Serie, Niveaus, Vorschau, Trefferquote, Test, 7-Tage-Leiste.

import { SYSTEM_NOTE_TYPE_IDS } from '../db/system-note-types';
import { startOfNextStudyDay, startOfStudyDay } from '../study/study-day';
import { createMigratedTestDb, type TestDb } from '../test-helpers/node-local-db';
import { createArea } from './areas';
import type { DataContext } from './context';
import { listChildDecks } from './decks';
import { createNote, type Level } from './notes';
import { computeStreak, getStatistics, markDayDone, previousStudyDay } from './statistics';

const NOW = new Date(2026, 10, 27, 12, 0, 0).getTime();
const DAY = 86_400_000;
const TODAY = startOfStudyDay(NOW);
const daysAgo = (n: number) => {
  let day = TODAY;
  for (let i = 0; i < n; i++) day = previousStudyDay(day);
  return day;
};

async function setup() {
  let counter = 0;
  const ctx: DataContext & { db: TestDb } = {
    db: await createMigratedTestDb(),
    organizationId: 'org-1',
    newId: () => `id-${String(++counter).padStart(5, '0')}`,
    now: () => NOW,
  };
  const rootId = await createArea(ctx, {
    kind: 'language',
    name: 'Deutsch',
    lang: 'de',
    subdeckNames: { vocabulary: 'Vokabeln' },
    defaultConfigName: 'Standard',
  });
  const vocabularyId = (await listChildDecks(ctx.db, rootId)).find((d) => d.kind === 'vocabulary')!.id;
  return { ctx, rootId, vocabularyId };
}

async function note(ctx: DataContext, deckId: string, word: string, level: Level | null) {
  return createNote(ctx, {
    deckId,
    noteTypeId: SYSTEM_NOTE_TYPE_IDS.basic,
    fields: { front: word, back: '-' },
    level,
    lang: 'de',
  });
}

async function cardOf(ctx: DataContext, noteId: string) {
  return (await ctx.db.getFirstAsync<{ id: string }>('SELECT id FROM cards WHERE note_id = ?', [noteId]))!.id;
}

async function log(
  ctx: DataContext,
  cardId: string,
  at: number,
  rating: number,
  state: number,
  isTest = 0,
  ms = 60_000,
) {
  await ctx.db.runAsync(
    `INSERT INTO review_logs (id, organization_id, card_id, rating, state, due_at, stability, difficulty, scheduled_days,
       reviewed_at, duration_ms, is_test, created_at) VALUES (?, 'org-1', ?, ?, ?, 0, 1, 5, 0, ?, ?, ?, ?)`,
    [ctx.newId(), cardId, rating, state, at, ms, isTest, at],
  );
}

describe('Serie', () => {
  it('zaehlt Tage in Folge; gilt weiter, wenn heute noch nichts gelernt ist; Rekord', () => {
    const days = new Set([daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(6), daysAgo(7), daysAgo(8), daysAgo(9)]);
    expect(computeStreak(days, NOW)).toEqual({ current: 3, best: 4 });
    days.add(TODAY);
    expect(computeStreak(days, NOW).current).toBe(4);
    expect(computeStreak(new Set([daysAgo(2)]), NOW).current).toBe(0); // gestern nicht -> gerissen
  });
});

describe('Statistik', () => {
  it('Niveaus, Vorschau, Trefferquote, Test, Lernzeit, 7-Tage-Leiste', async () => {
    const { ctx, rootId, vocabularyId } = await setup();
    const b2a = await cardOf(ctx, await note(ctx, vocabularyId, 'a', 'B2'));
    const b2b = await cardOf(ctx, await note(ctx, vocabularyId, 'b', 'B2'));
    await note(ctx, vocabularyId, 'c', 'C1');
    await note(ctx, vocabularyId, 'd', null);
    // a: gefestigt, ueberfaellig; b: jung, faellig uebermorgen
    await ctx.db.runAsync('UPDATE cards SET state = 2, scheduled_days = 30, due_at = ? WHERE id = ?', [
      NOW - 3 * DAY,
      b2a,
    ]);
    await ctx.db.runAsync('UPDATE cards SET state = 2, scheduled_days = 5, due_at = ? WHERE id = ?', [
      startOfNextStudyDay(startOfNextStudyDay(NOW)) + 3600_000,
      b2b,
    ]);
    // Lernhistorie: heute 2 Wiederholungen (1x gewusst), gestern 1; Test 3 Antworten (2 richtig)
    await log(ctx, b2a, NOW - 1000, 3, 2);
    await log(ctx, b2b, NOW - 2000, 1, 2);
    await log(ctx, b2a, daysAgo(1) + 3600_000, 3, 2);
    await log(ctx, b2a, NOW - 500, 3, 2, 1);
    await log(ctx, b2b, NOW - 400, 3, 2, 1);
    await log(ctx, b2b, NOW - 300, 1, 2, 1);
    await markDayDone(ctx.db, daysAgo(1) + 3600_000, rootId);

    const stats = await getStatistics(ctx.db, rootId, NOW, false);
    expect(stats.box).toMatchObject({ total: 4, new: 2, young: 1, mature: 1 });
    expect(stats.levels.map((l) => [l.level, l.total, l.mature])).toEqual([
      ['B2', 2, 1],
      ['C1', 1, 0],
      [null, 1, 0],
    ]);
    expect(stats.forecast[0].value).toBe(1); // ueberfaellig -> heute
    expect(stats.forecast[2].value).toBe(1); // uebermorgen
    expect(stats.forecast).toHaveLength(14);
    expect(stats.retention).toMatchObject({ reviews: 3, target: 0.9 });
    expect(stats.retention.ratio).toBeCloseTo(2 / 3);
    expect(stats.test.answers).toBe(3);
    expect(stats.test.ratio).toBeCloseTo(2 / 3);
    expect(stats.weekMinutes).toBe(3); // Testantworten zaehlen nicht
    expect(stats.streak).toEqual({ current: 2, best: 2 });
    expect(stats.activity.at(-1)).toMatchObject({ dayStart: TODAY, value: 2 });
    expect(stats.week.at(-1)).toMatchObject({ dayStart: TODAY, status: 'partial' });
    expect(stats.week.at(-2)).toMatchObject({ status: 'full' });
    expect(stats.week[0].status).toBe('none');

    // "Alle" hat eigene Marken; heute geschafft -> voll
    const all = await getStatistics(ctx.db, null, NOW, true);
    expect(all.week.at(-1)!.status).toBe('full');
    expect(all.week.at(-2)!.status).toBe('partial');
  });
});
