/**
 * @jest-environment node
 */
// Abgleich ohne Server: echte Logik, lokale Datenbank = node:sqlite, Server = FakeRemote (im Speicher,
// verhaelt sich wie der Supabase-Trigger: neuere Aenderung gewinnt, server_updated_at steigt).

import type { SyncedTable } from '../db/schema';
import { createMigratedTestDb, type TestDb } from '../test-helpers/node-local-db';
import { cardRow, deckRow, reviewLogRow, vocabularyNoteRow } from '../test-helpers/rows';
import { markDeleted, saveRow } from './local-write';
import { pullChanges, PULL_OVERLAP_MS } from './pull';
import { pushChanges } from './push';
import type { PullCursor, RemoteError, SyncRemote } from './remote';
import { runSync } from './run-sync';
import { parseServerTime, toLocalRow, toServerRow, type ServerRow } from './table-specs';

const ORG = 'o-1';

class FakeRemote implements SyncRemote {
  tables = new Map<string, Map<string, ServerRow>>();
  clock = Date.UTC(2026, 10, 27, 12);
  transientFailure = false;
  rejectIds = new Set<string>();
  pullCalls: { table: SyncedTable; since: string | null }[] = [];
  onUpsert?: () => Promise<void>;

  table(name: string) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }

  async upsert(table: SyncedTable, rows: ServerRow[], ignoreDuplicates: boolean): Promise<RemoteError | null> {
    await this.onUpsert?.();
    if (this.transientFailure) return { message: 'Network request failed' };
    if (rows.some((row) => this.rejectIds.has(String(row.id)))) return { code: '42501', message: 'rls' };
    for (const row of rows) {
      const existing = this.table(table).get(String(row.id));
      if (existing && ignoreDuplicates) continue;
      if (existing && 'updated_at' in row && String(row.updated_at) < String(existing.updated_at)) continue;
      // Mikrosekunden wie Postgres, damit parseServerTime mitgetestet wird
      const serverUpdatedAt = new Date((this.clock += 1000)).toISOString().replace('Z', '123+00:00');
      this.table(table).set(String(row.id), { ...row, server_updated_at: serverUpdatedAt });
    }
    return null;
  }

  async pull(table: SyncedTable, since: string | null, after: PullCursor | null, limit: number) {
    this.pullCalls.push({ table, since });
    const key = (row: ServerRow) => [parseServerTime(String(row.server_updated_at)), String(row.id)] as const;
    const rows = [...this.table(table).values()]
      .filter((row) => !since || parseServerTime(String(row.server_updated_at)) >= parseServerTime(since))
      .filter((row) => {
        if (!after) return true;
        const [ts, id] = key(row);
        const afterTs = parseServerTime(after.serverUpdatedAt);
        return ts > afterTs || (ts === afterTs && id > after.id);
      })
      .sort((a, b) => key(a)[0] - key(b)[0] || key(a)[1].localeCompare(key(b)[1]))
      .slice(0, limit);
    return { rows, error: null };
  }
}

async function outboxCount(db: TestDb, failed = 0): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM sync_outbox WHERE failed = ?', [failed]);
  return row?.n ?? 0;
}

async function seedVocabulary(db: TestDb, now = 1000) {
  await saveRow(db, 'decks', deckRow('d1', ORG, 'Englisch'), now);
  await saveRow(db, 'notes', vocabularyNoteRow('n1', ORG, 'd1', 'house'), now);
  await saveRow(db, 'cards', cardRow('c1', ORG, 'n1', 'd1'), now);
  await saveRow(db, 'review_logs', reviewLogRow('r1', ORG, 'c1'), now);
}

describe('Umwandlung Handy <-> Server', () => {
  it('wandelt Zeiten, Wahrheitswerte, Listen und JSON hin und zurueck', () => {
    const local = { ...cardRow('c1', ORG, 'n1', 'd1'), suspended: 1, created_at: 5, updated_at: 6 };
    const server = toServerRow('cards', local);
    expect(server.suspended).toBe(true);
    expect(server.due_at).toBe('2026-11-27T08:00:00.000Z');
    expect(toLocalRow('cards', server)).toEqual(local);

    const note = { ...vocabularyNoteRow('n1', ORG, 'd1', 'house'), created_at: 1, updated_at: 2 };
    const serverNote = toServerRow('notes', note);
    expect(serverNote.tags).toEqual(['test']);
    expect(serverNote.fields).toEqual({ word: 'house', meaning: 'Bedeutung von house' });
    expect(toLocalRow('notes', serverNote)).toEqual(note);
  });

  it('liest Postgres-Zeitstempel mit Mikrosekunden', () => {
    expect(parseServerTime('2026-11-27T16:13:00.123456+00:00')).toBe(Date.UTC(2026, 10, 27, 16, 13, 0, 123));
  });
});

describe('lokal schreiben', () => {
  it('speichert Zeile und Eintrag in der Warteschlange, setzt Zeiten', async () => {
    const db = await createMigratedTestDb();
    await saveRow(db, 'decks', deckRow('d1', ORG), 1234);
    const deck = await db.getFirstAsync<{ created_at: number; updated_at: number }>(
      "SELECT created_at, updated_at FROM decks WHERE id = 'd1'",
      [],
    );
    expect(deck).toEqual({ created_at: 1234, updated_at: 1234 });
    expect(await outboxCount(db)).toBe(1);
  });

  it('loescht nur per Loeschmarker', async () => {
    const db = await createMigratedTestDb();
    await saveRow(db, 'decks', deckRow('d1', ORG), 1000);
    await markDeleted(db, 'decks', 'd1', 2000);
    const deck = await db.getFirstAsync<{ deleted_at: number }>("SELECT deleted_at FROM decks WHERE id = 'd1'", []);
    expect(deck?.deleted_at).toBe(2000);
    expect(await outboxCount(db)).toBe(2);
  });
});

describe('senden', () => {
  it('sendet alles und leert die Warteschlange', async () => {
    const db = await createMigratedTestDb();
    const remote = new FakeRemote();
    await seedVocabulary(db);
    const result = await pushChanges(db, remote);
    expect(result).toMatchObject({ sent: 4, failed: 0, offline: false });
    expect(remote.table('notes').get('n1')?.fields).toEqual({ word: 'house', meaning: 'Bedeutung von house' });
    expect(await outboxCount(db)).toBe(0);
  });

  it('behaelt bei fehlendem Netz alles in der Warteschlange', async () => {
    const db = await createMigratedTestDb();
    const remote = new FakeRemote();
    remote.transientFailure = true;
    await seedVocabulary(db);
    const result = await pushChanges(db, remote);
    expect(result.offline).toBe(true);
    expect(await outboxCount(db)).toBe(4);
  });

  it('markiert nur die abgelehnte Zeile als fehlerhaft', async () => {
    const db = await createMigratedTestDb();
    const remote = new FakeRemote();
    await saveRow(db, 'decks', deckRow('d1', ORG), 1000);
    await saveRow(db, 'decks', deckRow('d2', ORG), 1000);
    remote.rejectIds.add('d2');
    const result = await pushChanges(db, remote);
    expect(result).toMatchObject({ sent: 1, failed: 1 });
    expect(await outboxCount(db, 0)).toBe(0);
    expect(await outboxCount(db, 1)).toBe(1);
    // beim naechsten Senden nicht erneut versucht
    expect((await pushChanges(db, remote)).sent).toBe(0);
  });

  it('behaelt Aenderungen, die waehrend des Sendens entstehen', async () => {
    const db = await createMigratedTestDb();
    const remote = new FakeRemote();
    await saveRow(db, 'decks', deckRow('d1', ORG), 1000);
    remote.onUpsert = async () => {
      remote.onUpsert = undefined;
      await saveRow(db, 'decks', { ...deckRow('d1', ORG, 'neu'), created_at: 1000 }, 2000);
    };
    await pushChanges(db, remote);
    expect(await outboxCount(db)).toBe(1);
    await pushChanges(db, remote);
    expect(remote.table('decks').get('d1')?.name).toBe('neu');
  });
});

describe('holen', () => {
  it('uebernimmt Server-Zeilen ohne Warteschlange und merkt sich den Stand', async () => {
    const device1 = await createMigratedTestDb();
    const device2 = await createMigratedTestDb();
    const remote = new FakeRemote();
    await seedVocabulary(device1);
    await pushChanges(device1, remote);

    const result = await pullChanges(device2, remote);
    expect(result.error).toBeUndefined();
    const note = await device2.getFirstAsync<{ fields: string }>("SELECT fields FROM notes WHERE id = 'n1'", []);
    expect(JSON.parse(note!.fields)).toMatchObject({ word: 'house' });
    expect(await outboxCount(device2)).toBe(0);

    const state = await device2.getFirstAsync<{ last_pulled_at: string }>(
      "SELECT last_pulled_at FROM sync_state WHERE table_name = 'notes'",
      [],
    );
    expect(state?.last_pulled_at).toBe(remote.table('notes').get('n1')?.server_updated_at);
  });

  it('holt beim naechsten Mal ab Stand minus Sicherheitsfenster', async () => {
    const db = await createMigratedTestDb();
    const remote = new FakeRemote();
    await saveRow(db, 'decks', deckRow('d1', ORG), 1000);
    await runSync(db, remote);
    remote.pullCalls = [];
    await pullChanges(db, remote);
    const deckCall = remote.pullCalls.find((call) => call.table === 'decks');
    const lastPulled = String(remote.table('decks').get('d1')?.server_updated_at);
    expect(parseServerTime(deckCall!.since!)).toBe(parseServerTime(lastPulled) - PULL_OVERLAP_MS);
  });

  it('ueberschreibt keine neuere lokale Aenderung', async () => {
    const device1 = await createMigratedTestDb();
    const device2 = await createMigratedTestDb();
    const remote = new FakeRemote();
    await saveRow(device1, 'decks', deckRow('d1', ORG, 'alt'), 1000);
    await runSync(device1, remote);
    await runSync(device2, remote);

    await saveRow(device2, 'decks', { ...deckRow('d1', ORG, 'Geraet 2'), created_at: 1000 }, 3000);
    await saveRow(device1, 'decks', { ...deckRow('d1', ORG, 'Geraet 1'), created_at: 1000 }, 2000);

    await runSync(device2, remote); // neuere Aenderung zuerst
    await runSync(device1, remote); // aeltere wird vom Server verworfen, Geraet 1 holt die neuere
    await runSync(device2, remote);

    for (const db of [device1, device2]) {
      const deck = await db.getFirstAsync<{ name: string }>("SELECT name FROM decks WHERE id = 'd1'", []);
      expect(deck?.name).toBe('Geraet 2');
    }
  });

  it('gibt Loeschungen an andere Geraete weiter', async () => {
    const device1 = await createMigratedTestDb();
    const device2 = await createMigratedTestDb();
    const remote = new FakeRemote();
    await seedVocabulary(device1);
    await runSync(device1, remote);
    await runSync(device2, remote);
    await markDeleted(device2, 'notes', 'n1', 5000);
    await runSync(device2, remote);
    await runSync(device1, remote);
    const note = await device1.getFirstAsync<{ deleted_at: number }>("SELECT deleted_at FROM notes WHERE id = 'n1'", []);
    expect(note?.deleted_at).toBe(5000);
  });

  it('holt in Seiten (mehr als eine Seite)', async () => {
    const device1 = await createMigratedTestDb();
    const device2 = await createMigratedTestDb();
    const remote = new FakeRemote();
    await saveRow(device1, 'decks', deckRow('d1', ORG), 1000);
    for (let i = 0; i < 1203; i++) {
      await saveRow(device1, 'notes', vocabularyNoteRow(`n${String(i).padStart(4, '0')}`, ORG, 'd1', `w${i}`), 1000);
    }
    await pushChanges(device1, remote);
    const result = await pullChanges(device2, remote);
    expect(result.error).toBeUndefined();
    const count = await device2.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM notes', []);
    expect(count?.n).toBe(1203);
  });
});
