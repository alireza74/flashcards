// Reine Hilfsfunktionen ohne Supabase-Zugriff (dadurch einfach testbar).

export const DELETION_GRACE_DAYS = 30;

// Datum der endgueltigen Loeschung (Antrag + Karenzzeit, wie in Migration 0006)
export function deletionDate(requestedAt: string | null | undefined): Date | undefined {
  if (!requestedAt) return undefined;
  const date = new Date(requestedAt);
  date.setDate(date.getDate() + DELETION_GRACE_DAYS);
  return date;
}

// true, wenn der Fehler "letzter Eigentuemer eines Teams" ist (hint aus der Datenbank).
export function isLastOwnerError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'hint' in error && error.hint === 'last_owner';
}
