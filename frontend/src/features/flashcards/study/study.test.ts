/**
 * @jest-environment node
 */
// Lernlogik: Termine (ts-fsrs), Kartenauswahl, Gegenrichtung, Tageslimit, Speichern, Rueckgaengig.

import { createArea } from '../data/areas';
import type { DataContext } from '../data/context';
import { listChildDecks } from '../data/decks';
import { getDeckCounts } from '../data/stats';
import { createNote } from '../data/notes';
import { SYSTEM_NOTE_TYPE_IDS } from '../db/system-note-types';
import { createMigratedTestDb, type TestDb } from '../test-helpers/node-local-db';
import { interleave, loadStudyCards, StudySession, type StudyCard } from './queue';
import { intervalLabel, renderTemplate } from './render';
import { answerCard, schedulerConfigOf, undoAnswer } from './review';
import { previewDue, schedule, type SchedulerConfig } from './scheduler';
import { startOfStudyDay } from './study-day';

const MINUTE = 60_000;
const DAY = 86_400_000;
const NOW = new Date(2026, 10, 27, 12, 0, 0).getTime(); // 12 Uhr Geraetezeit
const CONFIG: SchedulerConfig = {
  desiredRetention: 0.9,
  learningSteps: ['1m', '10m'],
  relearningSteps: ['10m'],
  maximumInterval: 36500,
  enableFuzz: false,
};
const NEW_CARD = {
  state: 0,
  due_at: NOW,
  last_review_at: null,
  stability: 0,
  stability_fast: 0,
  difficulty: 0,
  scheduled_days: 0,
  learning_step: 0,
  reps: 0,
  lapses: 0,
};

async function setup(words: string[], noteType: string = SYSTEM_NOTE_TYPE_IDS.vocabulary) {
  let counter = 0;
  const ctx: DataContext & { db: TestDb } = {
    db: await createMigratedTestDb(),
    organizationId: 'org-1',
    newId: () => `id-${String(++counter).padStart(4, '0')}`,
    now: () => NOW,
  };
  const rootId = await createArea(ctx, {
    kind: 'language',
    name: 'Englisch',
    lang: 'en',
    subdeckNames: { vocabulary: 'Vokabeln' },
    defaultConfigName: 'Standard',
  });
  const deckId = (await listChildDecks(ctx.db, rootId)).find((d) => d.kind === 'vocabulary')!.id;
  for (const word of words) {
    await createNote(ctx, {
      deckId,
      noteTypeId: noteType,
      fields:
        noteType === SYSTEM_NOTE_TYPE_IDS.vocabulary ? { word, meaning: `M-${word}` } : { front: word, back: '-' },
      level: null,
      lang: 'en',
    });
  }
  const deckIds = (await ctx.db.getAllAsync<{ id: string }>('SELECT id FROM decks', [])).map((d) => d.id);
  return { ctx, rootId, deckIds };
}

describe('Termine mit ts-fsrs (FSRS-7, Lernschritte eingehalten)', () => {
  it('neue Karte: Nochmal 1 min, Gewusst 10 min', async () => {
    const due = await previewDue(CONFIG, 'c1', NEW_CARD, NOW);
    expect(due[1] - NOW).toBe(1 * MINUTE);
    expect(due[3] - NOW).toBe(10 * MINUTE);
  });

  it('zweimal Gewusst -> Wiederholung in Tagen; Vergessen -> Neu lernen 10 min', async () => {
    const first = await schedule(CONFIG, 'c1', NEW_CARD, 3, NOW);
    const second = await schedule(CONFIG, 'c1', first.card, 3, first.card.due_at);
    expect(second.card.state).toBe(2);
    expect(second.card.due_at - first.card.due_at).toBeGreaterThan(1 * DAY);

    const lapse = await schedule(CONFIG, 'c1', second.card, 1, second.card.due_at);
    expect(lapse.card.state).toBe(3);
    expect(lapse.card.lapses).toBe(1);
    expect(lapse.card.due_at - second.card.due_at).toBe(10 * MINUTE);
    // Lernhistorie enthaelt den Zustand VOR der Antwort
    expect(lapse.log.state).toBe(2);
    expect(lapse.log.rating).toBe(1);
  });
});

describe('Kartenauswahl', () => {
  it('Gegenrichtung derselben Notiz kommt nicht in dieselbe Sitzung', async () => {
    const { ctx, rootId, deckIds } = await setup(['house', 'tree']);
    const load = await loadStudyCards(ctx.db, deckIds, rootId, NOW);
    const notes = load.queue.map((c) => c.note_id);
    expect(load.queue).toHaveLength(2); // 2 Notizen x 2 Richtungen -> je eine Karte
    expect(new Set(notes).size).toBe(2);
  });

  it('nach einer Antwort heute bleibt die Gegenrichtung bis morgen liegen', async () => {
    const { ctx, rootId, deckIds } = await setup(['house']);
    const load = await loadStudyCards(ctx.db, deckIds, rootId, NOW);
    const card = load.queue[0];
    await answerCard(ctx.db, {
      card,
      rating: 3,
      now: NOW,
      durationMs: 2000,
      config: CONFIG,
      newId: ctx.newId,
      organizationId: 'org-1',
    });
    const later = await loadStudyCards(ctx.db, deckIds, rootId, NOW + 30 * MINUTE);
    // die beantwortete Karte kommt als Lernkarte wieder, die Gegenrichtung nicht
    expect(later.learning.map((c) => c.id)).toEqual([card.id]);
    expect(later.queue).toHaveLength(0);

    // Lernkarte abschliessen (zweites "Gewusst" -> Wiederholung in Tagen), dann ist morgen die Gegenrichtung dran
    await answerCard(ctx.db, {
      card: later.learning[0],
      rating: 3,
      now: NOW + 30 * MINUTE,
      durationMs: 2000,
      config: CONFIG,
      newId: ctx.newId,
      organizationId: 'org-1',
    });
    const tomorrow = await loadStudyCards(ctx.db, deckIds, rootId, startOfStudyDay(NOW) + DAY + MINUTE);
    expect(tomorrow.queue.map((c) => c.template_ord)).toContain(1);
  });

  it('haelt das Tageslimit fuer neue Karten ein', async () => {
    const words = Array.from({ length: 25 }, (_, i) => `w${i}`);
    const { ctx, rootId, deckIds } = await setup(words, SYSTEM_NOTE_TYPE_IDS.basic);
    const load = await loadStudyCards(ctx.db, deckIds, rootId, NOW);
    expect(load.queue).toHaveLength(20);
  });

  it('mischt neue Karten gleichmaessig unter Wiederholungen', () => {
    const card = (id: string) => ({ id }) as StudyCard;
    const mixed = interleave([card('r1'), card('r2'), card('r3'), card('r4')], [card('n1'), card('n2')]);
    expect(mixed.map((c) => c.id)).toEqual(['r1', 'r2', 'n1', 'r3', 'r4', 'n2']);
  });

  it('Sitzung: Nochmal-Karte kommt nach Ablauf wieder, am Ende auch frueher', () => {
    const a = { id: 'a', state: 0, due_at: NOW } as StudyCard;
    const b = { id: 'b', state: 0, due_at: NOW } as StudyCard;
    const session = new StudySession({ learning: [], queue: [a, b] });
    expect(session.next(NOW)?.id).toBe('a');
    session.answered({ ...a, state: 1, due_at: NOW + MINUTE }, NOW);
    expect(session.next(NOW)?.id).toBe('b'); // a noch nicht faellig
    expect(session.next(NOW + 2 * MINUTE)?.id).toBe('a'); // jetzt faellig
    session.answered({ ...a, state: 1, due_at: NOW + 12 * MINUTE }, NOW + 2 * MINUTE);
    expect(session.next(NOW + 3 * MINUTE)?.id).toBe('a'); // nichts anderes da -> bis 20 min frueher
    session.answered({ ...a, state: 2, due_at: NOW + 3 * DAY }, NOW + 3 * MINUTE);
    expect(session.next(NOW + 4 * MINUTE)).toBeNull();
  });
});

describe('Antwort speichern und rueckgaengig', () => {
  it('speichert Karte und Lernhistorie zusammen in der Warteschlange', async () => {
    const { ctx, rootId, deckIds } = await setup(['house']);
    const card = (await loadStudyCards(ctx.db, deckIds, rootId, NOW)).queue[0];
    const before = await ctx.db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM sync_outbox', []);
    const record = await answerCard(ctx.db, {
      card,
      rating: 3,
      now: NOW,
      durationMs: 4200,
      config: CONFIG,
      newId: ctx.newId,
      organizationId: 'org-1',
    });
    expect(record.updatedCard.state).toBe(1);
    const log = await ctx.db.getFirstAsync<{ rating: number; state: number; duration_ms: number }>(
      'SELECT rating, state, duration_ms FROM review_logs WHERE id = ?',
      [record.logId],
    );
    expect(log).toEqual({ rating: 3, state: 0, duration_ms: 4200 });
    const after = await ctx.db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM sync_outbox', []);
    expect(after!.n - before!.n).toBe(2);
  });

  it('rueckgaengig stellt den alten Stand her, solange nicht gesendet', async () => {
    const { ctx, rootId, deckIds } = await setup(['house']);
    const card = (await loadStudyCards(ctx.db, deckIds, rootId, NOW)).queue[0];
    const record = await answerCard(ctx.db, {
      card,
      rating: 3,
      now: NOW,
      durationMs: 1000,
      config: CONFIG,
      newId: ctx.newId,
      organizationId: 'org-1',
    });
    expect(await undoAnswer(ctx.db, record, NOW + 1000)).toBe(true);
    const row = await ctx.db.getFirstAsync<{ state: number; updated_at: number }>(
      'SELECT state, updated_at FROM cards WHERE id = ?',
      [card.id],
    );
    expect(row).toEqual({ state: 0, updated_at: NOW + 1000 });
    const logs = await ctx.db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM review_logs', []);
    expect(logs?.n).toBe(0);

    // schon gesendet (nicht mehr in der Warteschlange) -> kein Rueckgaengig
    const again = await answerCard(ctx.db, {
      card,
      rating: 3,
      now: NOW + 2000,
      durationMs: 1000,
      config: CONFIG,
      newId: ctx.newId,
      organizationId: 'org-1',
    });
    await ctx.db.runAsync("DELETE FROM sync_outbox WHERE table_name = 'review_logs'", []);
    expect(await undoAnswer(ctx.db, again, NOW + 3000)).toBe(false);
  });

  it('Lernoptionen aus der Datenbank werden richtig uebernommen', () => {
    const config = schedulerConfigOf(
      {
        desired_retention: 0.85,
        learning_steps: '["1m","10m"]',
        relearning_steps: '["10m"]',
        new_per_day: 20,
        reviews_per_day: 200,
        answer_buttons: 2,
        maximum_interval: 365,
      },
      false,
    );
    expect(config).toEqual({
      desiredRetention: 0.85,
      learningSteps: ['1m', '10m'],
      relearningSteps: ['10m'],
      maximumInterval: 365,
      enableFuzz: false,
    });
  });
});

describe('Darstellung', () => {
  it('fuellt die Vorlage und laesst keine Leerzeilen von leeren Feldern', () => {
    expect(renderTemplate('{{meaning}}\n\n{{example}}', { meaning: 'Haus', example: '' })).toBe('Haus');
    expect(renderTemplate('{{ word }}', { word: 'house' })).toBe('house');
  });

  it.each([
    [MINUTE, { unit: 'minutes', count: 1 }],
    [10 * MINUTE, { unit: 'minutes', count: 10 }],
    [5 * 60 * MINUTE, { unit: 'hours', count: 5 }],
    [4 * DAY, { unit: 'days', count: 4 }],
    [90 * DAY, { unit: 'months', count: 3 }],
    [500 * DAY, { unit: 'years', count: 1.4 }],
  ])('%d ms', (ms, expected) => {
    expect(intervalLabel(ms)).toEqual(expected);
  });
});

describe('Zaehlung passt zur Sitzung', () => {
  it('eine Vokabel mit zwei Richtungen zaehlt heute als eine neue Karte', async () => {
    const { ctx, rootId } = await setup(['house']);
    const counts = await getDeckCounts(ctx.db, rootId, NOW);
    expect(counts).toMatchObject({ new: 2, total: 2, newToday: 1, due: 0 });
  });
});
