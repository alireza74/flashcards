// Umgebungswerte aus frontend/.env.local (lokal) bzw. aus der Build-Umgebung.
// Nur Variablen mit Praefix EXPO_PUBLIC_ landen in der App - und sind damit oeffentlich.
// Hier daher nur URL und oeffentlicher (publishable) Schluessel, nie der Secret Key.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Umgebungsvariable ${name} fehlt. Vorlage: frontend/.env.example`);
  }
  return value;
}

export const env = {
  // Expo ersetzt process.env.EXPO_PUBLIC_... beim Bauen durch den Wert;
  // deshalb muss der Zugriff genau so ausgeschrieben sein.
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};
