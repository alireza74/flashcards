// Zustand des Abgleichs fuer die Oberflaeche (z. B. "3 Aenderungen nicht gesendet", "zuletzt 10:42").
// Kleiner eigener Speicher mit useSyncExternalStore - keine zusaetzliche Bibliothek noetig.

import { useSyncExternalStore } from 'react';

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

export type SyncStatus = {
  phase: SyncPhase;
  lastSyncedAt: number | null;
  pendingCount: number;
  failedCount: number;
  lastError: string | null;
};

let status: SyncStatus = { phase: 'idle', lastSyncedAt: null, pendingCount: 0, failedCount: 0, lastError: null };
const listeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function setSyncStatus(changes: Partial<SyncStatus>): void {
  status = { ...status, ...changes };
  for (const listener of listeners) listener();
}

export function resetSyncStatus(): void {
  setSyncStatus({ phase: 'idle', lastSyncedAt: null, pendingCount: 0, failedCount: 0, lastError: null });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSyncStatus, getSyncStatus);
}
