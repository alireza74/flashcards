// Updates per EAS Update (expo-updates): pruefen und herunterladen.
//
// Ablauf ohne eigenes Zutun (Standard von expo-updates): beim App-Start wird still nach einem Update gesucht
// und es wird geladen. Aktiv wird es erst beim naechsten Kaltstart (App ganz beenden). Damit der Nutzer davon
// erfaehrt, zeigt UpdatePrompt einen Hinweis, sobald ein Update geladen ist, und das Profil hat den Knopf
// "Nach Updates suchen".
//
// Im Browser und im Entwicklungsmodus (Expo Go, Dev-Server) gibt es keine Updates: updatesSupported = false.
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { addBreadcrumb } from '@/core/monitoring/breadcrumbs';

export const updatesSupported = Platform.OS !== 'web' && Updates.isEnabled && !__DEV__;

// Sucht nach einem Update und laedt es herunter. Danach meldet useUpdates() isUpdatePending = true.
export async function checkAndDownloadUpdate(): Promise<'none' | 'downloaded'> {
  addBreadcrumb('app', 'Update: suchen');
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) {
    addBreadcrumb('app', 'Update: keines vorhanden');
    return 'none';
  }
  addBreadcrumb('app', 'Update: wird geladen');
  await Updates.fetchUpdateAsync();
  addBreadcrumb('app', 'Update: geladen');
  return 'downloaded';
}

// Startet die App mit dem geladenen Update neu
export function restartWithUpdate() {
  addBreadcrumb('app', 'Update: Neustart');
  return Updates.reloadAsync();
}
