// Testmodus: pruefen, was man gerade kann - OHNE die Termine zu veraendern.
//
// - Auswahl: Deck mit Unterdecks, optional nur gelernte Karten oder ein Kartei-Box-Fach, optional Niveau,
//   Richtung (wie die Karten / nur vorwaerts / nur rueckwaerts). Je Notiz hoechstens eine Karte,
//   zufaellige Reihenfolge, gewuenschte Anzahl.
// - Antwort: Eintrag in review_logs mit is_test = 1 und dem UNVERAENDERTEN Zustand der Karte.
//   Kartenauswahl beim Lernen, Tageslimits und Fortschrittsring zaehlen nur is_test = 0.
// - Rueckgaengig: solange der Eintrag noch nicht gesendet ist (wie beim Lernen).
// - "Nicht gewusste neu lernen": bewusst eine echte Antwort "Nochmal" (is_test = 0) - die Karten kommen
//   dann wie vergessene Karten bald wieder.

import type { BoxFilter } from '../data/card-browser';
import { MATURE_DAYS } from '../data/stats';
import type { Level } from '../data/notes';
import type { LocalDb, SqlValue } from '../db/local-db-types';
import { writeTransaction } from '../db/transactions';
import { saveRows } from '../sync/local-write';
import { getDeckTreeIds } from '../data/decks';
import type { DataContext } from '../data/context';
import { DEFAULT_CONFIG, loadStudyCardById, type DeckConfig, type StudyCard } from './queue';
import { answerCard, schedulerConfigOf } from './review';

export type TestScope = 'all' | 'learned' | BoxFilter;
export type TestDirection = 'cards' | 'forward' | 'reverse';

export type TestOptions = {
  deckId: string;
  /** null = alle passenden */
  count: number | null;
  scope: TestScope;
  level: Level | null;
  direction: TestDirection;
};

export type TestCard = { id: string; note_id: string; template_ord: number };

const SCOPE_CONDITIONS: Record<TestScope, string | null> = {
  all: null,
  learned: 'c.state <> 0',
  new: 'c.state = 0',
  learning: 'c.state IN (1, 3)',
  young: `c.state = 2 AND c.scheduled_days < ${MATURE_DAYS}`,
  mature: `c.state = 2 AND c.scheduled_days >= ${MATURE_DAYS}`,
};

/** Mischen (Fisher-Yates); random austauschbar fuer Tests. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function pickTestCards(
  db: LocalDb,
  options: TestOptions,
  random: () => number = Math.random,
): Promise<TestCard[]> {
  const deckIds = await getDeckTreeIds(db, options.deckId);
  if (deckIds.length === 0) return [];
  const parts = [
    'c.deleted_at IS NULL',
    'c.suspended = 0',
    'n.deleted_at IS NULL',
    `c.deck_id IN (${deckIds.map(() => '?').join(', ')})`,
  ];
  const params: SqlValue[] = [...deckIds];
  const scope = SCOPE_CONDITIONS[options.scope];
  if (scope) parts.push(scope);
  if (options.level) {
    parts.push('n.level = ?');
    params.push(options.level);
  }
  if (options.direction === 'forward') parts.push('c.template_ord = 0');
  if (options.direction === 'reverse') parts.push('c.template_ord = 1');

  const rows = await db.getAllAsync<TestCard>(
    `SELECT c.id, c.note_id, c.template_ord FROM cards c JOIN notes n ON n.id = c.note_id
     WHERE ${parts.join(' AND ')}`,
    params,
  );
  // je Notiz hoechstens eine Karte (zufaellig welche), dann mischen und kuerzen
  const byNote = new Map<string, TestCard>();
  for (const card of shuffle(rows, random)) if (!byNote.has(card.note_id)) byNote.set(card.note_id, card);
  const picked = shuffle([...byNote.values()], random);
  return options.count === null ? picked : picked.slice(0, options.count);
}

export type TestAnswer = { logId: string; cardId: string; known: boolean };

/** Testantwort speichern: nur ein Eintrag in review_logs (is_test = 1), Karte unveraendert. */
export async function recordTestAnswer(
  ctx: DataContext,
  cardId: string,
  known: boolean,
  durationMs: number,
): Promise<TestAnswer> {
  const card = await ctx.db.getFirstAsync<{
    state: number;
    due_at: number;
    last_review_at: number | null;
    stability: number;
    stability_fast: number;
    difficulty: number;
    scheduled_days: number;
    learning_step: number;
  }>(
    `SELECT state, due_at, last_review_at, stability, stability_fast, difficulty, scheduled_days, learning_step
     FROM cards WHERE id = ?`,
    [cardId],
  );
  if (!card) throw new Error('card not found');
  const now = ctx.now();
  const logId = ctx.newId();
  await saveRows(
    ctx.db,
    [
      {
        table: 'review_logs',
        row: {
          id: logId,
          organization_id: ctx.organizationId,
          card_id: cardId,
          rating: known ? 3 : 1,
          ...card,
          reviewed_at: now,
          duration_ms: Math.max(0, Math.min(Math.round(durationMs), 86_400_000)),
          is_test: 1,
          created_at: null,
        },
      },
    ],
    now,
  );
  return { logId, cardId, known };
}

/** true = rueckgaengig gemacht; false = schon gesendet. */
export async function undoTestAnswer(db: LocalDb, answer: TestAnswer): Promise<boolean> {
  return writeTransaction(db, async () => {
    const pending = await db.getFirstAsync<{ n: number }>(
      "SELECT count(*) AS n FROM sync_outbox WHERE table_name = 'review_logs' AND row_id = ?",
      [answer.logId],
    );
    if (!pending || pending.n === 0) return false;
    await db.runAsync("DELETE FROM sync_outbox WHERE table_name = 'review_logs' AND row_id = ?", [answer.logId]);
    await db.runAsync('DELETE FROM review_logs WHERE id = ? AND is_test = 1', [answer.logId]);
    return true;
  });
}

/** "Nicht gewusste neu lernen": echte Antwort "Nochmal" je Karte (mit den Lernoptionen ihres Decks). */
export async function relearnCards(ctx: DataContext, cardIds: string[]): Promise<number> {
  const configs = new Map(
    (await ctx.db.getAllAsync<DeckConfig & { id: string }>('SELECT * FROM deck_configs', [])).map((c) => [c.id, c]),
  );
  let count = 0;
  for (const cardId of cardIds) {
    const card: StudyCard | null = await loadStudyCardById(ctx.db, cardId);
    if (!card) continue;
    const config = (card.config_id && configs.get(card.config_id)) || null;
    await answerCard(ctx.db, {
      card,
      rating: 1,
      now: ctx.now(),
      durationMs: 0,
      config: schedulerConfigOf(config ?? DEFAULT_CONFIG),
      newId: ctx.newId,
      organizationId: ctx.organizationId,
    });
    count++;
  }
  return count;
}
