/**
 * @jest-environment node
 */
// Kartenliste: Filter, Seiten, Verschieben; Lernpensum-Zeile "direkt im Bereich" und Tagessumme.

import { SYSTEM_NOTE_TYPE_IDS } from '../db/system-note-types';
import { createMigratedTestDb, type TestDb } from '../test-helpers/node-local-db';
import { createArea } from './areas';
import { browseNotes, countNotes, moveNotes, type NoteFilter } from './card-browser';
import type { DataContext } from './context';
import { listChildDecks } from './decks';
import { createNote, type Level } from './notes';
import { getPensum, possibleNewPerDay } from './pensum';

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
  const vocabularyId = (await listChildDecks(ctx.db, rootId)).find((d) => d.kind === 'vocabulary')!.id;
  return { ctx, rootId, vocabularyId };
}

async function word(ctx: DataContext, deckId: string, front: string, back: string, level: Level | null = null) {
  return createNote(ctx, {
    deckId,
    noteTypeId: SYSTEM_NOTE_TYPE_IDS.vocabulary,
    fields: { word: front, meaning: back, example: '' },
    level,
    lang: 'de',
  });
}

const all = (deckId: string): NoteFilter => ({ deckId, search: '', level: null, box: null });

describe('Kartenliste', () => {
  it('filtert nach Suche, Niveau und Kartei-Box-Fach; Unterdecks zaehlen mit', async () => {
    const { ctx, rootId, vocabularyId } = await setup();
    await word(ctx, rootId, 'Währung', 'ارزش پول', 'C1');
    await word(ctx, vocabularyId, 'gutmütig', 'خیر خواه', 'B2');
    const learningNote = await word(ctx, vocabularyId, 'zuverlässig', 'قابل اعتماد');
    // eine Karte der Notiz ins Fach "Lernen"
    await ctx.db.runAsync('UPDATE cards SET state = 1 WHERE note_id = ? AND template_ord = 0', [learningNote]);

    expect(await countNotes(ctx.db, all(rootId))).toBe(3);
    expect(await countNotes(ctx.db, all(vocabularyId))).toBe(2);
    expect(await countNotes(ctx.db, { ...all(rootId), search: 'GUT' })).toBe(1);
    expect(await countNotes(ctx.db, { ...all(rootId), level: 'C1' })).toBe(1);
    expect(await countNotes(ctx.db, { ...all(rootId), level: 'none' })).toBe(1);
    const learning = await browseNotes(ctx.db, { ...all(rootId), box: 'learning' }, 50);
    expect(learning.map((n) => n.title)).toEqual(['zuverlässig']);
    expect(await countNotes(ctx.db, { ...all(rootId), box: 'new' })).toBe(3); // Gegenrichtung ist noch neu
    expect(await countNotes(ctx.db, { ...all(rootId), box: 'mature' })).toBe(0);
  });

  it('laedt seitenweise', async () => {
    const { ctx, rootId } = await setup();
    for (let i = 0; i < 7; i++) await word(ctx, rootId, `w${i}`, `m${i}`);
    expect(await browseNotes(ctx.db, all(rootId), 5)).toHaveLength(5);
    expect(await browseNotes(ctx.db, all(rootId), 10)).toHaveLength(7);
  });

  it('verschiebt gefilterte Notizen mit ihren Karten, Lernstand bleibt', async () => {
    const { ctx, rootId, vocabularyId } = await setup();
    await word(ctx, rootId, 'eins', '1', 'B1');
    await word(ctx, rootId, 'zwei', '2', 'C1');
    const already = await word(ctx, vocabularyId, 'drei', '3', 'B1');
    await ctx.db.runAsync('UPDATE cards SET state = 2, reps = 3 WHERE note_id = ?', [already]);

    const moved = await moveNotes(ctx, { ...all(rootId), level: 'B1' }, vocabularyId);
    expect(moved).toBe(1); // "drei" liegt schon im Ziel
    const decks = await ctx.db.getAllAsync<{ word: string; note_deck: string; card_decks: string }>(
      `SELECT json_extract(n.fields, '$.word') AS word, n.deck_id AS note_deck, group_concat(DISTINCT c.deck_id) AS card_decks
       FROM notes n JOIN cards c ON c.note_id = n.id GROUP BY n.id ORDER BY word`,
      [],
    );
    expect(decks).toEqual([
      { word: 'drei', note_deck: vocabularyId, card_decks: vocabularyId },
      { word: 'eins', note_deck: vocabularyId, card_decks: vocabularyId },
      { word: 'zwei', note_deck: rootId, card_decks: rootId },
    ]);
    const kept = await ctx.db.getFirstAsync<{ reps: number }>('SELECT max(reps) AS reps FROM cards WHERE note_id = ?', [
      already,
    ]);
    expect(kept?.reps).toBe(3);
    const outbox = await ctx.db.getFirstAsync<{ n: number }>(
      "SELECT count(*) AS n FROM sync_outbox WHERE table_name IN ('notes', 'cards') AND created_at = ?",
      [NOW],
    );
    expect(outbox!.n).toBeGreaterThan(0);
  });
});

describe('Lernpensum-Anzeige', () => {
  it('Karten direkt im Bereich bekommen eine eigene, markierte Zeile', async () => {
    const { ctx, rootId } = await setup();
    await word(ctx, rootId, 'eins', '1');
    const rows = await getPensum(ctx.db, rootId);
    expect(rows.map((r) => [r.name, r.direct, r.waitingNew])).toEqual([
      ['Deutsch', true, 2],
      ['Vokabeln', false, 0],
      ['Redewendungen', false, 0],
      ['Grammatik', false, 0],
    ]);
  });

  it('Tagessumme: je Deck hoechstens so viele, wie warten', () => {
    expect(
      possibleNewPerDay([
        { newPerDay: 20, waitingNew: 6402 },
        { newPerDay: 20, waitingNew: 0 },
        { newPerDay: 10, waitingNew: 4 },
      ]),
    ).toBe(24);
  });
});
