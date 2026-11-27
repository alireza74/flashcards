/**
 * @jest-environment node
 */
// Anki-Import mit einer im Test erzeugten .apkg-Datei (altes Format, kein fremdes Deck).

import { strToU8, zipSync } from 'fflate';

import type { DataContext } from '../data/context';
import { createArea } from '../data/areas';
import { createNote, getNote, listNotes } from '../data/notes';
import { getDeckTreeIds, listChildDecks } from '../data/decks';
import { SYSTEM_NOTE_TYPE_IDS } from '../db/system-note-types';
import { createMigratedTestDb, type TestDb } from '../test-helpers/node-local-db';
import { AnkiReadError, readAnkiPackage, type AnkiDb, type AnkiModel, type OpenAnkiDb } from './anki-package';
import { loadMapping, saveMapping, suggestMapping } from './field-mapping';
import { htmlToText } from './html-to-text';
import { buildImportPlan } from './import-plan';
import { firstFieldScript, isSwapped, scriptOf } from './scripts';
import { runImport, type ImportTarget } from './run-import';

type RawSqlite = {
  exec(sql: string): void;
  prepare(sql: string): { all(...p: unknown[]): unknown[]; run(...p: unknown[]): unknown };
  serialize(): Uint8Array;
  deserialize(bytes: Uint8Array): void;
  close(): void;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => RawSqlite };

const NOW = Date.UTC(2026, 10, 27, 12);

/** Test-Oeffner: Bytes in eine Speicher-Datenbank laden (in der App macht das expo-sqlite). */
const openNodeAnkiDb: OpenAnkiDb = async (bytes) => {
  const raw = new DatabaseSync(':memory:');
  raw.deserialize(bytes);
  const db: AnkiDb = {
    async getAllAsync<T>(source: string, params: (string | number)[]) {
      return raw.prepare(source).all(...params) as T[];
    },
    async closeAsync() {
      raw.close();
    },
  };
  return db;
};

type FixtureNote = {
  id: number;
  guid: string;
  mid: number;
  fields: string[];
  tags?: string;
  did: number;
  cards?: number;
};

/** Baut eine Anki-Sammlung im alten Format (Schema 11) und packt sie wie Anki als .apkg. */
function buildApkg(notes: FixtureNote[], fileName = 'collection.anki21'): Uint8Array {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`
    CREATE TABLE col (id INTEGER PRIMARY KEY, models TEXT NOT NULL, decks TEXT NOT NULL);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, guid TEXT NOT NULL, mid INTEGER NOT NULL, mod INTEGER NOT NULL,
                        tags TEXT NOT NULL, flds TEXT NOT NULL);
    CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER NOT NULL, did INTEGER NOT NULL, ord INTEGER NOT NULL);
  `);
  const models = {
    '1001': {
      id: 1001,
      name: 'Basic (and reversed card)',
      type: 0,
      flds: [
        { name: 'Back', ord: 1 },
        { name: 'Front', ord: 0 },
      ],
      tmpls: [{}, {}],
    },
    '1002': { id: 1002, name: 'Cloze', type: 1, flds: [{ name: 'Text', ord: 0 }], tmpls: [{}] },
    '1003': {
      id: 1003,
      name: 'Vokabel',
      type: 0,
      flds: [
        { name: 'Wort', ord: 0 },
        { name: 'Bedeutung', ord: 1 },
        { name: 'Beispiel', ord: 2 },
        { name: 'Audio', ord: 3 },
      ],
      tmpls: [{}],
    },
    '1004': { id: 1004, name: 'Unused', type: 0, flds: [{ name: 'X', ord: 0 }], tmpls: [{}] },
  };
  const decks = {
    '1': { id: 1, name: 'Default' },
    '10': { id: 10, name: 'Spanisch' },
    '11': { id: 11, name: 'Spanisch::Lektion 1' },
    '12': { id: 12, name: 'Spanisch::Lektion 1::Teil A' },
  };
  raw
    .prepare('INSERT INTO col (id, models, decks) VALUES (1, ?, ?)')
    .run(JSON.stringify(models), JSON.stringify(decks));
  let cardId = 1;
  for (const note of notes) {
    raw
      .prepare('INSERT INTO notes (id, guid, mid, mod, tags, flds) VALUES (?, ?, ?, 0, ?, ?)')
      .run(note.id, note.guid, note.mid, note.tags ?? '', note.fields.join('\x1f'));
    for (let ord = 0; ord < (note.cards ?? 1); ord++)
      raw.prepare('INSERT INTO cards (id, nid, did, ord) VALUES (?, ?, ?, ?)').run(cardId++, note.id, note.did, ord);
  }
  const collection = raw.serialize();
  raw.close();
  return zipSync({ [fileName]: collection, media: strToU8('{}') });
}

const SPANISH_NOTES: FixtureNote[] = [
  {
    id: 1,
    guid: 'g1',
    mid: 1003,
    fields: ['la casa', 'das Haus', 'Mi casa es tu casa.', '[sound:casa.mp3]'],
    tags: ' A1 ',
    did: 10,
  },
  { id: 2, guid: 'g2', mid: 1003, fields: ['el perro', 'der Hund', '', ''], did: 11 },
  { id: 3, guid: 'g3', mid: 1003, fields: ['<b>gato</b>', 'Katze', '', ''], did: 12 },
  { id: 4, guid: 'g4', mid: 1002, fields: ['{{c1::Hola}} amigo'], did: 10 },
  { id: 5, guid: 'g5', mid: 1003, fields: ['banco', 'Bank (Geld)', '', ''], did: 10 },
  { id: 6, guid: 'g6', mid: 1003, fields: ['banco', 'Sitzbank', '', ''], did: 10 },
  { id: 7, guid: 'g7', mid: 1003, fields: ['', 'leer', '', ''], did: 10 },
];

async function context(): Promise<DataContext & { db: TestDb }> {
  let counter = 0;
  return { db: await createMigratedTestDb(), organizationId: 'org-1', newId: () => `id-${++counter}`, now: () => NOW };
}

async function spanishVocabulary(ctx: DataContext): Promise<ImportTarget> {
  const rootId = await createArea(ctx, {
    kind: 'language',
    name: 'Spanisch',
    lang: 'es',
    subdeckNames: { vocabulary: 'Vokabeln', phrases: 'Redewendungen', grammar: 'Grammatik' },
    defaultConfigName: 'Standard',
  });
  const deck = (await listChildDecks(ctx.db, rootId)).find((d) => d.kind === 'vocabulary')!;
  return { deckId: deck.id, kind: deck.kind, lang: deck.lang, configId: deck.config_id, level: 'B1' };
}

async function planFor(ctx: DataContext, bytes: Uint8Array) {
  const pkg = await readAnkiPackage(bytes, openNodeAnkiDb);
  const mappings = Object.fromEntries(
    await Promise.all(pkg.models.map(async (m) => [m.id, await loadMapping(ctx.db, m, 'vocabulary')] as const)),
  );
  return { pkg, plan: await buildImportPlan(ctx.db, pkg, { lang: 'es', mappings, alignDirection: true }) };
}

describe('HTML zu Text', () => {
  it('Zeilenumbrueche, Tags, Sonderzeichen, Medien', () => {
    expect(htmlToText('<div>uno</div><div>dos&nbsp;&amp; tres</div>')).toEqual({
      text: 'uno\ndos & tres',
      hadMedia: false,
    });
    expect(htmlToText('caf&eacute; &#233; &#xE9;<br/>  <i>x</i> ')).toEqual({
      text: 'caf&eacute; é é\nx',
      hadMedia: false,
    });
    expect(htmlToText('Haus [sound:haus.mp3]<img src="haus.jpg">')).toEqual({ text: 'Haus', hadMedia: true });
    expect(htmlToText('<style>.x{}</style>a<br><br><br><br>b')).toEqual({ text: 'a\n\nb', hadMedia: false });
  });
});

describe('Anki-Datei lesen', () => {
  it('liest Notiztypen, Notizen, Felder, Tags und Decks', async () => {
    const pkg = await readAnkiPackage(buildApkg(SPANISH_NOTES), openNodeAnkiDb);
    expect(pkg.models.map((m) => [m.name, m.isCloze, m.noteCount])).toEqual([
      ['Cloze', true, 1],
      ['Vokabel', false, 6],
    ]);
    expect(pkg.notes[0]).toEqual({
      guid: 'g1',
      modelId: '1003',
      fields: ['la casa', 'das Haus', 'Mi casa es tu casa.', '[sound:casa.mp3]'],
      tags: ['A1'],
      deckName: 'Spanisch',
    });
    expect(pkg.notes[2].deckName).toBe('Spanisch::Lektion 1::Teil A');
  });

  it('auch das aeltere collection.anki2', async () => {
    const pkg = await readAnkiPackage(buildApkg(SPANISH_NOTES.slice(0, 1), 'collection.anki2'), openNodeAnkiDb);
    expect(pkg.notes).toHaveLength(1);
  });

  it('neues Format, keine Anki-Datei, leere Datei', async () => {
    const newFormat = zipSync({
      'collection.anki21b': new Uint8Array([1, 2, 3]),
      'collection.anki2': new Uint8Array([1]),
    });
    await expect(readAnkiPackage(newFormat, openNodeAnkiDb)).rejects.toMatchObject({ code: 'newFormat' });
    await expect(readAnkiPackage(strToU8('kein zip'), openNodeAnkiDb)).rejects.toBeInstanceOf(AnkiReadError);
    await expect(readAnkiPackage(zipSync({ 'notes.txt': strToU8('x') }), openNodeAnkiDb)).rejects.toMatchObject({
      code: 'notAnkiFile',
    });
    await expect(readAnkiPackage(buildApkg([]), openNodeAnkiDb)).rejects.toMatchObject({ code: 'empty' });
  });
});

describe('Feldzuordnung', () => {
  const basic: AnkiModel = {
    id: '1001',
    name: 'Basic (and reversed card)',
    isCloze: false,
    fields: [
      { name: 'Front', ord: 0 },
      { name: 'Back', ord: 1 },
    ],
    templateCount: 2,
    noteCount: 1,
  };

  it('Vorschlag nach Namen und Kartenzahl', () => {
    expect(suggestMapping(basic, 'general')).toEqual({
      noteTypeId: SYSTEM_NOTE_TYPE_IDS.basicReverse,
      fields: { front: 0, back: 1 },
    });
    expect(suggestMapping(basic, 'vocabulary')).toEqual({
      noteTypeId: SYSTEM_NOTE_TYPE_IDS.vocabulary,
      fields: { word: 0, meaning: 1, example: null },
    });
    // unbekannte Namen: der Reihe nach
    const odd = {
      ...basic,
      fields: [
        { name: 'Spanisch', ord: 0 },
        { name: 'Deutsch', ord: 1 },
      ],
      templateCount: 1,
    };
    expect(suggestMapping(odd, 'general').fields).toEqual({ front: 0, back: 1 });
  });

  it('merkt sich die Zuordnung je Anki-Notiztyp', async () => {
    const ctx = await context();
    const swapped = { noteTypeId: SYSTEM_NOTE_TYPE_IDS.basic, fields: { front: 1, back: 0 } };
    await saveMapping(ctx.db, basic.id, swapped);
    expect(await loadMapping(ctx.db, basic, 'vocabulary')).toEqual(swapped);
    // passt nicht mehr zum Notiztyp (Feld 5 gibt es nicht) -> Vorschlag
    await saveMapping(ctx.db, basic.id, { ...swapped, fields: { front: 5, back: 0 } });
    expect((await loadMapping(ctx.db, basic, 'vocabulary')).noteTypeId).toBe(SYSTEM_NOTE_TYPE_IDS.vocabulary);
  });
});

describe('Vorschau', () => {
  it('Gruppen, uebersprungene Notizen, Medien, Unterdecks', async () => {
    const ctx = await context();
    await spanishVocabulary(ctx);
    const { plan } = await planFor(ctx, buildApkg(SPANISH_NOTES));
    expect(plan.counts).toEqual({ new: 4, known: 0, same: 0, variant: 1 });
    expect(plan.skippedCloze).toBe(1);
    expect(plan.skippedEmpty).toBe(1);
    expect(plan.withMedia).toBe(1);
    expect(plan.subdecks).toEqual([['Lektion 1'], ['Lektion 1', 'Teil A']]);
    const casa = plan.notes.find((n) => n.guid === 'g1')!;
    expect(casa.fields).toEqual({ word: 'la casa', meaning: 'das Haus', example: 'Mi casa es tu casa.' });
    expect(casa.dedupeKey).toBe('casa');
    expect(casa.deckPath).toEqual([]);
    expect(plan.notes.find((n) => n.guid === 'g3')!.fields.word).toBe('gato');
    expect(plan.notes.find((n) => n.guid === 'g6')!.group).toBe('variant');
  });

  it('erkennt vorhandene Woerter (gleiche und andere Bedeutung)', async () => {
    const ctx = await context();
    const target = await spanishVocabulary(ctx);
    const word = (word: string, meaning: string) =>
      createNote(ctx, {
        deckId: target.deckId,
        noteTypeId: SYSTEM_NOTE_TYPE_IDS.vocabulary,
        fields: { word, meaning, example: '' },
        level: null,
        lang: 'es',
      });
    await word('casa', 'Das Haus!');
    await word('perro', 'Hund (Tier)');
    const { plan } = await planFor(ctx, buildApkg(SPANISH_NOTES));
    const groupOf = (guid: string) => plan.notes.find((n) => n.guid === guid)!.group;
    expect(groupOf('g1')).toBe('same');
    expect(groupOf('g2')).toBe('variant');
    expect(groupOf('g3')).toBe('new');
  });
});

describe('Import', () => {
  it('legt Unterdecks, Notizen und neue Karten an; zweiter Import erkennt alles wieder', async () => {
    const ctx = await context();
    const target = await spanishVocabulary(ctx);
    const bytes = buildApkg(SPANISH_NOTES);
    const { plan } = await planFor(ctx, bytes);
    const progress: number[] = [];
    const result = await runImport(ctx, plan, target, { includeSame: false, includeVariants: true }, (done) => {
      progress.push(done);
    });
    expect(result).toEqual({ notes: 5, cards: 10, decksCreated: 2 });
    expect(progress).toEqual([0, 5]);

    const deckIds = await getDeckTreeIds(ctx.db, target.deckId);
    expect(deckIds).toHaveLength(3);
    const lesson = (await listChildDecks(ctx.db, target.deckId))[0];
    expect([lesson.name, lesson.kind, lesson.lang, lesson.config_id]).toEqual([
      'Lektion 1',
      'vocabulary',
      'es',
      target.configId,
    ]);
    expect((await listNotes(ctx.db, lesson.id, '')).map((n) => n.title)).toEqual(['el perro']);

    const rows = await ctx.db.getAllAsync<{
      id: string;
      source: string;
      external_guid: string;
      level: string;
      tags: string;
    }>('SELECT id, source, external_guid, level, tags FROM notes WHERE external_guid = ?', ['g1']);
    expect(rows[0]).toMatchObject({ source: 'anki', external_guid: 'g1', level: 'B1', tags: '["A1"]' });
    expect((await getNote(ctx.db, rows[0].id))!.fields.example).toBe('Mi casa es tu casa.');
    const cards = await ctx.db.getAllAsync<{ state: number; reps: number }>('SELECT state, reps FROM cards', []);
    expect(cards.every((c) => c.state === 0 && c.reps === 0)).toBe(true);
    const outbox = await ctx.db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM sync_outbox', []);
    expect(outbox!.n).toBeGreaterThanOrEqual(5 + 10 + 2);

    // Reihenfolge der neuen Karten = Reihenfolge in der Anki-Datei
    const order = await ctx.db.getAllAsync<{ guid: string }>(
      'SELECT external_guid AS guid FROM notes WHERE external_guid IS NOT NULL ORDER BY created_at',
      [],
    );
    expect(order.map((o) => o.guid)).toEqual(['g1', 'g2', 'g3', 'g5', 'g6']);

    // zweiter Import: alles bekannt, keine neuen Unterdecks
    const second = await planFor(ctx, bytes);
    expect(second.plan.counts).toEqual({ new: 0, known: 5, same: 0, variant: 0 });
    expect(await runImport(ctx, second.plan, target, { includeSame: false, includeVariants: true })).toEqual({
      notes: 0,
      cards: 0,
      decksCreated: 0,
    });
  });

  it('Auswahl: andere Bedeutung abwaehlen, gleiche uebernehmen; viele Notizen in Paketen', async () => {
    const ctx = await context();
    const target = await spanishVocabulary(ctx);
    const many: FixtureNote[] = Array.from({ length: 250 }, (_, i) => ({
      id: i + 1,
      guid: `m${i}`,
      mid: 1003,
      fields: [`palabra ${i}`, `Wort ${i}`, '', ''],
      did: 10,
    }));
    many.push({ id: 999, guid: 'dup', mid: 1003, fields: ['palabra 0', 'Wort 0', '', ''], did: 10 });
    many.push({ id: 1000, guid: 'var', mid: 1003, fields: ['palabra 1', 'anders', '', ''], did: 10 });
    const { plan } = await planFor(ctx, buildApkg(many));
    expect(plan.counts).toEqual({ new: 250, known: 0, same: 1, variant: 1 });
    const progress: number[] = [];
    const result = await runImport(ctx, plan, target, { includeSame: true, includeVariants: false }, (done) => {
      progress.push(done);
    });
    expect(result.notes).toBe(251);
    expect(progress).toEqual([0, 100, 200, 251]);
  });
});

describe('Richtung angleichen', () => {
  it('erkennt die Schrift', () => {
    expect(scriptOf('gutmütig')).toBe('latin');
    expect(scriptOf('خیر خواه\nنیکوکار')).toBe('arabic');
    expect(scriptOf('منطقی\nمعقول\nlogig')).toBe('arabic');
    expect(scriptOf('123 ...')).toBeNull();
    // Zielsprache entscheidet; sonst die Mehrheit
    const pairs: [string, string][] = [
      ['Haus', 'خانه'],
      ['قابل اعتماد', 'zuverlässig'],
      ['Hund', 'سگ'],
    ];
    expect(firstFieldScript(pairs, 'fa')).toBe('arabic');
    expect(firstFieldScript(pairs, null)).toBe('latin');
    expect(firstFieldScript([['mutig sein', 'er traut sich']], 'de')).toBeNull();
    expect(isSwapped('قابل اعتماد', 'zuverlässig', 'latin')).toBe(true);
    expect(isSwapped('mutig sein', 'er traut sich', 'latin')).toBe(false);
  });

  it('dreht vertauschte Notizen um und erkennt dann Duplikate in Gegenrichtung', async () => {
    const ctx = await context();
    await spanishVocabulary(ctx);
    const mixed: FixtureNote[] = [
      { id: 1, guid: 'a', mid: 1003, fields: ['gutmütig', 'خیر خواه<br>نیکوکار', '', ''], did: 10 },
      { id: 2, guid: 'b', mid: 1003, fields: ['خیر خواه<br>نیکوکار', 'gutmütig', '', ''], did: 10 },
      { id: 3, guid: 'c', mid: 1003, fields: ['قابل اعتماد', 'zuverlässig', '', ''], did: 10 },
      { id: 4, guid: 'd', mid: 1003, fields: ['er traut sich', 'mutig sein', '', ''], did: 10 },
    ];
    const pkg = await readAnkiPackage(buildApkg(mixed), openNodeAnkiDb);
    const mappings = { '1003': await loadMapping(ctx.db, pkg.models[0], 'vocabulary') };
    const aligned = await buildImportPlan(ctx.db, pkg, { lang: 'de', mappings, alignDirection: true });
    expect(aligned.swappable).toBe(2);
    expect(aligned.notes.map((n) => [n.fields.word, n.group])).toEqual([
      ['gutmütig', 'new'],
      ['gutmütig', 'same'],
      ['zuverlässig', 'new'],
      ['er traut sich', 'new'],
    ]);
    const asIs = await buildImportPlan(ctx.db, pkg, { lang: 'de', mappings, alignDirection: false });
    expect(asIs.swappable).toBe(2);
    expect(asIs.notes[2].fields.word).toBe('قابل اعتماد');
    expect(asIs.counts.same).toBe(0);
  });
});
