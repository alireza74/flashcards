// Startseite nach der Anmeldung: zeigt Profil und aktive Organisation.
// Wird spaeter durch die Startseite der jeweiligen Fachanwendung ersetzt.
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/core/auth/auth-provider';
import { deletionDate, useCancelDeletion } from '@/core/privacy/privacy-api';
import { ProfileButton } from '@/core/profile/profile-button';
import { useProfile } from '@/core/profile/use-profile';
import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FormMessage } from '@/shared/ui/form-message';
import { Screen } from '@/shared/ui/screen';
import { ErrorState, LoadingState } from '@/shared/ui/states';

export function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user.id;
  const profile = useProfile(userId);
  const cancelDeletion = useCancelDeletion(userId);

  if (profile.isPending) {
    return (
      <Screen headerAction={<ProfileButton />}>
        <LoadingState />
      </Screen>
    );
  }

  if (profile.isError) {
    return (
      <Screen headerAction={<ProfileButton />}>
        <ErrorState message={t('home.loadError')} onRetry={() => profile.refetch()} />
      </Screen>
    );
  }

  const name = profile.data.display_name ?? session?.user.email ?? '';
  const scheduledDeletion = profile.data.status === 'deleted' ? deletionDate(profile.data.deletion_requested_at) : undefined;

  return (
    <Screen title={t('home.greeting', { name })} headerAction={<ProfileButton />}>
      {/* Konto zur Loeschung vorgemerkt: innerhalb der 30 Tage abbrechbar */}
      {scheduledDeletion ? (
        <Card>
          <FormMessage
            tone="error"
            text={t('privacy.deletion.scheduled', { date: scheduledDeletion.toLocaleDateString(i18n.language) })}
          />
          <Button
            title={t('privacy.deletion.cancel')}
            onPress={() => cancelDeletion.mutate()}
            loading={cancelDeletion.isPending}
          />
        </Card>
      ) : null}

      <AppText tone="secondary">{t('home.signedInAs', { email: session?.user.email ?? '' })}</AppText>
      {profile.data.active_organization ? (
        <AppText tone="secondary">
          {t('home.organization', { name: profile.data.active_organization.name })}
        </AppText>
      ) : null}
    </Screen>
  );
}
