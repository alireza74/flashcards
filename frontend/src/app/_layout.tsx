// Wurzel-Layout aller Routen.
//
// Provider (von aussen nach innen):
//   QueryClientProvider  Cache fuer Serverdaten (TanStack Query)
//   AuthProvider         aktuelle Sitzung
//
// Zugangsschutz mit Stack.Protected: Je nach Sitzung sind nur bestimmte Seiten erreichbar.
// Aendert sich die Sitzung (Anmelden, Abmelden), springt Expo Router automatisch
// auf eine erlaubte Seite. Das ist nur Navigation - den echten Schutz der Daten
// macht RLS in der Datenbank.
import '@/core/i18n';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { UpdateRequiredScreen } from '@/core/app-version/update-required-screen';
import { useMinVersionCheck } from '@/core/app-version/use-min-version';
import { AuthProvider, useAuth } from '@/core/auth/auth-provider';
import { restoreLanguage } from '@/core/i18n/language';
import { useSyncProfileLanguage } from '@/core/profile/use-sync-profile-language';

// Splash-Screen stehen lassen, bis Sitzung und Sprache geladen sind (kein Flackern).
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { session, isLoading, isPasswordRecovery } = useAuth();
  const [languageReady, setLanguageReady] = useState(false);
  const { updateRequired } = useMinVersionCheck();
  const signedIn = session !== null;

  useSyncProfileLanguage();

  useEffect(() => {
    restoreLanguage().finally(() => setLanguageReady(true));
  }, []);

  const ready = !isLoading && languageReady;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  // Version zu alt: nichts anderes anzeigen
  if (updateRequired) {
    return <UpdateRequiredScreen />;
  }

  // Ziel, wenn eine Seite gerade nicht erlaubt ist. Ausdruecklich gesetzt (redirectTo):
  // ohne Angabe springt Expo Router auf den "Anker" des Navigators - das war das Impressum.
  const home = isPasswordRecovery ? '/new-password' : '/';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* nicht angemeldet */}
      <Stack.Protected guard={!signedIn} redirectTo={home}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="verify-code" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>

      {/* angemeldet ueber Passwort-Code: erst neues Passwort vergeben */}
      <Stack.Protected guard={signedIn && isPasswordRecovery} redirectTo={signedIn ? '/' : '/sign-in'}>
        <Stack.Screen name="new-password" />
      </Stack.Protected>

      {/* angemeldet */}
      <Stack.Protected guard={signedIn && !isPasswordRecovery} redirectTo={signedIn ? home : '/sign-in'}>
        <Stack.Screen name="index" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="change-password" />
      </Stack.Protected>

      {/* immer erreichbar (Store-Pflicht: Datenschutzerklaerung auch ohne Konto) */}
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="imprint" />
    </Stack>
  );
}
