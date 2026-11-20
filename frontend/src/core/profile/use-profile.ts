// Eigenes Profil laden und aendern (TanStack Query).
// Datenfluss: Hook -> Supabase REST -> Postgres prueft RLS ("read own and colleague profiles",
// "update own profile") -> nur das eigene Profil ist lesbar/aenderbar.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Language } from '@/core/i18n';
import { supabase } from '@/core/supabase/client';

export function profileQueryKey(userId: string | undefined) {
  // Der Cache-Schluessel enthaelt die Nutzer-ID, damit Daten verschiedener Nutzer nie vermischt werden.
  return ['profile', userId] as const;
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileQueryKey(userId),
    enabled: userId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'display_name, locale, status, deletion_requested_at, active_organization:organizations!profiles_active_organization_id_fkey(id, name, kind)',
        )
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// Nur die Spalten, die laut Spaltenrecht (0003) aenderbar sind.
type ProfileChanges = {
  display_name?: string;
  locale?: Language;
};

export function useUpdateProfile(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (changes: ProfileChanges) => {
      const { error } = await supabase.from('profiles').update(changes).eq('id', userId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) }),
  });
}
