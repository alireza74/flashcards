/**
 * @jest-environment node
 */
// Lernpensum: Tageslimits je Deck (Vorgaben, Kartenauswahl je Unterdeck, eigene Kopie beim Aendern).

import { SYSTEM_NOTE_TYPE_IDS } from '../db/system-note-types';
import { answerCard, schedulerConfigOf } from '../study/review';
import { DEFAULT_CONFIG, limitingDecks, loadStudyCards } from '../study/queue';
import { createMigratedTestDb, type TestDb } from '../test-helpers/node-local-db';
import { createArea } from './areas';
import type { DataContext } from './context';
import { createDeck, getDeck, getDeckTreeIds, listChildDecks } from './decks';
import { createNote } from './notes';
import { getPensum, setDeckLimits } from './pensum';
import { getDeckCounts, getTodayCounts, getTodayProgress } from './stats';

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
    subdeckNames: { vocabulary: 'Vokabeln', phrases: 'Redewendungen', grammar: 'Grammatik' },
    defaultConfigName: 'Standard',
  });
  const children = await listChildDecks(ctx.db, rootId);
  const byKind = (kind: string) => children.find((d) => d.kind === kind)!;
  return { ctx, rootId, vocabulary: byKind('vocabulary'), grammar: byKind('grammar'), phrases: byKind('phrases') };
}

async function addCards(ctx: DataContext, deckId: string, count: number, prefix: string) {
  for (let i = 0; i < count; i++)
    await createNote(ctx, {
      deckId,
      noteTypeId: SYSTEM_NOTE_TYPE_IDS.basic,
      fields: { front: `${prefix}${i}`, back: '-' },
      level: null,
      lang: 'de',
    });
}

async function freshByDeck(ctx: DataContext, startDeckId: string | null) {
  const deckIds = startDeckId
    ? await getDeckTreeIds(ctx.db, startDeckId)
    : (await ctx.db.getAllAsync<{ id: string }>('SELECT id FROM decks', [])).map((d) => d.id);
  const load = await loadStudyCards(ctx.db, deckIds, startDeckId, NOW);
  const counts: Record<string, number> = {};
  for (const card of load.queue) counts[card.deck_id] = (counts[card.deck_id] ?? 0) + 1;
  return { counts, total: load.queue.length, load };
}

describe('Lernpensum', () => {
  it('Vorgaben fuer einen neuen Sprachbereich: 20 / 5 / 10, Bereich ohne eigene Zeile', async () => {
    const { ctx, rootId } = await setup();
    const rows = await getPensum(ctx.db, rootId);
    expect(rows.map((r) => [r.name, r.newPerDay, r.reviewsPerDay, r.waitingNew])).toEqual([
      ['Vokabeln', 20, 200, 0],
      ['Redewendungen', 5, 200, 0],
      ['Grammatik', 10, 200, 0],
    ]);
  });

  it('neue Karten je Unterdeck nach dessen Limit; leeres Deck liefert einfach nichts', async () => {
    const { ctx, rootId, vocabulary, grammar, phrases } = await setup();
    await addCards(ctx, vocabulary.id, 25, 'v');
    await addCards(ctx, grammar.id, 15, 'g');

    const fromArea = await freshByDeck(ctx, rootId);
    expect(fromArea.counts).toEqual({ [vocabulary.id]: 20, [grammar.id]: 10 });
    expect(fromArea.counts[phrases.id]).toBeUndefined();
    expect((await freshByDeck(ctx, null)).total).toBe(30); // Startseite: dieselbe Summe
    expect((await freshByDeck(ctx, vocabulary.id)).total).toBe(20);

    // Anzeige "neu heute" = Sitzung
    expect((await getDeckCounts(ctx.db, rootId, NOW)).newToday).toBe(30);
    expect((await getTodayCounts(ctx.db, NOW)).newToday).toBe(30);
  });

  it('ein Deck begrenzt seine Unterdecks zusammen (z. B. importierte Lektionen)', async () => {
    const { ctx, vocabulary } = await setup();
    const lesson1 = await createDeck(
      ctx,
      { name: 'L1', parentId: vocabulary.id, kind: 'vocabulary', lang: 'de' },
      vocabulary.config_id,
    );
    const lesson2 = await createDeck(
      ctx,
      { name: 'L2', parentId: vocabulary.id, kind: 'vocabulary', lang: 'de' },
      vocabulary.config_id,
    );
    await addCards(ctx, lesson1, 15, 'a');
    await addCards(ctx, lesson2, 15, 'b');
    expect((await freshByDeck(ctx, vocabulary.id)).total).toBe(20);
    expect((await freshByDeck(ctx, lesson2)).total).toBe(15);
  });

  it('heute schon gelernte Karten zaehlen mit, auch von einem anderen Startdeck aus', async () => {
    const { ctx, rootId, vocabulary, grammar } = await setup();
    await addCards(ctx, vocabulary.id, 25, 'v');
    await addCards(ctx, grammar.id, 15, 'g');
    const { load } = await freshByDeck(ctx, vocabulary.id);
    for (const card of load.queue.slice(0, 5))
      await answerCard(ctx.db, {
        card,
        rating: 3,
        now: NOW,
        durationMs: 1000,
        config: schedulerConfigOf(DEFAULT_CONFIG, false),
        newId: ctx.newId,
        organizationId: ctx.organizationId,
      });
    expect((await freshByDeck(ctx, rootId)).counts).toEqual({ [vocabulary.id]: 15, [grammar.id]: 10 });
  });

  it('Aendern: geteilte Lernoptionen bekommen eine eigene Kopie, sonst wird direkt geaendert', async () => {
    const { ctx, vocabulary } = await setup();
    const lesson = await createDeck(
      ctx,
      { name: 'L1', parentId: vocabulary.id, kind: 'vocabulary', lang: 'de' },
      vocabulary.config_id,
    );

    await setDeckLimits(ctx, vocabulary.id, { newPerDay: 40, reviewsPerDay: 300 });
    const changed = (await getDeck(ctx.db, vocabulary.id))!;
    expect(changed.config_id).not.toBe(vocabulary.config_id);
    expect((await getPensum(ctx.db, lesson))[0].newPerDay).toBe(20); // Lektion behaelt die alten
    expect((await getPensum(ctx.db, vocabulary.id))[0]).toMatchObject({ newPerDay: 40, reviewsPerDay: 300 });

    // jetzt nicht mehr geteilt -> gleiche Lernoptionen werden geaendert
    await setDeckLimits(ctx, vocabulary.id, { newPerDay: 35, reviewsPerDay: -5 });
    expect((await getDeck(ctx.db, vocabulary.id))!.config_id).toBe(changed.config_id);
    expect((await getPensum(ctx.db, vocabulary.id))[0]).toMatchObject({ newPerDay: 35, reviewsPerDay: 0 });
  });

  it('welche Decks begrenzen eine Karte', () => {
    const parents = new Map<string, string | null>([
      ['area', null],
      ['vocab', 'area'],
      ['lesson', 'vocab'],
    ]);
    expect(limitingDecks('lesson', parents)).toEqual(['lesson', 'vocab']);
    expect(limitingDecks('vocab', parents)).toEqual(['vocab']);
    expect(limitingDecks('area', parents)).toEqual(['area']);
    expect(limitingDecks('unknown', parents)).toEqual([]);
  });
});

describe('Tagesfortschritt (Ring auf der Startseite)', () => {
  it('nichts -> offen -> geschafft; Lernkarten fuer spaeter werden gemeldet', async () => {
    const { ctx, vocabulary } = await setup();
    const progress = async () => getTodayProgress(ctx.db, NOW, await getTodayCounts(ctx.db, NOW));
    expect(await progress()).toMatchObject({ done: 0, open: 0, status: 'nothing', ratio: 0 });

    await addCards(ctx, vocabulary.id, 3, 'v');
    expect(await progress()).toMatchObject({ done: 0, open: 3, status: 'open' });

    const { load } = await freshByDeck(ctx, vocabulary.id);
    const answer = (card: (typeof load.queue)[number], rating: 1 | 3 | 4) =>
      answerCard(ctx.db, {
        card,
        rating,
        now: NOW,
        durationMs: 1000,
        config: schedulerConfigOf(DEFAULT_CONFIG, false),
        newId: ctx.newId,
        organizationId: ctx.organizationId,
      });
    await answer(load.queue[0], 4); // sofort Tage
    expect(await progress()).toMatchObject({ done: 1, open: 2, status: 'open' });
    expect((await progress()).ratio).toBeCloseTo(1 / 3);

    await answer(load.queue[1], 4);
    await answer(load.queue[2], 4);
    expect(await progress()).toMatchObject({ done: 3, open: 0, status: 'done', ratio: 1, comingBack: 0 });
  });

  it('Lernkarte mit Termin nach 20 Minuten zaehlt als "kommt noch einmal"', async () => {
    const { ctx, vocabulary } = await setup();
    await addCards(ctx, vocabulary.id, 1, 'v');
    await ctx.db.runAsync('UPDATE cards SET state = 1, due_at = ?', [NOW + 60 * 60 * 1000]);
    expect(await getTodayProgress(ctx.db, NOW, await getTodayCounts(ctx.db, NOW))).toMatchObject({
      open: 0,
      comingBack: 1,
    });
  });
});

describe('Fortschritt je Bereich (kleine Ringe)', () => {
  it('zaehlt nur Karten des Bereichs', async () => {
    const { ctx, rootId, vocabulary } = await setup();
    const otherRoot = await createArea(ctx, {
      kind: 'subject',
      name: 'Mathe',
      lang: null,
      defaultConfigName: 'Standard',
    });
    await addCards(ctx, vocabulary.id, 2, 'v');
    await addCards(ctx, otherRoot, 1, 'm');
    const { load } = await freshByDeck(ctx, vocabulary.id);
    for (const card of load.queue)
      await answerCard(ctx.db, {
        card,
        rating: 4,
        now: NOW,
        durationMs: 1000,
        config: schedulerConfigOf(DEFAULT_CONFIG, false),
        newId: ctx.newId,
        organizationId: ctx.organizationId,
      });
    const area = async (id: string) =>
      getTodayProgress(ctx.db, NOW, await getDeckCounts(ctx.db, id, NOW), await getDeckTreeIds(ctx.db, id));
    expect(await area(rootId)).toMatchObject({ done: 2, open: 0, status: 'done' });
    expect(await area(otherRoot)).toMatchObject({ done: 0, open: 1, status: 'open' });
    expect(await getTodayProgress(ctx.db, NOW, await getTodayCounts(ctx.db, NOW))).toMatchObject({ done: 2, open: 1 });
  });
});

describe('Neue Karten nur begrenzt laden', () => {
  it('liefert trotz Gegenrichtung und heute beantworteter Notizen die volle Zahl', async () => {
    const { ctx, vocabulary } = await setup();
    for (let i = 0; i < 40; i++)
      await createNote(ctx, {
        deckId: vocabulary.id,
        noteTypeId: SYSTEM_NOTE_TYPE_IDS.vocabulary, // zwei Karten je Notiz
        fields: { word: `w${i}`, meaning: `m${i}`, example: '' },
        level: null,
        lang: 'de',
      });
    const first = await freshByDeck(ctx, vocabulary.id);
    expect(first.total).toBe(20);
    expect(new Set(first.load.queue.map((c) => c.note_id)).size).toBe(20); // je Notiz nur eine Karte
    for (const card of first.load.queue.slice(0, 12))
      await answerCard(ctx.db, {
        card,
        rating: 4,
        now: NOW,
        durationMs: 1000,
        config: schedulerConfigOf(DEFAULT_CONFIG, false),
        newId: ctx.newId,
        organizationId: ctx.organizationId,
      });
    const second = await freshByDeck(ctx, vocabulary.id);
    expect(second.total).toBe(8); // 20 - 12
    const answeredNotes = new Set(first.load.queue.slice(0, 12).map((c) => c.note_id));
    expect(second.load.queue.some((c) => answeredNotes.has(c.note_id))).toBe(false); // Gegenrichtung erst morgen
  });
});
