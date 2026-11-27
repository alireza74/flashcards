// Kartenvorlage ausfuellen: {{word}} -> Inhalt des Feldes "word". Leere Felder hinterlassen keine Leerzeilen.

export function renderTemplate(template: string, fields: Record<string, string>): string {
  return template
    .replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g, (_match, key: string) => (fields[key] ?? '').trim())
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Abstand bis zum naechsten Termin als kurze Beschriftung: Einheit + Zahl (Text kommt aus den Uebersetzungen). */
export type IntervalLabel = { unit: 'minutes' | 'hours' | 'days' | 'months' | 'years'; count: number };

export function intervalLabel(ms: number): IntervalLabel {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return { unit: 'minutes', count: minutes };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { unit: 'hours', count: hours };
  const days = Math.round(hours / 24);
  if (days < 31) return { unit: 'days', count: days };
  const months = Math.round(days / 30.4);
  if (months < 12) return { unit: 'months', count: months };
  return { unit: 'years', count: Math.round((days / 365) * 10) / 10 };
}
