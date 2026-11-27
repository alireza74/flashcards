// Merker "Einfuehrung gesehen" auf dem Geraet (AsyncStorage, im Browser localStorage).
// Neue Fassung der Einfuehrung zeigen: Schluessel hochzaehlen (v2).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { onboardingPages } from '@/config/onboarding';

const STORAGE_KEY = 'onboarding-done-v1';

export function useOnboarding() {
  const enabled = onboardingPages.length > 0;
  // null = noch nicht gelesen
  const [done, setDone] = useState<boolean | null>(enabled ? null : true);

  useEffect(() => {
    if (!enabled) return;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => setDone(value === 'true'))
      // Speicher nicht lesbar: Einfuehrung lieber nicht zeigen als bei jedem Start
      .catch(() => setDone(true));
  }, [enabled]);

  const finish = () => {
    setDone(true);
    AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => undefined);
  };

  return { isReady: done !== null, showOnboarding: done === false, finish };
}
