// Merkt sich die letzten Schritte des Nutzers (nur im Arbeitsspeicher).
// Wird nur bei einem Fehlerbericht mitgeschickt - und nur mit Einwilligung.

import { sanitizeText } from './sanitize';

export type BreadcrumbCategory = 'navigation' | 'ui' | 'http' | 'auth' | 'app';

export type Breadcrumb = {
  at: string; // ISO-Zeitpunkt
  category: BreadcrumbCategory;
  message: string;
};

export const MAX_BREADCRUMBS = 50;

let buffer: Breadcrumb[] = [];

export function addBreadcrumb(category: BreadcrumbCategory, message: string, now: Date = new Date()): void {
  buffer.push({ at: now.toISOString(), category, message: sanitizeText(message, 200) });
  if (buffer.length > MAX_BREADCRUMBS) {
    buffer = buffer.slice(buffer.length - MAX_BREADCRUMBS);
  }
}

export function getBreadcrumbs(): Breadcrumb[] {
  return [...buffer];
}

export function clearBreadcrumbs(): void {
  buffer = [];
}
