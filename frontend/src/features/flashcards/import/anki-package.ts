// Anki-Paket (.apkg) lesen - nur der Inhalt, ohne Lernstand und ohne Medien.
//
// Eine .apkg-Datei ist ein ZIP-Archiv:
//   collection.anki21   SQLite-Datenbank im alten Format (Schema 11)  -> lesen wir
//   collection.anki2    noch aelteres Format (Schema 11)              -> lesen wir
//   collection.anki21b  neues Format (zstd-gepackt, Schema 18)       -> noch nicht; Hinweis an den Nutzer
//   media, 0, 1, ...    Medien                                        -> Stufe 2
//
// Neue Anki-Versionen legen beim neuen Format zusaetzlich eine "collection.anki2" mit nur einer
// Platzhalter-Notiz bei. Darum: anki21 vor anki21b vor anki2.
//
// Im alten Format stehen Notiztypen und Decks als JSON in der Tabelle col (Spalten models, decks).
// Die Felder einer Notiz stehen in notes.flds, getrennt mit dem Zeichen 0x1F.
// Das Deck einer Notiz steht an ihren Karten (cards.did); wir nehmen das der ersten Karte.

import { unzipSync } from 'fflate';

/** Lesezugriff auf die entpackte Anki-Datenbank (App: expo-sqlite, Tests: node:sqlite). */
export type AnkiDb = {
  getAllAsync<T>(source: string, params: (string | number)[]): Promise<T[]>;
  closeAsync(): Promise<void>;
};
export type OpenAnkiDb = (bytes: Uint8Array) => Promise<AnkiDb>;

export type AnkiField = { name: string; ord: number };

export type AnkiModel = {
  id: string;
  name: string;
  /** Lueckentext (Cloze) - wird nicht uebernommen */
  isCloze: boolean;
  fields: AnkiField[];
  templateCount: number;
  noteCount: number;
};

export type AnkiNote = {
  guid: string;
  modelId: string;
  /** Feldinhalte (HTML) in der Reihenfolge der Felder des Notiztyps */
  fields: string[];
  tags: string[];
  /** Deckname mit "::" als Trenner, z. B. "Spanisch::Lektion 1" */
  deckName: string;
};

export type AnkiPackage = { models: AnkiModel[]; notes: AnkiNote[] };

export type AnkiReadErrorCode = 'notAnkiFile' | 'newFormat' | 'empty';

export class AnkiReadError extends Error {
  constructor(readonly code: AnkiReadErrorCode) {
    super(`anki import: ${code}`);
  }
}

const FIELD_SEPARATOR = '\x1f';

/** Waehlt die lesbare Datenbank im Archiv. */
export function pickCollection(files: Record<string, Uint8Array>): Uint8Array {
  if (files['collection.anki21']) return files['collection.anki21'];
  if (files['collection.anki21b']) throw new AnkiReadError('newFormat');
  if (files['collection.anki2']) return files['collection.anki2'];
  throw new AnkiReadError('notAnkiFile');
}

function unzip(bytes: Uint8Array): Record<string, Uint8Array> {
  try {
    // Medien nicht entpacken (Speicher sparen) - nur die Datenbanken.
    return unzipSync(bytes, { filter: (file) => file.name.startsWith('collection.') });
  } catch {
    throw new AnkiReadError('notAnkiFile');
  }
}

type ModelJson = {
  id: number | string;
  name: string;
  type: number;
  flds: { name: string; ord: number }[];
  tmpls: unknown[];
};
type DeckJson = { id: number | string; name: string };

export async function readAnkiPackage(bytes: Uint8Array, openDb: OpenAnkiDb): Promise<AnkiPackage> {
  const collection = pickCollection(unzip(bytes));
  let db: AnkiDb;
  try {
    db = await openDb(collection);
  } catch {
    throw new AnkiReadError('notAnkiFile');
  }

  try {
    let col: { models: string; decks: string } | undefined;
    try {
      [col] = await db.getAllAsync<{ models: string; decks: string }>('SELECT models, decks FROM col', []);
    } catch {
      throw new AnkiReadError('notAnkiFile');
    }
    if (!col) throw new AnkiReadError('notAnkiFile');

    const modelJson = JSON.parse(col.models || '{}') as Record<string, ModelJson>;
    const deckJson = JSON.parse(col.decks || '{}') as Record<string, DeckJson>;
    // Schema 18 hat Notiztypen in eigenen Tabellen, col.models ist dann leer.
    if (Object.keys(modelJson).length === 0) throw new AnkiReadError('newFormat');

    const deckNames = new Map(Object.values(deckJson).map((deck) => [String(deck.id), deck.name]));

    const rows = await db.getAllAsync<{
      guid: string;
      mid: number | string;
      tags: string;
      flds: string;
      did: number | string;
    }>(
      `SELECT n.guid, n.mid, n.tags, n.flds,
              (SELECT c.did FROM cards c WHERE c.nid = n.id ORDER BY c.ord LIMIT 1) AS did
       FROM notes n ORDER BY n.id`,
      [],
    );
    if (rows.length === 0) throw new AnkiReadError('empty');

    const notes: AnkiNote[] = rows.map((row) => ({
      guid: row.guid,
      modelId: String(row.mid),
      fields: row.flds.split(FIELD_SEPARATOR),
      tags: row.tags.split(' ').filter((tag) => tag.length > 0),
      deckName: deckNames.get(String(row.did)) ?? '',
    }));

    const noteCounts = new Map<string, number>();
    for (const note of notes) noteCounts.set(note.modelId, (noteCounts.get(note.modelId) ?? 0) + 1);

    const models: AnkiModel[] = Object.values(modelJson)
      .map((model) => ({
        id: String(model.id),
        name: model.name,
        isCloze: model.type === 1,
        fields: [...model.flds].sort((a, b) => a.ord - b.ord).map((f) => ({ name: f.name, ord: f.ord })),
        templateCount: model.tmpls.length,
        noteCount: noteCounts.get(String(model.id)) ?? 0,
      }))
      .filter((model) => model.noteCount > 0);

    return { models, notes };
  } finally {
    await db.closeAsync().catch(() => undefined);
  }
}
