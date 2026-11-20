import { deletionDate, isLastOwnerError } from './privacy-helpers';

describe('deletionDate', () => {
  it('liegt 30 Tage nach dem Antrag', () => {
    expect(deletionDate('2026-11-20T10:00:00Z')?.toISOString()).toBe('2026-12-20T10:00:00.000Z');
  });

  it('ohne Antrag kein Datum', () => {
    expect(deletionDate(null)).toBeUndefined();
    expect(deletionDate(undefined)).toBeUndefined();
  });
});

describe('isLastOwnerError', () => {
  it('erkennt den Hinweis aus der Datenbank', () => {
    expect(isLastOwnerError({ code: 'P0001', hint: 'last_owner', message: 'x' })).toBe(true);
  });

  it('andere Fehler nicht', () => {
    expect(isLastOwnerError({ code: 'P0001', hint: null })).toBe(false);
    expect(isLastOwnerError(new Error('x'))).toBe(false);
    expect(isLastOwnerError(undefined)).toBe(false);
  });
});
