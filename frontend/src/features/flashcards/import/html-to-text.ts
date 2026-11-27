// Anki speichert Feldinhalte als HTML. Unsere Karten sind (noch) reiner Text.
// <br>, <div>, <p>, <li> -> Zeilenumbruch; andere Tags weg; Sonderzeichen (&nbsp; &amp; &#233; ...) umwandeln.
// Medien ([sound:...], <img>) fallen weg und werden gemeldet (Bilder und Ton kommen in Stufe 2).

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  shy: '',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  laquo: '«',
  raquo: '»',
  bdquo: '„',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

const BLOCK = '\u0001';

export type ConvertedField = { text: string; hadMedia: boolean };

export function htmlToText(html: string): ConvertedField {
  const hadMedia = /\[sound:[^\]]*\]|<img\b|<audio\b|<video\b/i.test(html);
  const text = decodeEntities(
    html
      .replace(/\[sound:[^\]]*\]/gi, '')
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      // Blockgrenzen erst markieren: "</div><div>" ist EIN Zeilenwechsel, "<br><br>" bleibt eine Leerzeile
      .replace(/<\/?(div|p|li|tr|h[1-6])\b[^>]*>/gi, BLOCK)
      .replace(/<[^>]*>/g, '')
      .replace(new RegExp(`${BLOCK}(\\s*${BLOCK})*`, 'g'), '\n'),
  )
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text, hadMedia };
}
