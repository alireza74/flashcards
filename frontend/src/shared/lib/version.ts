// Vergleich von App-Versionen der Form "1.2.3".
// Wird in M5 fuer den Mindestversion-Schalter gebraucht
// (app_settings.min_app_version): ist die installierte Version zu alt,
// fordert die App zum Update auf.

function parseVersion(version: string): number[] {
  return version
    .trim()
    .split('.')
    .map((part) => {
      const value = Number.parseInt(part, 10);
      return Number.isNaN(value) ? 0 : value;
    });
}

// true, wenn current gleich oder neuer als minimum ist
export function isVersionAtLeast(current: string, minimum: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(minimum);
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i++) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) {
      return left > right;
    }
  }
  return true;
}
