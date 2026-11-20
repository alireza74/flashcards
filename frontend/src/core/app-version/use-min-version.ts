// Mindestversion-Schalter: Ist die installierte App aelter als app_settings.min_app_version,
// muss aktualisiert werden. Notbremse fuer unvermeidbare Schema-Brueche (siehe Architektur 5).
// Der Wert ist auch ohne Anmeldung lesbar (is_public = true).
import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';

import { supabase } from '@/core/supabase/client';
import { isVersionAtLeast } from '@/shared/lib/version';

export function installedAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

export function useMinVersionCheck() {
  const query = useQuery({
    queryKey: ['app-settings', 'min_app_version'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'min_app_version')
        .maybeSingle();
      if (error) throw error;
      return typeof data?.value === 'string' ? data.value : '0.0.0';
    },
    // einmal pro App-Start genuegt
    staleTime: Infinity,
    retry: 1,
  });

  // Ohne Antwort (offline, Fehler) nicht blockieren: lieber nutzbar als gesperrt.
  const updateRequired = query.data !== undefined && !isVersionAtLeast(installedAppVersion(), query.data);

  return { updateRequired, isChecking: query.isPending };
}
