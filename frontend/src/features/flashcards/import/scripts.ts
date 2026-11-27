// Schrift eines Textes erkennen (lateinisch, arabisch-persisch, kyrillisch ...).
// Gebraucht beim Import: Manche Anki-Decks mischen die Richtung - mal steht Persisch vorne, mal Deutsch.
// Haben die beiden ersten Felder verschiedene Schriften, lassen sich vertauschte Notizen sicher erkennen.
// Notizen mit gleicher Schrift auf beiden Seiten (z. B. Deutsch - Deutsch) bleiben unveraendert.

export type Script = 'latin' | 'arabic' | 'cyrillic' | 'greek' | 'hebrew' | 'cjk';

const SCRIPT_PATTERNS: [Script, RegExp][] = [
  ['latin', /\p{Script=Latin}/u],
  ['arabic', /\p{Script=Arabic}/u],
  ['cyrillic', /\p{Script=Cyrillic}/u],
  ['greek', /\p{Script=Greek}/u],
  ['hebrew', /\p{Script=Hebrew}/u],
  ['cjk', /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u],
];

/** Ueberwiegende Schrift der Buchstaben; null = keine Buchstaben. */
export function scriptOf(text: string): Script | null {
  const counts = new Map<Script, number>();
  for (const char of text) {
    const match = SCRIPT_PATTERNS.find(([, pattern]) => pattern.test(char));
    if (match) counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  let best: Script | null = null;
  let bestCount = 0;
  for (const [script, count] of counts) {
    if (count > bestCount) {
      best = script;
      bestCount = count;
    }
  }
  return best;
}

const LANGUAGE_SCRIPTS: Record<string, Script> = {
  de: 'latin',
  en: 'latin',
  fr: 'latin',
  es: 'latin',
  it: 'latin',
  tr: 'latin',
  fa: 'arabic',
  ar: 'arabic',
};

export function scriptOfLanguage(lang: string | null): Script | null {
  return lang ? (LANGUAGE_SCRIPTS[lang.split('-')[0]] ?? null) : null;
}

/**
 * Welche Schrift gehoert ins ERSTE Feld?
 * - Sprache des Zieldecks, wenn sie eine erkennbare Schrift hat und in den Notizen vorkommt;
 * - sonst die Schrift, die bei Notizen mit zwei verschiedenen Schriften am haeufigsten vorne steht.
 * null = nicht entscheidbar (z. B. alles lateinisch) -> nichts tauschen.
 */
export function firstFieldScript(pairs: [string, string][], lang: string | null): Script | null {
  const fronts = new Map<Script, number>();
  const seen = new Set<Script>();
  for (const [first, second] of pairs) {
    const a = scriptOf(first);
    const b = scriptOf(second);
    if (a) seen.add(a);
    if (b) seen.add(b);
    if (a && b && a !== b) fronts.set(a, (fronts.get(a) ?? 0) + 1);
  }
  if (fronts.size === 0) return null;
  const fromLang = scriptOfLanguage(lang);
  if (fromLang && seen.has(fromLang)) return fromLang;
  return [...fronts.entries()].sort((x, y) => y[1] - x[1])[0][0];
}

/** Ist diese Notiz vertauscht? Nur wenn vorne die falsche UND hinten die richtige Schrift steht. */
export function isSwapped(first: string, second: string, target: Script | null): boolean {
  if (!target) return false;
  const a = scriptOf(first);
  const b = scriptOf(second);
  return a !== null && a !== target && b === target;
}
