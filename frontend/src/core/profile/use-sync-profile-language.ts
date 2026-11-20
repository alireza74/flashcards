// Nach der Anmeldung gilt die im Profil gespeicherte Sprache (profiles.locale),
// damit die Wahl auf allen Geraeten des Nutzers gleich ist.
import { useEffect } from 'react';

import { useAuth } from '@/core/auth/auth-provider';
import i18n, { isLanguage } from '@/core/i18n';
import { changeLanguage } from '@/core/i18n/language';

import { useProfile } from './use-profile';

export function useSyncProfileLanguage() {
  const { session } = useAuth();
  const profile = useProfile(session?.user.id);
  const locale = profile.data?.locale;

  useEffect(() => {
    if (isLanguage(locale) && locale !== i18n.language) {
      changeLanguage(locale);
    }
  }, [locale]);
}
