// Fehlererfassung einrichten (einmal beim App-Start):
// - Sammelstelle reportError -> Fehler mit Fehler-ID ins Protokoll eintragen
// - unbehandelte JavaScript-Fehler abfangen (Handy: ErrorUtils, Web: window)
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { addLogEntry } from './breadcrumbs';
import { createErrorId } from './error-id';
import { setErrorSink, type CaptureOptions } from './error-sink';
import { describeError } from './log-format';

let installed = false;

function captureError(error: unknown, options?: CaptureOptions): string {
  const errorId = createErrorId(Crypto.getRandomBytes);
  const source = options?.context?.source;
  const message = `${source ? `[${String(source)}] ` : ''}${describeError(error)}`;
  addLogEntry(options?.level === 'warning' ? 'warn' : 'error', 'error', message, { errorId });
  return errorId;
}

export function installDiagnostics(): void {
  if (installed) return;
  installed = true;
  setErrorSink(captureError);

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => captureError(event.error ?? event.message));
      window.addEventListener('unhandledrejection', (event) =>
        captureError(event.reason, { context: { source: 'unhandled promise' } }),
      );
    }
    return;
  }

  const errorUtils = (
    globalThis as {
      ErrorUtils?: {
        getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
        setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
      };
    }
  ).ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      captureError(error, { level: isFatal ? 'fatal' : 'error' });
      previous(error, isFatal);
    });
  }
}
