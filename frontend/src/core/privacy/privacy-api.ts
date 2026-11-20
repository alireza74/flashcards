// Datenschutz-Funktionen: Einwilligungen, Datenexport, Kontoloeschung.
// Die Logik liegt in der Datenbank (Migration 0006); hier nur die Aufrufe.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { profileQueryKey } from '@/core/profile/use-profile';
import { supabase } from '@/core/supabase/client';

export const consentPurposes = ['analytics', 'crash_reports', 'push', 'personalization'] as const;
export type ConsentPurpose = (typeof consentPurposes)[number];

// Bei inhaltlicher Aenderung der Einwilligungstexte erhoehen: dann ist nachweisbar,
// welcher Fassung jemand zugestimmt hat.
export const CONSENT_TEXT_VERSION = '2026-11-20';

function consentsQueryKey(userId: string | undefined) {
  return ['consents', userId] as const;
}

// Aktueller Stand je Zweck; nicht vorhanden = nicht erteilt.
export function useConsents(userId: string | undefined) {
  return useQuery({
    queryKey: consentsQueryKey(userId),
    enabled: userId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase.from('current_consents').select('purpose, granted');
      if (error) throw error;
      const state: Record<string, boolean> = {};
      for (const row of data) {
        if (row.purpose) state[row.purpose] = row.granted === true;
      }
      return state;
    },
  });
}

export function useSetConsent(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ purpose, granted }: { purpose: ConsentPurpose; granted: boolean }) => {
      const { error } = await supabase
        .from('consents')
        .insert({ purpose, granted, text_version: CONSENT_TEXT_VERSION });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: consentsQueryKey(userId) }),
  });
}

// Holt alle Daten als JSON und bietet sie zum Speichern an
// (Browser: Download, Handy: Teilen-Dialog).
export async function exportMyData(): Promise<void> {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) throw error;

  const json = JSON.stringify(data, null, 2);
  const fileName = `meine-daten-${new Date().toISOString().slice(0, 10)}.json`;

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(json);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
}

export { deletionDate, isLastOwnerError } from './privacy-helpers';

export function useRequestDeletion(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('request_account_deletion');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) }),
  });
}

export function useCancelDeletion(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('cancel_account_deletion');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) }),
  });
}
