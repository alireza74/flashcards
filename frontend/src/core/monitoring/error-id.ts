// Kurze Fehler-ID zum Vorlesen am Telefon, z. B. "7KQ2-M9XA".
// Ohne leicht verwechselbare Zeichen (0/O, 1/I/L, U).

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

// randomBytes ist austauschbar, damit der Test feste Werte nutzen kann.
export function createErrorId(randomBytes: (count: number) => Uint8Array): string {
  const bytes = randomBytes(8);
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
    if (i === 3) id += '-';
  }
  return id;
}
