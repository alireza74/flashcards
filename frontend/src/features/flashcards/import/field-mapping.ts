// Zuordnung: welches Anki-Feld kommt in welches unserer Felder?
// - Vorschlag anhand der Feldnamen (Front/Back, Word/Meaning, Vorderseite/Rueckseite ...),
//   sonst der Reihe nach.
// - Die gewaehlte Zuordnung merkt sich die App je Anki-Notiztyp (local_meta, nur auf diesem Geraet).

import type { LocalDb } from '../db/local-db-types';
import { SYSTEM_NOTE_TYPE_IDS, SYSTEM_NOTE_TYPES } from '../db/system-note-types';
import type { DeckKind } from '../data/decks';
import type { AnkiModel } from './anki-package';

export type ModelMapping = {
  noteTypeId: string;
  /** unser Feld -> Anki-Feld (ord) oder null = leer lassen */
  fields: Record<string, number | null>;
};

/** Unsere Notiztypen, in die importiert werden kann. */
export const IMPORT_NOTE_TYPE_IDS = [
  SYSTEM_NOTE_TYPE_IDS.basic,
  SYSTEM_NOTE_TYPE_IDS.basicReverse,
  SYSTEM_NOTE_TYPE_IDS.vocabulary,
] as const;

export function targetFieldKeys(noteTypeId: string): string[] {
  return SYSTEM_NOTE_TYPES.find((type) => type.id === noteTypeId)?.fields.map((field) => field.fieldKey) ?? [];
}

// Feldnamen (klein, ohne Leer-/Sonderzeichen), die zu unserem Feld passen.
const NAME_HINTS: Record<string, string[]> = {
  front: [
    'front',
    'vorderseite',
    'question',
    'frage',
    'word',
    'wort',
    'term',
    'begriff',
    'expression',
    'vocab',
    'vocabulary',
    'vokabel',
  ],
  back: [
    'back',
    'rueckseite',
    'rückseite',
    'answer',
    'antwort',
    'meaning',
    'bedeutung',
    'definition',
    'translation',
    'uebersetzung',
    'übersetzung',
  ],
  word: [
    'word',
    'wort',
    'front',
    'vorderseite',
    'term',
    'begriff',
    'expression',
    'vocab',
    'vocabulary',
    'vokabel',
    'question',
    'frage',
  ],
  meaning: [
    'meaning',
    'bedeutung',
    'back',
    'rueckseite',
    'rückseite',
    'translation',
    'uebersetzung',
    'übersetzung',
    'definition',
    'answer',
    'antwort',
  ],
  example: [
    'example',
    'examples',
    'beispiel',
    'beispielsatz',
    'sentence',
    'satz',
    'examplesentence',
    'context',
    'kontext',
  ],
};

function simplify(name: string): string {
  return name.toLowerCase().replace(/[\s_\-.:]+/g, '');
}

function suggestNoteType(model: AnkiModel, deckKind: DeckKind): string {
  if (deckKind === 'vocabulary' || deckKind === 'phrases') return SYSTEM_NOTE_TYPE_IDS.vocabulary;
  return model.templateCount >= 2 ? SYSTEM_NOTE_TYPE_IDS.basicReverse : SYSTEM_NOTE_TYPE_IDS.basic;
}

/** Felder zuordnen: erst nach Namen, dann die Pflichtfelder (die ersten zwei) der Reihe nach auffuellen. */
export function suggestFields(model: AnkiModel, noteTypeId: string): Record<string, number | null> {
  const keys = targetFieldKeys(noteTypeId);
  const used = new Set<number>();
  const result: Record<string, number | null> = {};

  for (const key of keys) {
    const hints = NAME_HINTS[key] ?? [key];
    const match = hints
      .map((hint) => model.fields.find((field) => !used.has(field.ord) && simplify(field.name) === simplify(hint)))
      .find((field) => field !== undefined);
    result[key] = match ? match.ord : null;
    if (match) used.add(match.ord);
  }

  keys.slice(0, 2).forEach((key) => {
    if (result[key] !== null) return;
    const free = model.fields.find((field) => !used.has(field.ord));
    if (free) {
      result[key] = free.ord;
      used.add(free.ord);
    }
  });
  return result;
}

export function suggestMapping(model: AnkiModel, deckKind: DeckKind): ModelMapping {
  const noteTypeId = suggestNoteType(model, deckKind);
  return { noteTypeId, fields: suggestFields(model, noteTypeId) };
}

const metaKey = (modelId: string) => `anki-mapping:${modelId}`;

/** Gemerkte Zuordnung, wenn sie zum Notiztyp noch passt; sonst der Vorschlag. */
export async function loadMapping(db: LocalDb, model: AnkiModel, deckKind: DeckKind): Promise<ModelMapping> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM local_meta WHERE key = ?', [
    metaKey(model.id),
  ]);
  if (row) {
    try {
      const saved = JSON.parse(row.value) as ModelMapping;
      const keys = targetFieldKeys(saved.noteTypeId);
      const valid =
        (IMPORT_NOTE_TYPE_IDS as readonly string[]).includes(saved.noteTypeId) &&
        keys.every((key) => {
          const ord = saved.fields[key];
          return ord === null || ord === undefined || model.fields.some((field) => field.ord === ord);
        });
      if (valid)
        return {
          noteTypeId: saved.noteTypeId,
          fields: Object.fromEntries(keys.map((k) => [k, saved.fields[k] ?? null])),
        };
    } catch {
      // ungueltig gespeichert -> Vorschlag
    }
  }
  return suggestMapping(model, deckKind);
}

export async function saveMapping(db: LocalDb, modelId: string, mapping: ModelMapping): Promise<void> {
  await db.runAsync(
    'INSERT INTO local_meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [metaKey(modelId), JSON.stringify(mapping)],
  );
}
