// Startseite nach der Anmeldung: zeigt Profil und aktive Organisation.
// Wird spaeter durch die Startseite der jeweiligen Fachanwendung ersetzt.
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { signOut } from '@/core/auth/auth-api';
import { useAuth } from '@/core/auth/auth-provider';
import { useProfile } from '@/core/profile/use-profile';
import { Button } from '@/shared/ui/button';
import { FormMessage } from '@/shared/ui/form-message';
import { Screen } from '@/shared/ui/screen';
import { usePalette } from '@/shared/ui/theme';

export function HomeScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const { session } = useAuth();
  const profile = useProfile(session?.user.id);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const onSignOut = async () => {
    setIsSigningOut(true);
    // Fehler beim Abmelden (z. B. offline) ignorieren: die lokale Sitzung wird trotzdem entfernt
    await signOut().catch(() => undefined);
    setIsSigningOut(false);
  };

  const name = profile.data?.display_name ?? session?.user.email ?? '';

  return (
    <Screen title={t('home.greeting', { name })}>
      {profile.isPending ? <ActivityIndicator /> : null}
      {profile.isError ? <FormMessage tone="error" text={t('home.loadError')} /> : null}

      <Text style={[styles.text, { color: palette.textSecondary }]}>
        {t('home.signedInAs', { email: session?.user.email ?? '' })}
      </Text>
      {profile.data?.active_organization ? (
        <Text style={[styles.text, { color: palette.textSecondary }]}>
          {t('home.organization', { name: profile.data.active_organization.name })}
        </Text>
      ) : null}

      <Button variant="secondary" title={t('home.signOut')} onPress={onSignOut} loading={isSigningOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 16 },
});
