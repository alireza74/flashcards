/**
 * @jest-environment node
 */
// Datenlogik der ersten Oberflaeche mit node:sqlite.

import { SYSTEM_NOTE_TYPE_IDS } from '../db/system-note-types';
import { createMigratedTestDb, type TestDb } from '../test-helpers/node-local-db';
import { createArea } from './areas';
import type { DataContext } from './context';
import { createDeck, deleteDeckTree, getDeckPath, listChildDecks } from './decks';
import { createNote, findDuplicates, listNotes, normalizeDedupeKey, updateNote } from './notes';
import { getDeckCounts, getTodayCounts } from './stats';

const NOW = Date.UTC(2026, 10, 27, 12);

async function context(): Promise<DataContext & { db: TestDb }> {
  let counter = 0;
  return {
    db: await createMigratedTestDb(),
    organizationId: 'org-1',
    newId: () => `id-${++counter}`,
    now: () => NOW,
  };
}

async function englishArea(ctx: DataContext) {
  const rootId = await createArea(ctx, {
    kind: 'language',
    name: 'Englisch',
    lang: 'en',
    subdeckNames: {
      vocabulary: 'Vokabeln',
      phrases: 'Redewendungen',
      grammar: 'Grammatik',
    },
    defaultConfigName: 'Standard',
  });
  const children = await listChildDecks(ctx.db, rootId);
  return {
    rootId,
    vocabularyId: children.find((d) => d.kind === 'vocabulary')!.id,
  };
}

describe('Einrichtung', () => {
  it('Sprache legt Bereich mit drei Unterdecks und Standard-Lernoptionen an', async () => {
    const ctx = await context();
    const { rootId } = await englishArea(ctx);
    const children = await listChildDecks(ctx.db, rootId);
    expect(children.map((d) => [d.name, d.kind, d.lang])).toEqual([
      ['Vokabeln', 'vocabulary', 'en'],
      ['Redewendungen', 'phrases', 'en'],
      ['Grammatik', 'grammar', 'en'],
    ]);
    const configs = await ctx.db.getAllAsync<{ new_per_day: number }>('SELECT new_per_day FROM deck_configs', []);
    expect(configs).toEqual([{ new_per_day: 20 }]);
    // zweiter Bereich nutzt dieselben Lernoptionen
    await createArea(ctx, {
      kind: 'subject',
      name: 'Mathe',
      lang: null,
      defaultConfigName: 'Standard',
    });
    expect((await ctx.db.getAllAsync('SELECT id FROM deck_configs', [])).length).toBe(1);
    expect((await listChildDecks(ctx.db, null)).map((d) => d.name)).toEqual(['Englisch', 'Mathe']);
  });

  it('jede Aenderung landet in der Warteschlange', async () => {
    const ctx = await context();
    await englishArea(ctx);
    const outbox = await ctx.db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM sync_outbox', []);
    expect(outbox?.n).toBe(5); // 1 Lernoptionen + 4 Decks
  });
});

describe('Notizen', () => {
  it('Vokabel erzeugt zwei Karten, Einfach eine', async () => {
    const ctx = await context();
    const { vocabularyId } = await englishArea(ctx);
    const vocab = await createNote(ctx, {
      deckId: vocabularyId,
      noteTypeId: SYSTEM_NOTE_TYPE_IDS.vocabulary,
      fields: { word: 'the house', meaning: 'das Haus', example: '' },
      level: 'B1',
      lang: 'en',
    });
    const basic = await createNote(ctx, {
      deckId: vocabularyId,
      noteTypeId: SYSTEM_NOTE_TYPE_IDS.basic,
      fields: { front: 'Frage', back: 'Antwort' },
      level: null,
      lang: 'en',
    });
    const count = async (noteId: string) =>
      (await ctx.db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM cards WHERE note_id = ?', [noteId]))?.n;
    expect(await count(vocab)).toBe(2);
    expect(await count(basic)).toBe(1);

    const note = await ctx.db.getFirstAsync<{ dedupe_key: string }>('SELECT dedupe_key FROM notes WHERE id = ?', [
      vocab,
    ]);
    expect(note?.dedupe_key).toBe('house');
  });

  it('findet Duplikate ueber alle Decks derselben Sprache', async () => {
    const ctx = await context();
    const { rootId, vocabularyId } = await englishArea(ctx);
    const phrasesId = (await listChildDecks(ctx.db, rootId)).find((d) => d.kind === 'phrases')!.id;
    await createNote(ctx, {
      deckId: phrasesId,
      noteTypeId: SYSTEM_NOTE_TYPE_IDS.vocabulary,
      fields: { word: 'House', meaning: 'Haus', example: '' },
      level: null,
      lang: 'en',
    });
    const duplicates = await findDuplicates(ctx.db, 'en', normalizeDedupeKey('the <b>house</b>', 'en'));
    expect(duplicates.map((d) => d.deckPath)).toEqual([['Englisch', 'Redewendungen']]);
    expect(await findDuplicates(ctx.db, 'de', 'house')).toEqual([]);
    expect(vocabularyId).toBeTruthy();
  });

  it('Bearbeiten aendert Inhalt, aber nicht den Lernstand', async () => {
    const ctx = await context();
    const { vocabularyId } = await englishArea(ctx);
    const noteId = await createNote(ctx, {
      deckId: vocabularyId,
      noteTypeId: SYSTEM_NOTE_TYPE_IDS.vocabulary,
      fields: { word: 'house', meaning: 'Haus', example: '' },
      level: 'A1',
      lang: 'en',
    });
    await ctx.db.runAsync('UPDATE cards SET state = 2, scheduled_days = 30 WHERE note_id = ?', [noteId]);
    await updateNote(ctx, noteId, {
      fields: { word: 'home', meaning: 'Zuhause', example: '' },
      level: 'A2',
    });
    const items = await listNotes(ctx.db, vocabularyId, '');
    expect(items).toEqual([{ id: noteId, title: 'home', subtitle: 'Zuhause', level: 'A2' }]);
    const card = await ctx.db.getFirstAsync<{ state: number }>('SELECT state FROM cards WHERE note_id = ? LIMIT 1', [
      noteId,
    ]);
    expect(card?.state).toBe(2);
    expect(await listNotes(ctx.db, vocabularyId, 'zuhau')).toHaveLength(1);
    expect(await listNotes(ctx.db, vocabularyId, 'xyz')).toHaveLength(0);
  });
});

describe('Duplikat-Schluessel', () => {
  it.each([
    ['The House', 'en', 'house'],
    ['to  go', 'en', 'go'],
    ['das Haus', 'de', 'haus'],
    ["l'eau", 'fr', 'eau'],
    ['<i>Haus</i>&nbsp;', null, 'haus'],
  ])('%s (%s) -> %s', (input, lang, expected) => {
    expect(normalizeDedupeKey(input, lang)).toBe(expected);
  });
});

describe('Zaehlungen und Loeschen', () => {
  it('Kartei-Box zaehlt Neu, Lernen, Jung, Gefestigt ueber Unterdecks', async () => {
    const ctx = await context();
    const { rootId, vocabularyId } = await englishArea(ctx);
    for (const word of ['a1', 'a2', 'a3', 'a4']) {
      await createNote(ctx, {
        deckId: vocabularyId,
        noteTypeId: SYSTEM_NOTE_TYPE_IDS.basic,
        fields: { front: word, back: '-' },
        level: null,
        lang: 'en',
      });
    }
    const cards = await ctx.db.getAllAsync<{ id: string }>('SELECT id FROM cards ORDER BY id', []);
    await ctx.db.runAsync('UPDATE cards SET state = 1, due_at = ? WHERE id = ?', [NOW - 1, cards[0].id]);
    await ctx.db.runAsync('UPDATE cards SET state = 2, scheduled_days = 5, due_at = ? WHERE id = ?', [
      NOW + 1e6,
      cards[1].id,
    ]);
    await ctx.db.runAsync('UPDATE cards SET state = 2, scheduled_days = 40, due_at = ? WHERE id = ?', [
      NOW - 1,
      cards[2].id,
    ]);

    const counts = await getDeckCounts(ctx.db, rootId, NOW);
    expect(counts).toMatchObject({
      new: 1,
      learning: 1,
      young: 1,
      mature: 1,
      total: 4,
      due: 2,
      newToday: 1,
    });
    expect((await getTodayCounts(ctx.db, NOW)).total).toBe(4);
  });

  it('Loeschen markiert Deck, Unterdecks, Notizen und Karten', async () => {
    const ctx = await context();
    const { rootId, vocabularyId } = await englishArea(ctx);
    const sub = await createDeck(
      ctx,
      {
        name: 'Unit 1',
        parentId: vocabularyId,
        kind: 'vocabulary',
        lang: 'en',
      },
      null,
    );
    await createNote(ctx, {
      deckId: sub,
      noteTypeId: SYSTEM_NOTE_TYPE_IDS.basic,
      fields: { front: 'x', back: 'y' },
      level: null,
      lang: 'en',
    });
    expect(await getDeckPath(ctx.db, sub)).toEqual(['Englisch', 'Vokabeln', 'Unit 1']);
    await deleteDeckTree(ctx, rootId);
    const alive = await ctx.db.getFirstAsync<{ n: number }>(
      `SELECT (SELECT count(*) FROM decks WHERE deleted_at IS NULL)
            + (SELECT count(*) FROM notes WHERE deleted_at IS NULL)
            + (SELECT count(*) FROM cards WHERE deleted_at IS NULL) AS n`,
      [],
    );
    expect(alive?.n).toBe(0);
    expect(await listChildDecks(ctx.db, null)).toEqual([]);
  });
});
