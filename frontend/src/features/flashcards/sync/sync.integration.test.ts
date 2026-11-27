/**
 * @jest-environment node
 */
// Abgleich gegen das LOKALE Supabase (echte Migration, echtes RLS). Zwei "Geraete" desselben Nutzers
// plus ein fremder Nutzer. Laeuft nur, wenn die Umgebungsvariablen gesetzt sind - sonst uebersprungen
// (CI und normale Testlaeufe brauchen kein laufendes Supabase).
//
// Ausfuehren (in frontend/, Werte aus "npm run db:status" in backend/):
//   $env:FLASHCARDS_IT_URL = 'http://127.0.0.1:54321'
//   $env:FLASHCARDS_IT_PUBLISHABLE_KEY = '<PUBLISHABLE_KEY>'
//   $env:FLASHCARDS_IT_SECRET_KEY = '<SECRET_KEY>'
//   npx jest sync.integration

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createMigratedTestDb, type TestDb } from '../test-helpers/node-local-db';
import { cardRow, deckRow, reviewLogRow, vocabularyNoteRow } from '../test-helpers/rows';
import { markDeleted, saveRow } from './local-write';
import { createSupabaseRemote } from './remote';
import { runSync } from './run-sync';

const url = process.env.FLASHCARDS_IT_URL;
const publishableKey = process.env.FLASHCARDS_IT_PUBLISHABLE_KEY;
const secretKey = process.env.FLASHCARDS_IT_SECRET_KEY;
const enabled = Boolean(url && publishableKey && secretKey);

const PASSWORD = 'Test-Passwort-123';
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(url!, publishableKey!, clientOptions);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

(enabled ? describe : describe.skip)('Abgleich mit lokalem Supabase', () => {
  const admin = enabled ? createClient(url!, secretKey!, clientOptions) : (null as unknown as SupabaseClient);
  const suffix = Date.now();
  const emailA = `sync-a-${suffix}@example.test`;
  const emailB = `sync-b-${suffix}@example.test`;
  const userIds: string[] = [];
  let orgA = '';
  let device1: TestDb;
  let device2: TestDb;
  let clientA1: SupabaseClient;
  let clientA2: SupabaseClient;
  let clientB: SupabaseClient;

  beforeAll(async () => {
    for (const email of [emailA, emailB]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      userIds.push(data.user.id);
    }
    clientA1 = await signedInClient(emailA);
    clientA2 = await signedInClient(emailA);
    clientB = await signedInClient(emailB);
    const { data, error } = await clientA1.from('profiles').select('active_organization_id').eq('id', userIds[0]).single();
    if (error) throw error;
    orgA = data.active_organization_id as string;
    device1 = await createMigratedTestDb();
    device2 = await createMigratedTestDb();
  });

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  const ids = { deck: uuid(), note: uuid(), card: uuid(), review: uuid() };

  it('Geraet 1 sendet, Geraet 2 holt', async () => {
    const now = Date.now();
    await saveRow(device1, 'decks', deckRow(ids.deck, orgA, 'Englisch'), now);
    await saveRow(device1, 'notes', vocabularyNoteRow(ids.note, orgA, ids.deck, 'house'), now);
    await saveRow(device1, 'cards', cardRow(ids.card, orgA, ids.note, ids.deck), now);
    await saveRow(device1, 'review_logs', reviewLogRow(ids.review, orgA, ids.card), now);

    expect(await runSync(device1, createSupabaseRemote(clientA1))).toBe('done');
    expect(await runSync(device2, createSupabaseRemote(clientA2))).toBe('done');

    const note = await device2.getFirstAsync<{ fields: string; level: string }>(
      'SELECT fields, level FROM notes WHERE id = ?',
      [ids.note],
    );
    expect(JSON.parse(note!.fields)).toMatchObject({ word: 'house' });
    expect(note!.level).toBe('B1');
    const review = await device2.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM review_logs WHERE id = ?', [
      ids.review,
    ]);
    expect(review?.n).toBe(1);
  });

  it('Lernantwort zweimal senden schadet nicht', async () => {
    await saveRow(device1, 'review_logs', reviewLogRow(ids.review, orgA, ids.card), Date.now());
    expect(await runSync(device1, createSupabaseRemote(clientA1))).toBe('done');
  });

  it('Konflikt: die neuere Aenderung gewinnt auf beiden Geraeten', async () => {
    const base = Date.now();
    const note = vocabularyNoteRow(ids.note, orgA, ids.deck, 'house');
    await saveRow(device2, 'notes', { ...note, fields: JSON.stringify({ word: 'home' }) }, base + 2000);
    await saveRow(device1, 'notes', { ...note, fields: JSON.stringify({ word: 'flat' }) }, base + 1000);

    await runSync(device2, createSupabaseRemote(clientA2)); // neuere zuerst auf dem Server
    await runSync(device1, createSupabaseRemote(clientA1)); // aeltere wird verworfen, neuere geholt

    for (const db of [device1, device2]) {
      const row = await db.getFirstAsync<{ fields: string }>('SELECT fields FROM notes WHERE id = ?', [ids.note]);
      expect(JSON.parse(row!.fields)).toEqual({ word: 'home' });
    }
    const { data } = await clientA1.from('notes').select('fields').eq('id', ids.note).single();
    expect(data?.fields).toEqual({ word: 'home' });
  });

  it('Loeschen kommt auf dem anderen Geraet an', async () => {
    await markDeleted(device2, 'cards', ids.card, Date.now() + 5000);
    await runSync(device2, createSupabaseRemote(clientA2));
    await runSync(device1, createSupabaseRemote(clientA1));
    const card = await device1.getFirstAsync<{ deleted_at: number | null }>('SELECT deleted_at FROM cards WHERE id = ?', [
      ids.card,
    ]);
    expect(card?.deleted_at).not.toBeNull();
  });

  it('fremder Nutzer: Zeile in fremder Organisation wird abgelehnt, nicht endlos wiederholt', async () => {
    const deviceB = await createMigratedTestDb();
    await saveRow(deviceB, 'decks', deckRow(uuid(), orgA, 'Einbruch'), Date.now());
    expect(await runSync(deviceB, createSupabaseRemote(clientB))).toBe('error');
    const failed = await deviceB.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM sync_outbox WHERE failed = 1', []);
    expect(failed?.n).toBe(1);
    // B holt nichts von A
    const notes = await deviceB.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM notes', []);
    expect(notes?.n).toBe(0);
  });
});
