// Sprache wechseln und merken; Persisch schaltet auf Rechts-nach-links (RTL).
//
// Reihenfolge der Quellen beim Start:
//   1. gespeicherte Wahl auf dem Geraet (AsyncStorage, auch im Browser)
//   2. Geraetesprache (siehe index.ts)
// Nach der Anmeldung gilt profiles.locale (siehe useSyncProfileLanguage).
//
// RTL: Auf dem Handy wirkt I18nManager.forceRTL erst nach einem Neustart der App.
// Wir laden die App dann neu (expo-updates). Im Browser genuegt dir="rtl" am <html>.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { I18nManager, Platform } from 'react-native';

import i18n, { isLanguage, type Language } from './index';

const STORAGE_KEY = 'app-language';

export function isRtlLanguage(language: Language): boolean {
  return language === 'fa';
}

function applyWebDirection(language: Language) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.dir = isRtlLanguage(language) ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }
}

// Wechselt die Sprache. Liefert true, wenn die App fuer RTL/LTR neu gestartet wird.
export async function changeLanguage(language: Language): Promise<boolean> {
  await i18n.changeLanguage(language);
  await AsyncStorage.setItem(STORAGE_KEY, language).catch(() => undefined);
  applyWebDirection(language);

  if (Platform.OS === 'web') {
    return false;
  }

  const rtl = isRtlLanguage(language);
  if (I18nManager.isRTL === rtl) {
    return false;
  }

  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  // Neustart, damit das Layout gespiegelt wird. Schlaegt das fehl (z. B. bestimmte
  // Entwicklungsumgebungen), wirkt die Aenderung beim naechsten App-Start.
  await Updates.reloadAsync().catch(() => undefined);
  return true;
}

// Beim Start: gespeicherte Sprache uebernehmen (ohne Neustart; Richtung ist vom letzten Start schon gesetzt).
export async function restoreLanguage(): Promise<void> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  if (stored && isLanguage(stored) && stored !== i18n.language) {
    await i18n.changeLanguage(stored);
  }
  applyWebDirection(i18n.language as Language);
}
