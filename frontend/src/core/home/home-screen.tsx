// Startseite nach der Anmeldung: zeigt Profil und aktive Organisation.
// Wird spaeter durch die Startseite der jeweiligen Fachanwendung ersetzt.
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/core/auth/auth-provider';
import { useProfile } from '@/core/profile/use-profile';
import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';
import { ErrorState, LoadingState } from '@/shared/ui/states';

export function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const profile = useProfile(session?.user.id);

  if (profile.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (profile.isError) {
    return (
      <Screen>
        <ErrorState message={t('home.loadError')} onRetry={() => profile.refetch()} />
      </Screen>
    );
  }

  const name = profile.data.display_name ?? session?.user.email ?? '';

  return (
    <Screen title={t('home.greeting', { name })}>
      <AppText tone="secondary">{t('home.signedInAs', { email: session?.user.email ?? '' })}</AppText>
      {profile.data.active_organization ? (
        <AppText tone="secondary">
          {t('home.organization', { name: profile.data.active_organization.name })}
        </AppText>
      ) : null}

      <Button title={t('home.toProfile')} onPress={() => router.push('/profile')} />
    </Screen>
  );
}
