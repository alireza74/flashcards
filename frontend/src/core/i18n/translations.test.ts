import { de } from './de';
import { en } from './en';

// Sammelt alle Schluessel eines verschachtelten Objekts, z. B. "auth.signIn.title".
function keysOf(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? keysOf(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('Uebersetzungen', () => {
  it('Deutsch und Englisch haben dieselben Schluessel', () => {
    expect(keysOf(en).sort()).toEqual(keysOf(de).sort());
  });

  it('kein Text ist leer', () => {
    const empty = (obj: object): string[] =>
      keysOf(obj).filter((path) => {
        const text = path.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], obj);
        return typeof text !== 'string' || text.trim() === '';
      });
    expect(empty(de)).toEqual([]);
    expect(empty(en)).toEqual([]);
  });
});
