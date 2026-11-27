// React-Anbindung der lokalen Datenbank ueber TanStack Query.
// - Lesen: useLocalQuery - Cache-Schluessel beginnt mit ['local', userId], damit nie Daten zweier Nutzer
//   vermischt werden und alles auf einmal neu geladen werden kann.
// - Schreiben: useLocalMutation - danach wird ['local', userId] neu geladen und ein Abgleich angestossen.
// - Nach jedem erfolgreichen Abgleich laedt SyncTriggers ['local', userId] ebenfalls neu.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { useAuth } from '@/core/auth/auth-provider';

import { getLocalDb } from '../db/local-db';
import type { LocalDb } from '../db/local-db-types';
import { getStoredOrganizationId } from '../sync/sync-engine';
import { requestSync } from '../sync/sync-triggers';
import type { DataContext } from './context';

export function localQueryKey(userId: string | undefined, ...parts: unknown[]) {
  return ['local', userId, ...parts] as const;
}

export function useLocalQuery<T>(parts: unknown[], read: (db: LocalDb) => Promise<T>, enabled = true) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: localQueryKey(userId, ...parts),
    enabled: enabled && userId !== undefined,
    queryFn: async () => read(await getLocalDb(userId!)),
  });
}

/** Schreibkontext; null, solange die Organisation noch nie vom Server geholt wurde (erster Start offline). */
export function useDataContext() {
  return useLocalQuery(['context'], async (db): Promise<DataContext | null> => {
    const organizationId = await getStoredOrganizationId(db);
    if (!organizationId) return null;
    return {
      db,
      organizationId,
      newId: () => Crypto.randomUUID(),
      now: () => Date.now(),
    };
  });
}

export function useLocalMutation<TInput, TResult>(write: (ctx: DataContext, input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const context = useDataContext();

  return useMutation({
    mutationFn: async (input: TInput) => {
      const ctx = context.data;
      if (!ctx) throw new Error('no organization yet');
      return write(ctx, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: localQueryKey(userId) });
      requestSync();
    },
  });
}
