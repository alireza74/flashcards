// Sammelstelle fuer Fehler. Jede Stelle der App (auch Features) meldet Fehler hierueber:
//
//   import { reportError } from '@/core/monitoring/error-sink';
//   reportError(error, { context: { source: 'cards: speichern' } });
//
// Wohin die Meldung geht, bestimmt monitoring.ts (registriert sich beim Start).
// Diese Datei hat bewusst keine Abhaengigkeiten - dadurch ueberall importierbar und testbar.

import type { ErrorLevel } from './report';

export type CaptureOptions = {
  level?: ErrorLevel;
  // kurze technische Angaben, z. B. { source: 'query profile' } - keine Eingaben des Nutzers
  context?: Record<string, string | number | boolean | null>;
};

type Sink = (error: unknown, options?: CaptureOptions) => string | null;

let sink: Sink | null = null;

export function setErrorSink(next: Sink | null): void {
  sink = next;
}

// Liefert die Fehler-ID, wenn ein Bericht erstellt wird (nur mit Einwilligung), sonst null.
export function reportError(error: unknown, options?: CaptureOptions): string | null {
  try {
    return sink ? sink(error, options) : null;
  } catch {
    // Die Fehlererfassung darf selbst nie einen Fehler ausloesen.
    return null;
  }
}
