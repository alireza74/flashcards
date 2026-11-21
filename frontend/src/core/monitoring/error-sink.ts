// Sammelstelle fuer Fehler. Jede Stelle der App (auch Features) meldet Fehler hierueber:
//
//   import { reportError } from '@/core/monitoring/error-sink';
//   reportError(error, { context: { source: 'cards: speichern' } });
//
// Wohin die Meldung geht, bestimmt diagnostics.ts (registriert sich beim Start):
// Eintrag mit Fehler-ID ins Fehlerprotokoll.
// Diese Datei hat bewusst keine Abhaengigkeiten - dadurch ueberall importierbar und testbar.

export type ErrorLevel = 'warning' | 'error' | 'fatal';

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

// Liefert die Fehler-ID des Protokolleintrags (null nur, wenn die Erfassung nicht eingerichtet ist).
export function reportError(error: unknown, options?: CaptureOptions): string | null {
  try {
    return sink ? sink(error, options) : null;
  } catch {
    // Die Fehlererfassung darf selbst nie einen Fehler ausloesen.
    return null;
  }
}
