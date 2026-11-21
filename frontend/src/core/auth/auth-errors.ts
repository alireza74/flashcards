// Uebersetzt Fehler von Supabase Auth in i18n-Schluessel (auth.errors.*).
// Die Codes wurden gegen das lokale Supabase geprueft (20.11.2026).

const knownCodes = [
  'invalid_credentials',
  'email_not_confirmed',
  'user_already_exists',
  'weak_password',
  'otp_expired',
  'same_password',
  'over_email_send_rate_limit',
  'over_request_rate_limit',
] as const;

export type AuthErrorCode = (typeof knownCodes)[number];

function isKnownCode(code: unknown): code is AuthErrorCode {
  return typeof code === 'string' && (knownCodes as readonly string[]).includes(code);
}

// Liefert den Fehlercode, falls es ein bekannter Auth-Fehler ist.
export function getAuthErrorCode(error: unknown): AuthErrorCode | undefined {
  if (error && typeof error === 'object' && 'code' in error && isKnownCode(error.code)) {
    return error.code;
  }
  return undefined;
}

// i18n-Schluessel fuer die Anzeige.
export function getAuthErrorKey(error: unknown): string {
  const code = getAuthErrorCode(error);
  if (code) {
    return `auth.errors.${code}`;
  }
  // Server nicht erreichbar (kein Netz, falsche URL)
  if (error && typeof error === 'object' && 'name' in error && error.name === 'AuthRetryableFetchError') {
    return 'auth.errors.network';
  }
  logUnknownAuthError(error);
  return 'auth.errors.unknown';
}

// Unbekannte Fehler fuer die Diagnose protokollieren (Browser-Konsole, Android: logcat).
// Bewusst nur technische Felder - keine Nachricht, die E-Mail oder andere Eingaben enthalten koennte.
// Taucht ein Code hier oefter auf: in knownCodes und den Sprachdateien ergaenzen.
export function logUnknownAuthError(error: unknown): void {
  const details =
    error && typeof error === 'object'
      ? {
          name: 'name' in error ? error.name : undefined,
          code: 'code' in error ? error.code : undefined,
          status: 'status' in error ? error.status : undefined,
        }
      : { type: typeof error };
  console.warn('[auth] unbekannter Fehler', details);
}
