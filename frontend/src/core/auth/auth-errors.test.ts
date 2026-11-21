import { getAuthErrorCode, getAuthErrorKey } from './auth-errors';

// Protokollausgaben in den Tests abfangen (und pruefen, wo noetig)
let warnSpy: jest.SpyInstance;
beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => warnSpy.mockRestore());

describe('Protokoll bei unbekannten Fehlern', () => {
  it('protokolliert Code und Status, aber nie die Nachricht', () => {
    getAuthErrorKey({
      name: 'AuthApiError',
      code: 'neuer_code',
      status: 429,
      message: 'Fehler fuer alice@example.test',
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warnSpy.mock.calls[0]);
    expect(logged).toContain('neuer_code');
    expect(logged).toContain('429');
    expect(logged).not.toContain('alice@example.test');
  });

  it('bekannte Fehler werden nicht protokolliert', () => {
    getAuthErrorKey({ code: 'invalid_credentials' });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('getAuthErrorKey', () => {
  it('bekannter Code wird zum i18n-Schluessel', () => {
    expect(getAuthErrorKey({ code: 'invalid_credentials', message: 'x' })).toBe(
      'auth.errors.invalid_credentials',
    );
    expect(getAuthErrorKey({ code: 'otp_expired' })).toBe('auth.errors.otp_expired');
  });

  it('Netzwerkfehler wird erkannt', () => {
    expect(getAuthErrorKey({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })).toBe(
      'auth.errors.network',
    );
  });

  it('alles andere ist unbekannt', () => {
    expect(getAuthErrorKey({ code: 'something_new' })).toBe('auth.errors.unknown');
    expect(getAuthErrorKey(new Error('kaputt'))).toBe('auth.errors.unknown');
    expect(getAuthErrorKey(undefined)).toBe('auth.errors.unknown');
  });
});

describe('getAuthErrorCode', () => {
  it('liefert nur bekannte Codes', () => {
    expect(getAuthErrorCode({ code: 'email_not_confirmed' })).toBe('email_not_confirmed');
    expect(getAuthErrorCode({ code: 'unbekannt' })).toBeUndefined();
  });
});
