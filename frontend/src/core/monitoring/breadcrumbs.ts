// Protokoll der aktuellen Sitzung im Arbeitsspeicher: Schritte (Seiten, Knoepfe, Anfragen)
// und Fehler. Gefiltert beim Eintragen. Ob die Eintraege zusaetzlich in eine Datei auf dem
// Geraet geschrieben werden, entscheidet log-file.ts (nur mit Einwilligung).

import type { LogCategory, LogEntry, LogLevel } from './log-format';
import { sanitizeText } from './sanitize';

export const MAX_BREADCRUMBS = 200;

type Listener = (entry: LogEntry) => void;

let buffer: LogEntry[] = [];
const listeners = new Set<Listener>();

export function addLogEntry(
  level: LogLevel,
  category: LogCategory,
  message: string,
  options?: { errorId?: string; now?: Date },
): LogEntry {
  const entry: LogEntry = {
    at: (options?.now ?? new Date()).toISOString(),
    level,
    category,
    message: sanitizeText(message, 1500),
    ...(options?.errorId ? { errorId: options.errorId } : {}),
  };
  buffer.push(entry);
  if (buffer.length > MAX_BREADCRUMBS) {
    buffer = buffer.slice(buffer.length - MAX_BREADCRUMBS);
  }
  listeners.forEach((listener) => listener(entry));
  return entry;
}

// Kurzform fuer einen normalen Schritt
export function addBreadcrumb(category: LogCategory, message: string, now?: Date): void {
  addLogEntry('info', category, sanitizeText(message, 200), { now });
}

export function getBreadcrumbs(): LogEntry[] {
  return [...buffer];
}

export function clearBreadcrumbs(): void {
  buffer = [];
}

// Benachrichtigung bei jedem neuen Eintrag (fuer die Datei)
export function subscribeLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
