// Sprachsteuerung (i18next). Wird einmal im Wurzel-Layout importiert.
// Sprache = Geraetesprache, falls unterstuetzt, sonst Deutsch.
// Ab M3: Auswahl im Profil (profiles.locale) und Persisch mit RTL.
import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { de } from './de';
import { en } from './en';

export const supportedLanguages = ['de', 'en'] as const;
export type Language = (typeof supportedLanguages)[number];

function detectLanguage(): Language {
  const deviceLanguage = getLocales()[0]?.languageCode;
  return (supportedLanguages as readonly string[]).includes(deviceLanguage ?? '')
    ? (deviceLanguage as Language)
    : 'de';
}

// Eigene Instanz; initReactI18next macht sie fuer useTranslation() verfuegbar.
const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
  },
  lng: detectLanguage(),
  fallbackLng: 'de',
  interpolation: {
    // React schuetzt bereits vor HTML-Einschleusung
    escapeValue: false,
  },
});

export default i18n;
