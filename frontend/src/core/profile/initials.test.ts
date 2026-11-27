import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('nimmt Vor- und Nachname', () => {
    expect(initialsOf('Max Peter Muster', 'x@y.de')).toBe('MM');
  });

  it('ein Wort: die ersten zwei Buchstaben', () => {
    expect(initialsOf('elektro', null)).toBe('EL');
  });

  it('ohne Namen: aus der E-Mail-Adresse', () => {
    expect(initialsOf('  ', 'anna.schmidt@betrieb.de')).toBe('AN');
  });

  it('ohne alles: Fragezeichen', () => {
    expect(initialsOf(null, undefined)).toBe('?');
  });
});
