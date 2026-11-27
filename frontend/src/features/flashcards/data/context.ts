// Alles, was die Datenfunktionen zum Schreiben brauchen. Als Objekt uebergeben, damit Tests eigene
// Werte einsetzen koennen (feste Zeit, eigene IDs, node:sqlite).

import type { LocalDb } from '../db/local-db-types';

export type DataContext = {
  db: LocalDb;
  organizationId: string;
  newId: () => string;
  now: () => number;
};
