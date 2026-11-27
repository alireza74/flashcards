// Import ausfuehren: Unterdecks anlegen, dann Notizen + Karten in Paketen speichern.
// - Je Paket EINE Transaktion (saveRows): bricht etwas ab, fehlt hoechstens das laufende Paket.
// - Karten starten als neu (kein Lernstand aus Anki), sofort faellig.
// - created_at steigt je Notiz um 1 ms: neue Karten kommen in der Reihenfolge der Anki-Datei dran.
// - source = 'anki', external_guid = Anki-guid (erkennt einen zweiten Import derselben Notizen).

import type { DataContext } from '../data/context';
import { createDeck, type DeckKind } from '../data/decks';
import type { Level } from '../data/notes';
import type { SyncedTable } from '../db/schema';
import { saveRows } from '../sync/local-write';
import type { LocalRow } from '../sync/table-specs';
import type { ImportPlan, PlannedNote } from './import-plan';

export const IMPORT_BATCH_NOTES = 100;

export type ImportTarget = {
  deckId: string;
  kind: DeckKind;
  lang: string | null;
  configId: string | null;
  level: Level | null;
};

export type ImportChoice = { includeSame: boolean; includeVariants: boolean };

export type ImportResult = { notes: number; cards: number; decksCreated: number };

export function selectNotes(plan: ImportPlan, choice: ImportChoice): PlannedNote[] {
  return plan.notes.filter(
    (note) =>
      note.group === 'new' ||
      (note.group === 'variant' && choice.includeVariants) ||
      (note.group === 'same' && choice.includeSame),
  );
}

/** Legt fehlende Unterdecks an (vorhandene gleichen Namens werden benutzt). Liefert Pfad -> Deck-ID. */
async function ensureSubdecks(
  ctx: DataContext,
  target: ImportTarget,
  paths: string[][],
): Promise<{ deckIds: Map<string, string>; created: number }> {
  const deckIds = new Map<string, string>([['', target.deckId]]);
  let created = 0;
  for (const path of [...paths].sort((a, b) => a.length - b.length)) {
    const key = path.join('::');
    if (deckIds.has(key)) continue;
    const parentId = deckIds.get(path.slice(0, -1).join('::')) ?? target.deckId;
    const name = path[path.length - 1];
    const existing = await ctx.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM decks WHERE parent_id = ? AND deleted_at IS NULL AND lower(name) = lower(?) LIMIT 1',
      [parentId, name],
    );
    if (existing) {
      deckIds.set(key, existing.id);
      continue;
    }
    const id = await createDeck(ctx, { name, parentId, kind: target.kind, lang: target.lang }, target.configId);
    deckIds.set(key, id);
    created++;
  }
  return { deckIds, created };
}

export async function runImport(
  ctx: DataContext,
  plan: ImportPlan,
  target: ImportTarget,
  choice: ImportChoice,
  onProgress?: (done: number, total: number) => void | Promise<void>,
): Promise<ImportResult> {
  const selected = selectNotes(plan, choice);
  const usedPaths = new Map<string, string[]>();
  for (const note of selected) {
    for (let depth = 1; depth <= note.deckPath.length; depth++) {
      const path = note.deckPath.slice(0, depth);
      usedPaths.set(path.join('::'), path);
    }
  }
  const { deckIds, created } = await ensureSubdecks(ctx, target, [...usedPaths.values()]);

  const templateOrds = new Map<string, number[]>();
  for (const noteTypeId of new Set(selected.map((note) => note.noteTypeId))) {
    const rows = await ctx.db.getAllAsync<{ ord: number }>(
      'SELECT ord FROM card_templates WHERE note_type_id = ? AND deleted_at IS NULL ORDER BY ord',
      [noteTypeId],
    );
    templateOrds.set(
      noteTypeId,
      rows.map((row) => row.ord),
    );
  }

  const start = ctx.now();
  let cards = 0;
  await onProgress?.(0, selected.length);
  for (let offset = 0; offset < selected.length; offset += IMPORT_BATCH_NOTES) {
    const now = ctx.now();
    const items: { table: SyncedTable; row: LocalRow }[] = [];
    selected.slice(offset, offset + IMPORT_BATCH_NOTES).forEach((note, index) => {
      const createdAt = start + offset + index;
      const deckId = deckIds.get(note.deckPath.join('::')) ?? target.deckId;
      const noteId = ctx.newId();
      items.push({
        table: 'notes',
        row: {
          id: noteId,
          organization_id: ctx.organizationId,
          note_type_id: note.noteTypeId,
          deck_id: deckId,
          fields: JSON.stringify(note.fields),
          tags: JSON.stringify(note.tags),
          level: target.level,
          topic: null,
          source: 'anki',
          lang: target.lang,
          dedupe_key: note.dedupeKey,
          external_guid: note.guid,
          created_at: createdAt,
          updated_at: null,
          deleted_at: null,
        },
      });
      for (const ord of templateOrds.get(note.noteTypeId) ?? []) {
        cards++;
        items.push({
          table: 'cards',
          row: {
            id: ctx.newId(),
            organization_id: ctx.organizationId,
            note_id: noteId,
            template_ord: ord,
            deck_id: deckId,
            state: 0,
            due_at: now,
            last_review_at: null,
            stability: 0,
            stability_fast: 0,
            difficulty: 0,
            scheduled_days: 0,
            learning_step: 0,
            reps: 0,
            lapses: 0,
            suspended: 0,
            fsrs_model: 'fsrs-7',
            created_at: createdAt,
            updated_at: null,
            deleted_at: null,
          },
        });
      }
    });
    await saveRows(ctx.db, items, now);
    await onProgress?.(Math.min(offset + IMPORT_BATCH_NOTES, selected.length), selected.length);
  }

  return { notes: selected.length, cards, decksCreated: created };
}
