// Antwort speichern und rueckgaengig machen.
//
// Eine Antwort schreibt in EINER Transaktion: neuer Zustand der Karte + Eintrag in review_logs.
// Rueckgaengig geht nur, solange der Eintrag noch in der Warteschlange steht (nicht gesendet): dann wird
// er lokal entfernt und die Karte bekommt ihren alten Zustand. Auf dem Server bleibt die Lernhistorie
// damit "nur anfuegen". Deshalb wird waehrend einer Lernsitzung nicht abgeglichen, erst am Ende.

import type { LocalDb } from '../db/local-db-types';
import { writeTransaction } from '../db/transactions';
import { saveRows, upsertLocalRow } from '../sync/local-write';
import type { LocalRow } from '../sync/table-specs';
import type { DeckConfig, StudyCard } from './queue';
import { schedule, type Rating, type SchedulerConfig } from './scheduler';

export function schedulerConfigOf(config: DeckConfig, enableFuzz = true): SchedulerConfig {
  return {
    desiredRetention: config.desired_retention,
    learningSteps: JSON.parse(config.learning_steps) as string[],
    relearningSteps: JSON.parse(config.relearning_steps) as string[],
    maximumInterval: config.maximum_interval,
    enableFuzz,
  };
}

export type AnswerRecord = {
  logId: string;
  previousCardRow: LocalRow;
  updatedCard: StudyCard;
};

export async function answerCard(
  db: LocalDb,
  params: {
    card: StudyCard;
    rating: Rating;
    now: number;
    durationMs: number;
    isTest?: boolean;
    config: SchedulerConfig;
    newId: () => string;
    organizationId: string;
  },
): Promise<AnswerRecord> {
  const { card, rating, now, config } = params;
  const previousCardRow = await db.getFirstAsync<LocalRow>('SELECT * FROM cards WHERE id = ?', [card.id]);
  if (!previousCardRow) throw new Error('card not found');

  const result = await schedule(config, card.id, card, rating, now);
  const logId = params.newId();

  await saveRows(
    db,
    [
      { table: 'cards', row: { ...previousCardRow, ...result.card } },
      {
        table: 'review_logs',
        row: {
          id: logId,
          organization_id: params.organizationId,
          card_id: card.id,
          ...result.log,
          reviewed_at: now,
          duration_ms: Math.max(0, Math.min(Math.round(params.durationMs), 86_400_000)),
          is_test: params.isTest ? 1 : 0,
          created_at: null,
        },
      },
    ],
    now,
  );

  return { logId, previousCardRow, updatedCard: { ...card, ...result.card } };
}

/** true = rueckgaengig gemacht; false = Eintrag war schon gesendet, nichts geaendert. */
export async function undoAnswer(db: LocalDb, record: AnswerRecord, now: number): Promise<boolean> {
  return writeTransaction(db, async () => {
    const pending = await db.getFirstAsync<{ n: number }>(
      "SELECT count(*) AS n FROM sync_outbox WHERE table_name = 'review_logs' AND row_id = ?",
      [record.logId],
    );
    if (!pending || pending.n === 0) return false;

    await db.runAsync("DELETE FROM sync_outbox WHERE table_name = 'review_logs' AND row_id = ?", [record.logId]);
    await db.runAsync('DELETE FROM review_logs WHERE id = ?', [record.logId]);
    // Alter Lernstand, aber neue Aenderungszeit - so gewinnt er beim Abgleich gegen den Zwischenstand.
    await upsertLocalRow(db, 'cards', { ...record.previousCardRow, updated_at: now });
    await db.runAsync('INSERT INTO sync_outbox (table_name, row_id, op, created_at) VALUES (?, ?, ?, ?)', [
      'cards',
      String(record.previousCardRow.id),
      'upsert',
      now,
    ]);
    return true;
  });
}
