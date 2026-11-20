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

import { AuthProvider, useAuth } from '@/core/auth/auth-provider';

// Splash-Screen stehen lassen, bis die gespeicherte Sitzung geladen ist (kein Flackern der Anmeldeseite).
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
  const signedIn = session !== null;

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* nicht angemeldet */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="verify-code" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>

      {/* angemeldet ueber Passwort-Code: erst neues Passwort vergeben */}
      <Stack.Protected guard={signedIn && isPasswordRecovery}>
        <Stack.Screen name="new-password" />
      </Stack.Protected>

      {/* angemeldet */}
      <Stack.Protected guard={signedIn && !isPasswordRecovery}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}
