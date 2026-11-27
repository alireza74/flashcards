// Startet den Abgleich automatisch:
// - nach der Anmeldung bzw. beim App-Start mit gespeicherter Sitzung
// - wenn das Netz zurueckkommt
// - wenn die App wieder in den Vordergrund kommt (hoechstens alle 30 Sekunden)
// Nach einer Lernsitzung und per Knopf ruft die Oberflaeche requestSync() selbst auf.
// Einmal in app/_layout.tsx eingebunden; zeichnet nichts.

import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/core/auth/auth-provider';

import { syncNow } from './sync-engine';
import { resetSyncStatus, useSyncStatus } from './sync-status';

const FOREGROUND_MIN_INTERVAL_MS = 30_000;

/** Abgleich anstossen, Ergebnis nicht abwarten (Fehler stehen im Sync-Status). */
export function requestSync(): void {
  void syncNow();
}

export function SyncTriggers() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const lastForegroundSync = useRef(0);
  const queryClient = useQueryClient();
  const { lastSyncedAt } = useSyncStatus();

  // Nach jedem erfolgreichen Abgleich die Anzeige aus der lokalen Datenbank neu laden.
  useEffect(() => {
    if (lastSyncedAt !== null) void queryClient.invalidateQueries({ queryKey: ['local', userId] });
  }, [lastSyncedAt, queryClient, userId]);

  useEffect(() => {
    if (!userId) {
      resetSyncStatus();
      return;
    }
    requestSync();

    let wasConnected: boolean | null = null;
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (wasConnected === false && state.isConnected) requestSync();
      wasConnected = state.isConnected;
    });

    const appState = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const now = Date.now();
      if (now - lastForegroundSync.current < FOREGROUND_MIN_INTERVAL_MS) return;
      lastForegroundSync.current = now;
      requestSync();
    });

    return () => {
      unsubscribeNet();
      appState.remove();
    };
  }, [userId]);

  return null;
}
