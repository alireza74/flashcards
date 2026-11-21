// Baut aus einem Fehler den Bericht fuer die Tabelle error_reports.
// Reine Funktion: alle Geraete- und App-Angaben kommen von aussen (testbar).

import type { Breadcrumb } from './breadcrumbs';
import { sanitizeText } from './sanitize';

export type ErrorLevel = 'warning' | 'error' | 'fatal';

export type AppMeta = {
  appVersion: string | null;
  updateId: string | null;
  channel: string | null;
  platform: string;
  osVersion: string | null;
  deviceModel: string | null;
};

export type ErrorReport = {
  short_id: string;
  level: ErrorLevel;
  message: string;
  stack: string | null;
  breadcrumbs: Breadcrumb[];
  context: Record<string, string | number | boolean | null>;
  organization_id: string | null;
  app_version: string | null;
  update_id: string | null;
  channel: string | null;
  platform: string;
  os_version: string | null;
  device_model: string | null;
  occurred_at: string;
};

function messageOf(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const { name, code, status } = error as { name?: unknown; code?: unknown; status?: unknown };
    return [name, code, status].filter((part) => part !== undefined).join(' ') || 'Unbekannter Fehler';
  }
  return 'Unbekannter Fehler';
}

export function buildReport(input: {
  error: unknown;
  shortId: string;
  level: ErrorLevel;
  breadcrumbs: Breadcrumb[];
  meta: AppMeta;
  organizationId: string | null;
  context?: Record<string, string | number | boolean | null>;
  now?: Date;
}): ErrorReport {
  const stack = input.error instanceof Error && input.error.stack ? sanitizeText(input.error.stack, 20000) : null;

  // Kontextwerte ebenfalls filtern (Texte koennten Eingaben enthalten)
  const context: ErrorReport['context'] = {};
  for (const [key, value] of Object.entries(input.context ?? {})) {
    context[key] = typeof value === 'string' ? sanitizeText(value, 200) : value;
  }

  return {
    short_id: input.shortId,
    level: input.level,
    message: sanitizeText(messageOf(input.error), 2000) || 'Unbekannter Fehler',
    stack,
    breadcrumbs: input.breadcrumbs,
    context,
    organization_id: input.organizationId,
    app_version: input.meta.appVersion,
    update_id: input.meta.updateId,
    channel: input.meta.channel,
    platform: input.meta.platform,
    os_version: input.meta.osVersion,
    device_model: input.meta.deviceModel,
    occurred_at: (input.now ?? new Date()).toISOString(),
  };
}
