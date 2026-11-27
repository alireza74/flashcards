/**
 * @jest-environment node
 */
// Testmodus: Auswahl, Antwort ohne Terminaenderung, Rueckgaengig, "Nicht gewusste neu lernen".

import { createArea } from '../data/areas';
import type { DataContext } from '../data/context';
import { getTodayCounts, getTodayProgress } from '../data/stats';
import { listChildDecks } from '../data/decks';
import { createNote, type Level } from '../data/notes';
import { SYSTEM_NOTE_TYPE_IDS } from '../db/system-note-types';
import { createMigratedTestDb, type TestDb } from '../test-helpers/node-local-db';
import { pickTestCards, recordTestAnswer, relearnCards, shuffle, undoTestAnswer } from './test-mode';

const NOW = new Date(2026, 10, 27, 12, 0, 0).getTime();

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

async function words(ctx: DataContext, deckId: string, count: number, level: Level | null = null) {
  for (let i = 0; i < count; i++)
    await createNote(ctx, {
      deckId,
      noteTypeId: SYSTEM_NOTE_TYPE_IDS.vocabulary,
      fields: { word: `${level ?? 'x'}${i}`, meaning: `m${i}`, example: '' },
      level,
      lang: 'de',
    });
}

const cardRow = (ctx: DataContext, id: string) => ctx.db.getFirstAsync('SELECT * FROM cards WHERE id = ?', [id]);

describe('Testmodus - Auswahl', () => {
  it('je Notiz eine Karte, Anzahl, Niveau, Richtung, nur gelernte', async () => {
    const { ctx, rootId, vocabularyId } = await setup();
    await words(ctx, vocabularyId, 6, 'B2');
    await words(ctx, vocabularyId, 4, 'C1');
    const base = { deckId: rootId, count: null, scope: 'all' as const, level: null, direction: 'cards' as const };

    const all = await pickTestCards(ctx.db, base);
    expect(all).toHaveLength(10); // 10 Notizen x 2 Karten -> je Notiz eine
    expect(new Set(all.map((c) => c.note_id)).size).toBe(10);
    expect(await pickTestCards(ctx.db, { ...base, count: 3 })).toHaveLength(3);
    expect(await pickTestCards(ctx.db, { ...base, level: 'C1' })).toHaveLength(4);
    expect((await pickTestCards(ctx.db, { ...base, direction: 'reverse' })).every((c) => c.template_ord === 1)).toBe(
      true,
    );
    expect(await pickTestCards(ctx.db, { ...base, scope: 'learned' })).toHaveLength(0); // alles neu
    await ctx.db.runAsync('UPDATE cards SET state = 2, scheduled_days = 30 WHERE id = ?', [all[0].id]);
    expect((await pickTestCards(ctx.db, { ...base, scope: 'mature' })).map((c) => c.id)).toEqual([all[0].id]);
  });

  it('mischt reproduzierbar mit eigenem Zufall', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    expect(shuffle([1, 2, 3, 4, 5], random).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('Testmodus - Antworten', () => {
  it('speichert is_test = 1, Karte und Lernfortschritt bleiben unveraendert; rueckgaengig geht', async () => {
    const { ctx, vocabularyId } = await setup();
    await words(ctx, vocabularyId, 2);
    const [card] = await pickTestCards(ctx.db, {
      deckId: vocabularyId,
      count: 1,
      scope: 'all',
      level: null,
      direction: 'cards',
    });
    const before = await cardRow(ctx, card.id);
    const answer = await recordTestAnswer(ctx, card.id, false, 1500);

    expect(await cardRow(ctx, card.id)).toEqual(before);
    const log = await ctx.db.getFirstAsync<{ is_test: number; rating: number; state: number }>(
      'SELECT is_test, rating, state FROM review_logs WHERE id = ?',
      [answer.logId],
    );
    expect(log).toEqual({ is_test: 1, rating: 1, state: 0 });
    // zaehlt nicht als gelernt
    expect(await getTodayProgress(ctx.db, NOW, await getTodayCounts(ctx.db, NOW))).toMatchObject({ done: 0 });

    expect(await undoTestAnswer(ctx.db, answer)).toBe(true);
    expect(await ctx.db.getFirstAsync('SELECT id FROM review_logs WHERE id = ?', [answer.logId])).toBeNull();
    // schon gesendet -> nicht mehr rueckgaengig
    const sent = await recordTestAnswer(ctx, card.id, true, 1000);
    await ctx.db.runAsync('DELETE FROM sync_outbox', []);
    expect(await undoTestAnswer(ctx.db, sent)).toBe(false);
  });

  it('"Nicht gewusste neu lernen" ist eine echte Antwort "Nochmal"', async () => {
    const { ctx, vocabularyId } = await setup();
    await words(ctx, vocabularyId, 1);
    const [card] = await pickTestCards(ctx.db, {
      deckId: vocabularyId,
      count: 1,
      scope: 'all',
      level: null,
      direction: 'cards',
    });
    await ctx.db.runAsync(
      'UPDATE cards SET state = 2, scheduled_days = 30, stability = 30, stability_fast = 30, difficulty = 5, reps = 4, last_review_at = ?, due_at = ? WHERE id = ?',
      [NOW - 30 * 86_400_000, NOW + 5 * 86_400_000, card.id],
    );
    expect(await relearnCards(ctx, [card.id])).toBe(1);
    const after = await ctx.db.getFirstAsync<{ state: number; lapses: number; due_at: number }>(
      'SELECT state, lapses, due_at FROM cards WHERE id = ?',
      [card.id],
    );
    expect(after).toMatchObject({ state: 3, lapses: 1 });
    expect(after!.due_at).toBeLessThan(NOW + 60 * 60 * 1000);
    const log = await ctx.db.getFirstAsync<{ is_test: number; rating: number }>(
      'SELECT is_test, rating FROM review_logs WHERE card_id = ?',
      [card.id],
    );
    expect(log).toEqual({ is_test: 0, rating: 1 });
  });
});
