// Format und Grenzen des Fehlerprotokolls. Reine Funktionen (ohne Geraetezugriff) - testbar.

import { sanitizeText } from './sanitize';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogCategory = 'navigation' | 'ui' | 'http' | 'auth' | 'app' | 'error';

export type LogEntry = {
  at: string; // ISO-Zeitpunkt
  level: LogLevel;
  category: LogCategory;
  message: string;
  errorId?: string;
};

export type AppMeta = {
  appVersion: string | null;
  updateId: string | null;
  channel: string | null;
  platform: string;
  osVersion: string | null;
  deviceModel: string | null;
};

// Grenzen der Datei auf dem Geraet: hoechstens 1000 Eintraege und 7 Tage
export const MAX_LOG_ENTRIES = 1000;
export const MAX_LOG_AGE_DAYS = 7;

export function trimEntries(entries: LogEntry[], now: Date = new Date()): LogEntry[] {
  const oldest = now.getTime() - MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
  const recent = entries.filter((entry) => new Date(entry.at).getTime() >= oldest);
  return recent.slice(-MAX_LOG_ENTRIES);
}

// Lesbare Kurzbeschreibung eines Fehlers (gefiltert)
export function describeError(error: unknown): string {
  let text: string;
  if (error instanceof Error) {
    // Fehlerart, Meldung und die ersten Zeilen der Code-Stelle
    const stack = (error.stack ?? '').split('\n').slice(1, 6).join('\n');
    text = `${error.name}: ${error.message}${stack ? `\n${stack}` : ''}`;
  } else if (typeof error === 'string') {
    text = error;
  } else if (error && typeof error === 'object') {
    const { name, code, status } = error as { name?: unknown; code?: unknown; status?: unknown };
    text = [name, code, status].filter((part) => part !== undefined).join(' ') || 'Unbekannter Fehler';
  } else {
    text = 'Unbekannter Fehler';
  }
  return sanitizeText(text, 1500);
}

function formatTime(iso: string): string {
  return iso.replace('T', ' ').slice(0, 19);
}

// Textdatei zum Teilen: Kopf mit App- und Geraeteangaben, danach ein Eintrag pro Zeile.
export function formatLog(entries: LogEntry[], meta: AppMeta, now: Date = new Date()): string {
  const header = [
    'Fehlerprotokoll',
    `Erstellt:     ${formatTime(now.toISOString())} UTC`,
    `App-Version:  ${meta.appVersion ?? '-'}`,
    `Update:       ${meta.updateId ?? '-'} (Kanal ${meta.channel ?? '-'})`,
    `Plattform:    ${meta.platform} ${meta.osVersion ?? ''}`.trimEnd(),
    `Geraet:       ${meta.deviceModel ?? '-'}`,
    `Eintraege:    ${entries.length}`,
    '',
  ];
  const lines = entries.map((entry) => {
    const id = entry.errorId ? ` [Fehler-ID ${entry.errorId}]` : '';
    return `${formatTime(entry.at)} ${entry.level.toUpperCase().padEnd(5)} ${entry.category}: ${entry.message}${id}`;
  });
  return [...header, ...lines, ''].join('\n');
}
