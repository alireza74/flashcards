// Laedt das eigene Profil inklusive aktiver Organisation (TanStack Query).
// Datenfluss: Hook -> Supabase REST -> Postgres prueft RLS ("read own and colleague profiles")
// -> nur das eigene Profil bzw. das von Kollegen kommt zurueck.
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/core/supabase/client';

export function useProfile(userId: string | undefined) {
  return useQuery({
    // Der Cache-Schluessel enthaelt die Nutzer-ID, damit Daten verschiedener Nutzer nie vermischt werden.
    queryKey: ['profile', userId],
    enabled: userId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'display_name, locale, active_organization:organizations!profiles_active_organization_id_fkey(id, name, kind)',
        )
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
