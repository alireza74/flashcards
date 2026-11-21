import { addBreadcrumb, clearBreadcrumbs, getBreadcrumbs, MAX_BREADCRUMBS } from './breadcrumbs';
import { createErrorId } from './error-id';
import { buildReport } from './report';
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

describe('Breadcrumbs', () => {
  beforeEach(() => clearBreadcrumbs());

  it('merkt sich Schritte gefiltert und mit Zeit', () => {
    addBreadcrumb('ui', 'Knopf Speichern', new Date('2026-11-21T10:00:00Z'));
    addBreadcrumb('auth', 'Login alice@example.test');
    const crumbs = getBreadcrumbs();
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0]).toEqual({ at: '2026-11-21T10:00:00.000Z', category: 'ui', message: 'Knopf Speichern' });
    expect(crumbs[1]?.message).toBe('Login [email]');
  });

  it('behaelt nur die letzten Schritte', () => {
    for (let i = 0; i < MAX_BREADCRUMBS + 10; i++) addBreadcrumb('navigation', `/seite-${i}`);
    const crumbs = getBreadcrumbs();
    expect(crumbs).toHaveLength(MAX_BREADCRUMBS);
    expect(crumbs[0]?.message).toBe('/seite-10');
  });
});

describe('createErrorId', () => {
  it('Format XXXX-XXXX ohne verwechselbare Zeichen', () => {
    const id = createErrorId(() => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(id).toBe('2345-6789');
    expect(createErrorId((n) => new Uint8Array(n).fill(255))).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
  });
});

describe('buildReport', () => {
  const meta = {
    appVersion: '0.1.0',
    updateId: 'u1',
    channel: 'preview',
    platform: 'android',
    osVersion: '15',
    deviceModel: 'Pixel',
  };

  it('baut einen gefilterten Bericht', () => {
    const report = buildReport({
      error: new TypeError('kaputt bei bob@example.test'),
      shortId: '2345-6789',
      level: 'error',
      breadcrumbs: [],
      meta,
      organizationId: null,
      context: { source: 'query profile', email: 'carol@example.test' },
      now: new Date('2026-11-21T10:00:00Z'),
    });
    expect(report.message).toBe('TypeError: kaputt bei [email]');
    expect(report.context).toEqual({ source: 'query profile', email: '[email]' });
    expect(report.app_version).toBe('0.1.0');
    expect(report.occurred_at).toBe('2026-11-21T10:00:00.000Z');
    expect(JSON.stringify(report)).not.toContain('@example.test');
  });

  it('kommt mit Nicht-Error-Objekten zurecht', () => {
    const report = buildReport({
      error: { name: 'AuthApiError', code: 'neuer_code', status: 500 },
      shortId: '2345-6789',
      level: 'warning',
      breadcrumbs: [],
      meta,
      organizationId: null,
    });
    expect(report.message).toBe('AuthApiError neuer_code 500');
    expect(report.stack).toBeNull();
  });
});
