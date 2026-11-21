import {
  addBreadcrumb,
  addLogEntry,
  clearBreadcrumbs,
  getBreadcrumbs,
  MAX_BREADCRUMBS,
  subscribeLog,
} from './breadcrumbs';
import { createErrorId } from './error-id';
import { describeError, formatLog, MAX_LOG_ENTRIES, trimEntries, type LogEntry } from './log-format';
import { sanitizeText, sanitizeUrl } from './sanitize';

describe('sanitizeText', () => {
  it('entfernt E-Mail-Adressen', () => {
    expect(sanitizeText('Fehler fuer alice@example.test beim Speichern')).toBe('Fehler fuer [email] beim Speichern');
  });

  it('entfernt Tokens und Schluessel', () => {
    expect(sanitizeText('auth eyJhbGciOi.eyJzdWIiOi.abcDEF_123')).toBe('auth [token]');
    expect(sanitizeText('key sb_publishable_7dLUojr_abc')).toBe('key [key]');
    expect(sanitizeText('Authorization: Bearer abc.def')).toBe('Authorization: Bearer [token]');
  });

  it('entfernt Codes und lange Zahlen', () => {
    expect(sanitizeText('Code 123456 ungueltig')).toBe('Code [number] ungueltig');
    expect(sanitizeText('Fehler 404')).toBe('Fehler 404');
  });

  it('entfernt Werte aus URL-Parametern', () => {
    expect(sanitizeText('/profiles?id=eq.abc&name=Ali')).toBe('/profiles?id=[value]&name=[value]');
  });

  it('kuerzt lange Texte', () => {
    expect(sanitizeText('x'.repeat(50), 10)).toBe('xxxxxxx...');
  });
});

describe('sanitizeUrl', () => {
  it('liefert nur den Pfad', () => {
    expect(sanitizeUrl('https://abc.supabase.co/rest/v1/profiles?id=eq.123')).toBe('/rest/v1/profiles');
  });
});

describe('Sitzungsprotokoll', () => {
  beforeEach(() => clearBreadcrumbs());

  it('merkt sich Schritte gefiltert und mit Zeit', () => {
    addBreadcrumb('ui', 'Knopf Speichern', new Date('2026-11-21T10:00:00Z'));
    addBreadcrumb('auth', 'Login alice@example.test');
    const entries = getBreadcrumbs();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      at: '2026-11-21T10:00:00.000Z',
      level: 'info',
      category: 'ui',
      message: 'Knopf Speichern',
    });
    expect(entries[1]?.message).toBe('Login [email]');
  });

  it('behaelt nur die letzten Eintraege', () => {
    for (let i = 0; i < MAX_BREADCRUMBS + 10; i++) addBreadcrumb('navigation', `/seite-${i}`);
    const entries = getBreadcrumbs();
    expect(entries).toHaveLength(MAX_BREADCRUMBS);
    expect(entries[0]?.message).toBe('/seite-10');
  });

  it('meldet neue Eintraege an Abonnenten (fuer die Datei)', () => {
    const seen: LogEntry[] = [];
    const unsubscribe = subscribeLog((entry) => seen.push(entry));
    addLogEntry('error', 'error', 'kaputt', { errorId: '2345-6789' });
    unsubscribe();
    addBreadcrumb('ui', 'danach');
    expect(seen).toHaveLength(1);
    expect(seen[0]?.errorId).toBe('2345-6789');
  });
});

describe('createErrorId', () => {
  it('Format XXXX-XXXX ohne verwechselbare Zeichen', () => {
    expect(createErrorId(() => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toBe('2345-6789');
    expect(createErrorId((n) => new Uint8Array(n).fill(255))).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
  });
});

describe('trimEntries (Grenzen der Datei)', () => {
  const now = new Date('2026-11-21T12:00:00Z');
  const entry = (at: string, message = 'x'): LogEntry => ({ at, level: 'info', category: 'ui', message });

  it('entfernt Eintraege aelter als 7 Tage', () => {
    const result = trimEntries([entry('2026-11-13T12:00:00Z', 'alt'), entry('2026-11-20T12:00:00Z', 'neu')], now);
    expect(result.map((e) => e.message)).toEqual(['neu']);
  });

  it('behaelt hoechstens 1000 Eintraege', () => {
    const many = Array.from({ length: MAX_LOG_ENTRIES + 5 }, (_, i) => entry('2026-11-21T11:00:00Z', `e${i}`));
    const result = trimEntries(many, now);
    expect(result).toHaveLength(MAX_LOG_ENTRIES);
    expect(result[0]?.message).toBe('e5');
  });
});

describe('describeError', () => {
  it('Fehlerart, Meldung, gefiltert', () => {
    expect(describeError(new TypeError('kaputt bei bob@example.test'))).toMatch(/^TypeError: kaputt bei \[email\]/);
  });

  it('Supabase-Fehlerobjekt', () => {
    expect(describeError({ name: 'AuthApiError', code: 'neuer_code', status: 500 })).toBe('AuthApiError neuer_code 500');
  });
});

describe('formatLog', () => {
  it('Kopf mit App-Angaben und eine Zeile je Eintrag', () => {
    const text = formatLog(
      [
        { at: '2026-11-21T10:00:00.000Z', level: 'info', category: 'navigation', message: '/profile' },
        { at: '2026-11-21T10:00:05.000Z', level: 'error', category: 'error', message: 'TypeError: x', errorId: 'NDXE-6B5D' },
      ],
      { appVersion: '0.1.0', updateId: 'u1', channel: 'preview', platform: 'android', osVersion: '15', deviceModel: 'Pixel' },
      new Date('2026-11-21T10:01:00Z'),
    );
    expect(text).toContain('App-Version:  0.1.0');
    expect(text).toContain('Geraet:       Pixel');
    expect(text).toContain('2026-11-21 10:00:00 INFO  navigation: /profile');
    expect(text).toContain('2026-11-21 10:00:05 ERROR error: TypeError: x [Fehler-ID NDXE-6B5D]');
  });
});
