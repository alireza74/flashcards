// Zentrale Stelle fuer alle app-spezifischen Werte.
// In einem Klon (z. B. Sprachlern-App) wird nur app-identity.json angepasst,
// nicht der Code in core/ oder shared/.
//
// Warum JSON: Die Expo-Konfiguration (../../app.config.ts) kann keine weiteren
// TypeScript-Dateien laden, JSON aber schon. So lesen App und Build dieselben Werte.
//
// Felder in app-identity.json:
//   name                 Anzeigename auf dem Geraet und im Browser-Tab
//   slug                 technischer Kurzname fuer Expo/EAS (Kleinbuchstaben, Bindestrich)
//   scheme               URL-Schema fuer Deep Links, z. B. baseapp://login
//   version              sichtbare App-Version; bei jedem Store-Release erhoehen
//   iosBundleIdentifier  eindeutige Kennung im App Store (Platzhalter bis Name feststeht)
//   androidPackage       eindeutige Kennung im Play Store (Platzhalter bis Name feststeht)
//   primaryColor         Hauptfarbe (Splash-Screen)
//   supportEmail         Adresse fuer "Feedback senden" im Profil (leer = Knopf ausgeblendet; Platzhalter ersetzen)
import identity from './app-identity.json';

export const appIdentity = identity;
