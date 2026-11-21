// Fehlerprotokoll als Datei auf dem Geraet (Handy: App-Ordner, Web: Browser-Speicher).
//
// - Geschrieben wird nur mit Einwilligung "Fehlerprotokoll" (setLogPersistence(true)).
// - Grenze: 1000 Eintraege / 7 Tage (log-format.ts), aeltere fallen heraus.
// - Widerruf loescht die Datei sofort.
// - shareLog(): Datei teilen (Handy: Teilen-Dialog, Web: Download). Ohne Einwilligung
//   wird nur das Protokoll der aktuellen Sitzung geteilt.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { getBreadcrumbs, subscribeLog } from './breadcrumbs';
import { formatLog, trimEntries, type AppMeta, type LogEntry } from './log-format';

const FILE_NAME = 'fehlerprotokoll.jsonl';
const WEB_KEY = 'fehlerprotokoll';
const SAVE_DELAY_MS = 2000;

let persisted: LogEntry[] = [];
let enabled = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribe: (() => void) | undefined;

const isWeb = Platform.OS === 'web';

function logFile(): File {
  return new File(Paths.document, FILE_NAME);
}

async function load(): Promise<LogEntry[]> {
  try {
    const raw = isWeb ? await AsyncStorage.getItem(WEB_KEY) : logFile().exists ? await logFile().text() : null;
    if (!raw) return [];
    return raw
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as LogEntry);
  } catch {
    // beschaedigte Datei: neu beginnen
    return [];
  }
}

async function save(): Promise<void> {
  if (!enabled) return;
  persisted = trimEntries(persisted);
  const content = persisted.map((entry) => JSON.stringify(entry)).join('\n');
  try {
    if (isWeb) {
      await AsyncStorage.setItem(WEB_KEY, content);
    } else {
      const file = logFile();
      if (!file.exists) file.create();
      await file.write(content);
    }
  } catch {
    // Protokollieren darf die App nie stoeren
  }
}

function scheduleSave(immediate: boolean) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void save(), immediate ? 0 : SAVE_DELAY_MS);
}

async function remove(): Promise<void> {
  try {
    if (isWeb) {
      await AsyncStorage.removeItem(WEB_KEY);
    } else if (logFile().exists) {
      logFile().delete();
    }
  } catch {
    // ignorieren
  }
}

// Mit Einwilligung: vorhandene Datei laden, Eintraege dieser Sitzung uebernehmen, ab jetzt mitschreiben.
// Ohne Einwilligung: Datei loeschen, nichts mehr schreiben.
// keepFile (beim Abmelden): nicht mehr schreiben, Datei aber behalten - der Fehler kann kurz
// vor dem Abmelden passiert sein; beim naechsten Anmelden mit Einwilligung geht es weiter.
export async function setLogPersistence(value: boolean, options?: { keepFile?: boolean }): Promise<void> {
  if (value === enabled && !(value === false && !options?.keepFile)) return;
  enabled = value;

  if (!value) {
    unsubscribe?.();
    unsubscribe = undefined;
    if (saveTimer) clearTimeout(saveTimer);
    if (!options?.keepFile) {
      await remove();
    }
    persisted = [];
    return;
  }

  persisted = trimEntries([...(await load()), ...getBreadcrumbs()]);
  unsubscribe = subscribeLog((entry) => {
    persisted.push(entry);
    scheduleSave(entry.level === 'error');
  });
  await save();
}

export function appMeta(): AppMeta {
  return {
    appVersion: Constants.expoConfig?.version ?? null,
    updateId: isWeb ? null : Updates.updateId,
    channel: isWeb ? 'web' : Updates.channel,
    platform: Platform.OS,
    osVersion: Device.osVersion,
    deviceModel: Device.modelName,
  };
}

// Protokoll als Textdatei teilen. Liefert die Zahl der Eintraege.
export async function shareLog(): Promise<number> {
  const entries = enabled ? trimEntries(persisted) : getBreadcrumbs();
  const text = formatLog(entries, appMeta());
  const fileName = `fehlerprotokoll-${new Date().toISOString().slice(0, 10)}.txt`;

  if (isWeb) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return entries.length;
  }

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', UTI: 'public.plain-text' });
  return entries.length;
}
