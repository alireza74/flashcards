import { isVersionAtLeast } from './version';

describe('isVersionAtLeast', () => {
  it('gleiche Version ist ausreichend', () => {
    expect(isVersionAtLeast('1.2.3', '1.2.3')).toBe(true);
  });

  it('neuere Version ist ausreichend', () => {
    expect(isVersionAtLeast('1.3.0', '1.2.9')).toBe(true);
    expect(isVersionAtLeast('2.0.0', '1.99.99')).toBe(true);
  });

  it('aeltere Version ist nicht ausreichend', () => {
    expect(isVersionAtLeast('1.2.3', '1.2.4')).toBe(false);
    expect(isVersionAtLeast('0.9.0', '1.0.0')).toBe(false);
  });

  it('vergleicht numerisch, nicht als Text', () => {
    expect(isVersionAtLeast('1.10.0', '1.9.0')).toBe(true);
  });

  it('fehlende Stellen zaehlen als 0', () => {
    expect(isVersionAtLeast('1.2', '1.2.0')).toBe(true);
    expect(isVersionAtLeast('1.2', '1.2.1')).toBe(false);
  });
});
