// Fehlerberichte senden (eigene Loesung, Tabelle error_reports in Supabase).
//
// Ablauf bei einem Fehler:
//   reportError() -> captureError() -> nur wenn Einwilligung "crash_reports" an:
//   Bericht bauen (gefiltert) -> an Supabase senden -> bei Netzfehler merken und spaeter senden.
// Die Datenbank prueft die Einwilligung zusaetzlich selbst (Policy in Migration 0007).

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { supabase } from '@/core/supabase/client';

import { getBreadcrumbs } from './breadcrumbs';
import { createErrorId } from './error-id';
import { setErrorSink, type CaptureOptions } from './error-sink';
import { buildReport, type AppMeta, type ErrorReport } from './report';

const QUEUE_KEY = 'error-report-queue';
const MAX_QUEUE = 10;

let enabled = false;
let organizationId: string | null = null;
let installed = false;

function appMeta(): AppMeta {
  return {
    appVersion: Constants.expoConfig?.version ?? null,
    updateId: Platform.OS === 'web' ? null : Updates.updateId,
    channel: Platform.OS === 'web' ? 'web' : Updates.channel,
    platform: Platform.OS,
    osVersion: Device.osVersion,
    deviceModel: Device.modelName,
  };
}

// Kanal der App ("preview" = Test-APK, "production" = Store). Fuer Testfunktionen.
export function isPreviewBuild(): boolean {
  return __DEV__ || (Platform.OS !== 'web' && Updates.channel === 'preview');
}

async function readQueue(): Promise<ErrorReport[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY).catch(() => null);
  try {
    return raw ? (JSON.parse(raw) as ErrorReport[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: ErrorReport[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE))).catch(() => undefined);
}

// true = erledigt (gesendet oder endgueltig abgelehnt), false = spaeter erneut versuchen
async function send(report: ErrorReport): Promise<boolean> {
  // ohne .select(): Nutzer duerfen Berichte nur anlegen, nicht lesen
  const { error } = await supabase.from('error_reports').insert(report as never);
  if (!error) return true;
  // Keine Einwilligung (42501), zu viele Berichte, ungueltige Daten: nicht erneut senden
  if (error.code === '42501' || error.code === 'P0001' || error.code?.startsWith('23')) return true;
  return false;
}

async function flushQueue(): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;
  const remaining: ErrorReport[] = [];
  for (const report of queue) {
    if (!(await send(report).catch(() => false))) remaining.push(report);
  }
  await writeQueue(remaining);
}

function captureError(error: unknown, options?: CaptureOptions): string | null {
  if (!enabled) return null;

  const report = buildReport({
    error,
    shortId: createErrorId(Crypto.getRandomBytes),
    level: options?.level ?? 'error',
    breadcrumbs: getBreadcrumbs(),
    meta: appMeta(),
    organizationId,
    context: options?.context,
  });

  // Zuerst merken (falls die App gleich abstuerzt), dann senden
  void (async () => {
    const queue = await readQueue();
    await writeQueue([...queue, report]);
    await flushQueue();
  })();

  return report.short_id;
}

export function setMonitoringEnabled(value: boolean): void {
  const wasEnabled = enabled;
  enabled = value;
  if (value && !wasEnabled) {
    void flushQueue();
  }
  if (!value) {
    // Widerruf: liegengebliebene Berichte verwerfen
    void AsyncStorage.removeItem(QUEUE_KEY).catch(() => undefined);
  }
}

export function setMonitoringOrganization(id: string | null): void {
  organizationId = id;
}

// Einmal beim App-Start: Sammelstelle verbinden und unbehandelte Fehler abfangen.
export function installMonitoring(): void {
  if (installed) return;
  installed = true;
  setErrorSink(captureError);

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => captureError(event.error ?? event.message, { level: 'error' }));
      window.addEventListener('unhandledrejection', (event) =>
        captureError(event.reason, { level: 'error', context: { source: 'unhandled promise' } }),
      );
    }
    return;
  }

  // React Native: globaler Handler fuer unbehandelte JavaScript-Fehler
  const errorUtils = (globalThis as { ErrorUtils?: {
    getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
    setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
  } }).ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      captureError(error, { level: isFatal ? 'fatal' : 'error' });
      previous(error, isFatal);
    });
  }
}
