import { getAuthErrorCode, getAuthErrorKey } from './auth-errors';

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
