// Der eine Supabase-Client der App. Alle Zugriffe auf Datenbank und Anmeldung laufen hierueber.
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from '@/core/config/env';
import { monitoredFetch } from '@/core/monitoring/monitored-fetch';

import type { Database } from './database.types';
import { LargeSecureStore } from './large-secure-store';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  // jede Anfrage als Schritt notieren (fuer Fehlerberichte; ohne Inhalte)
  global: { fetch: monitoredFetch },
  auth: {
    // Handy: verschluesselt (LargeSecureStore). Web: Standard des Browsers (localStorage).
    storage: Platform.OS === 'web' ? undefined : new LargeSecureStore(),
    // Fester Name; SecureStore erlaubt nur Buchstaben, Ziffern, Punkt, Bindestrich, Unterstrich.
    storageKey: 'auth-session',
    autoRefreshToken: true,
    persistSession: true,
    // Wir arbeiten mit Codes statt Links, daher keine Tokens in der URL auswerten.
    detectSessionInUrl: false,
  },
});

// Auf dem Handy laeuft die automatische Token-Erneuerung nur, solange die App im Vordergrund ist.
// Im Hintergrund wuerde sie sonst ins Leere laufen und beim Zurueckkehren fehlschlagen.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
