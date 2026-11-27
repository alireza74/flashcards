// Vorschau: Was passiert mit jeder Anki-Notiz, BEVOR etwas gespeichert wird?
//
// Gruppen:
//   new      neu                                         -> uebernehmen
//   known    schon einmal aus Anki importiert (guid)     -> immer ueberspringen
//   same     gleiches Wort, gleiche Bedeutung vorhanden  -> standardmaessig ueberspringen
//   variant  gleiches Wort, andere Bedeutung             -> standardmaessig uebernehmen
// "Gleiches Wort" = gleicher Vergleichsschluessel (normalizeDedupeKey) in derselben Sprache, ueber alle
// Decks - und auch innerhalb der Datei selbst.
// Lueckentext-Notizen und Notizen ohne erstes Feld werden gezaehlt und uebersprungen.
//
// Richtung: Mischt ein Deck die Richtung (mal Persisch vorne, mal Deutsch), dreht alignDirection die
// vertauschten Notizen um - VOR dem Duplikatvergleich, damit auch "gutmuetig - X" und "X - gutmuetig"
// als gleich erkannt werden (Erkennung ueber die Schrift, scripts.ts).
//
// Unterdecks: Die Anki-Decks werden relativ zum gemeinsamen Anfang abgebildet. Liegt alles in
// "Spanisch" und "Spanisch::Lektion 1", landet "Spanisch" im Zieldeck und "Lektion 1" als Unterdeck darunter.

import type { LocalDb } from '../db/local-db-types';
import { normalizeDedupeKey } from '../data/notes';
import type { AnkiPackage } from './anki-package';
import { targetFieldKeys, type ModelMapping } from './field-mapping';
import { htmlToText } from './html-to-text';
import { firstFieldScript, isSwapped, type Script } from './scripts';

export type ImportGroup = 'new' | 'known' | 'same' | 'variant';

export type PlannedNote = {
  guid: string;
  noteTypeId: string;
  fields: Record<string, string>;
  tags: string[];
  /** Unterdeck relativ zum Zieldeck; [] = Zieldeck selbst */
  deckPath: string[];
  dedupeKey: string;
  group: ImportGroup;
  hadMedia: boolean;
};

export type ImportPlan = {
  notes: PlannedNote[];
  counts: Record<ImportGroup, number>;
  skippedCloze: number;
  skippedEmpty: number;
  withMedia: number;
  /** Notizen mit vertauschter Richtung (vorne die Schrift, die sonst hinten steht) */
  swappable: number;
  /** Unterdecks, die angelegt werden (Pfade relativ zum Zieldeck) */
  subdecks: string[][];
};

export type PlanOptions = {
  lang: string | null;
  /** je Anki-Notiztyp (id); fehlt ein Eintrag, wird der Notiztyp uebersprungen */
  mappings: Record<string, ModelMapping>;
  /** vertauschte Notizen umdrehen (siehe scripts.ts) */
  alignDirection: boolean;
};

function splitDeckName(name: string): string[] {
  return name
    .split('::')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function commonPrefixLength(paths: string[][]): number {
  if (paths.length === 0) return 0;
  let length = 0;
  for (;;) {
    const segment = paths[0][length];
    if (segment === undefined || paths.some((path) => path[length] !== segment)) return length;
    length++;
  }
}

/** Bedeutung vergleichbar machen: klein, ohne Satzzeichen, Leerzeichen zusammengefasst. */
function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Vorhandene Notizen derselben Sprache: Schluessel -> bekannte Bedeutungen (zweites Feld). */
async function loadExisting(db: LocalDb, lang: string | null) {
  const secondKeys = new Map<string, string>();
  const fieldRows = await db.getAllAsync<{ note_type_id: string; field_key: string }>(
    'SELECT note_type_id, field_key FROM note_type_fields WHERE ord = 1 AND deleted_at IS NULL',
    [],
  );
  for (const row of fieldRows) secondKeys.set(row.note_type_id, row.field_key);

  const answers = new Map<string, string[]>();
  const rows = await db.getAllAsync<{ dedupe_key: string; fields: string; note_type_id: string }>(
    'SELECT dedupe_key, fields, note_type_id FROM notes WHERE deleted_at IS NULL AND dedupe_key IS NOT NULL AND lang IS ?',
    [lang],
  );
  for (const row of rows) {
    const fields = JSON.parse(row.fields) as Record<string, string>;
    const answer = normalizeAnswer(fields[secondKeys.get(row.note_type_id) ?? ''] ?? '');
    answers.set(row.dedupe_key, [...(answers.get(row.dedupe_key) ?? []), answer]);
  }

  const guidRows = await db.getAllAsync<{ external_guid: string }>(
    'SELECT external_guid FROM notes WHERE deleted_at IS NULL AND external_guid IS NOT NULL',
    [],
  );
  return { answers, guids: new Set(guidRows.map((row) => row.external_guid)) };
}

export async function buildImportPlan(db: LocalDb, pkg: AnkiPackage, options: PlanOptions): Promise<ImportPlan> {
  const { answers, guids } = await loadExisting(db, options.lang);
  const modelsById = new Map(pkg.models.map((model) => [model.id, model]));
  const counts: Record<ImportGroup, number> = { new: 0, known: 0, same: 0, variant: 0 };
  let skippedCloze = 0;
  let skippedEmpty = 0;
  let withMedia = 0;
  let swappable = 0;

  // 1. Felder umwandeln
  const prepared: {
    note: AnkiPackage['notes'][number];
    noteTypeId: string;
    keys: string[];
    fields: Record<string, string>;
  }[] = [];
  for (const note of pkg.notes) {
    const model = modelsById.get(note.modelId);
    const mapping = options.mappings[note.modelId];
    if (!model || model.isCloze || !mapping) {
      skippedCloze += model?.isCloze ? 1 : 0;
      skippedEmpty += model?.isCloze ? 0 : 1;
      continue;
    }
    const keys = targetFieldKeys(mapping.noteTypeId);
    const fields: Record<string, string> = {};
    for (const key of keys) {
      const ord = mapping.fields[key];
      fields[key] = htmlToText(ord === null || ord === undefined ? '' : (note.fields[ord] ?? '')).text;
    }
    prepared.push({ note, noteTypeId: mapping.noteTypeId, keys, fields });
  }

  // 2. Vertauschte Richtung erkennen (je Anki-Notiztyp) und auf Wunsch umdrehen
  const targetScripts = new Map<string, Script | null>();
  for (const modelId of new Set(prepared.map((p) => p.note.modelId))) {
    const pairs = prepared
      .filter((p) => p.note.modelId === modelId)
      .map((p): [string, string] => [p.fields[p.keys[0]] ?? '', p.fields[p.keys[1]] ?? '']);
    targetScripts.set(modelId, firstFieldScript(pairs, options.lang));
  }
  for (const p of prepared) {
    const [first, second] = p.keys;
    if (!isSwapped(p.fields[first] ?? '', p.fields[second] ?? '', targetScripts.get(p.note.modelId) ?? null)) continue;
    swappable++;
    if (options.alignDirection) [p.fields[first], p.fields[second]] = [p.fields[second], p.fields[first]];
  }

  // 3. Gruppen bilden
  const converted: (Omit<PlannedNote, 'deckPath'> & { fullDeckPath: string[] })[] = [];
  for (const { note, noteTypeId, keys, fields } of prepared) {
    // Medien in irgendeinem Feld (auch nicht zugeordneten, z. B. ein eigenes Audio-Feld)
    const hadMedia = note.fields.some((field) => htmlToText(field).hadMedia);
    const dedupeKey = normalizeDedupeKey(fields[keys[0]] ?? '', options.lang);
    if (!dedupeKey) {
      skippedEmpty++;
      continue;
    }

    let group: ImportGroup;
    if (guids.has(note.guid)) {
      group = 'known';
    } else {
      const answer = normalizeAnswer(fields[keys[1]] ?? '');
      const known = answers.get(dedupeKey);
      if (!known) group = 'new';
      else group = !answer || known.some((other) => other === answer || other === '') ? 'same' : 'variant';
      guids.add(note.guid);
      if (group !== 'same') answers.set(dedupeKey, [...(known ?? []), answer]);
    }

    counts[group]++;
    if (hadMedia) withMedia++;
    converted.push({
      guid: note.guid,
      noteTypeId,
      fields,
      tags: note.tags,
      fullDeckPath: splitDeckName(note.deckName),
      dedupeKey,
      group,
      hadMedia,
    });
  }

  const prefix = commonPrefixLength(converted.map((note) => note.fullDeckPath));
  const subdeckKeys = new Map<string, string[]>();
  const notes: PlannedNote[] = converted.map(({ fullDeckPath, ...note }) => {
    const deckPath = fullDeckPath.slice(prefix);
    for (let depth = 1; depth <= deckPath.length; depth++) {
      const path = deckPath.slice(0, depth);
      subdeckKeys.set(path.join('::'), path);
    }
    return { ...note, deckPath };
  });

  return {
    notes,
    counts,
    skippedCloze,
    skippedEmpty,
    withMedia,
    swappable,
    subdecks: [...subdeckKeys.values()],
  };
}
