// Sprachsteuerung (i18next). Wird einmal im Wurzel-Layout importiert.
// Startsprache = Geraetesprache, falls unterstuetzt, sonst Deutsch.
// Wechsel, Speichern und RTL: siehe language.ts.
import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { de } from './de';
import { en } from './en';
import { fa } from './fa';

export const supportedLanguages = ['de', 'en', 'fa'] as const;
export type Language = (typeof supportedLanguages)[number];

// Anzeigenamen jeweils in der eigenen Sprache
export const languageNames: Record<Language, string> = {
  de: 'Deutsch',
  en: 'English',
  fa: 'فارسی',
};

export function isLanguage(value: string | null | undefined): value is Language {
  return (supportedLanguages as readonly string[]).includes(value ?? '');
}

function detectLanguage(): Language {
  const deviceLanguage = getLocales()[0]?.languageCode;
  return isLanguage(deviceLanguage) ? deviceLanguage : 'de';
}

// Eigene Instanz; initReactI18next macht sie fuer useTranslation() verfuegbar.
const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
    fa: { translation: fa },
  },
  lng: detectLanguage(),
  fallbackLng: 'de',
  interpolation: {
    // React schuetzt bereits vor HTML-Einschleusung
    escapeValue: false,
  },
});

export default i18n;
