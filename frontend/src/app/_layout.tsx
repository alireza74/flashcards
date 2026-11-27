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

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { UpdatePrompt } from '@/core/app-version/update-prompt';
import { UpdateRequiredScreen } from '@/core/app-version/update-required-screen';
import { useMinVersionCheck } from '@/core/app-version/use-min-version';
import { AuthProvider, useAuth } from '@/core/auth/auth-provider';
import { restoreLanguage } from '@/core/i18n/language';
import { reportError } from '@/core/monitoring/error-sink';
import { ErrorScreen } from '@/core/monitoring/error-screen';
import { useMonitoring } from '@/core/monitoring/use-monitoring';
import { OnboardingScreen } from '@/core/onboarding/onboarding-screen';
import { useOnboarding } from '@/core/onboarding/use-onboarding';
import { useSyncProfileLanguage } from '@/core/profile/use-sync-profile-language';
import { SyncTriggers } from '@/features/flashcards/sync/sync-triggers';

// Splash-Screen stehen lassen, bis Sitzung und Sprache geladen sind (kein Flackern).
SplashScreen.preventAutoHideAsync();

// Fehler beim Laden/Speichern von Daten zentral als Fehlerbericht melden (Stufe warning).
function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) =>
        reportError(error, { level: 'warning', context: { source: `query ${String(query.queryKey[0])}` } }),
    }),
    mutationCache: new MutationCache({
      onError: (error) => reportError(error, { level: 'warning', context: { source: 'mutation' } }),
    }),
  });
}

// Expo Router zeigt diese Komponente, wenn beim Darstellen einer Seite ein Fehler auftritt.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const [errorId] = useState(() => reportError(error, { level: 'fatal', context: { source: 'render' } }));
  return <ErrorScreen errorId={errorId} onRetry={() => void retry()} />;
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);

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
  const onboarding = useOnboarding();
  const signedIn = session !== null;

  useSyncProfileLanguage();
  useMonitoring();

  useEffect(() => {
    restoreLanguage().finally(() => setLanguageReady(true));
  }, []);

  const ready = !isLoading && languageReady && onboarding.isReady;

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

  // erster Start: Einfuehrung (config/onboarding.ts), danach nie wieder
  if (onboarding.showOnboarding) {
    return <OnboardingScreen onDone={onboarding.finish} />;
  }

  // Ziel, wenn eine Seite gerade nicht erlaubt ist. Ausdruecklich gesetzt (redirectTo):
  // ohne Angabe springt Expo Router auf den "Anker" des Navigators - das war das Impressum.
  const home = isPasswordRecovery ? '/new-password' : '/';

  return (
    <>
      {/* Hinweis, sobald ein Update geladen ist (nur Handy, nicht im Browser/Entwicklungsmodus) */}
      <UpdatePrompt />
      {/* Karteikarten: Offline-Abgleich automatisch starten (zeichnet nichts) */}
      <SyncTriggers />
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
    </>
  );
}
