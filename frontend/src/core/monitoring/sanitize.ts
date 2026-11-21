// Entfernt persoenliche oder geheime Werte aus Texten, BEVOR etwas das Geraet verlaesst.
// Lieber zu viel filtern als zu wenig: Fehlermeldungen enthalten manchmal Eingaben.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// JSON Web Tokens (Anmelde-Tokens) und Supabase-Schluessel
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const SUPABASE_KEY = /sb_(publishable|secret)_[A-Za-z0-9_-]+/g;
const BEARER = /Bearer\s+[A-Za-z0-9._-]+/gi;
// 6 und mehr Ziffern am Stueck: Bestaetigungscodes, Telefonnummern
const LONG_NUMBER = /\b\d{6,}\b/g;
// Werte in URL-Parametern (?email=...&token=...)
const QUERY_VALUES = /([?&][^=&\s]+=)[^&\s]*/g;

export function sanitizeText(text: string, maxLength = 2000): string {
  const cleaned = text
    .replace(JWT, '[token]')
    .replace(SUPABASE_KEY, '[key]')
    .replace(BEARER, 'Bearer [token]')
    .replace(EMAIL, '[email]')
    .replace(QUERY_VALUES, '$1[value]')
    .replace(LONG_NUMBER, '[number]');
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3)}...` : cleaned;
}

// URL fuer Protokolle: nur Pfad, ohne Host-Parameter und ohne Abfragewerte.
// "https://x.supabase.co/rest/v1/profiles?id=eq.123" -> "/rest/v1/profiles"
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return sanitizeText(parsed.pathname, 200);
  } catch {
    return sanitizeText(url.split('?')[0] ?? '', 200);
  }
}
