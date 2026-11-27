// Verbindung zum Server fuer den Abgleich. Als Schnittstelle beschrieben, damit Tests einen
// Ersatz oder ein zweites "Geraet" einsetzen koennen.

import type { SupabaseClient } from '@supabase/supabase-js';

import type { SyncedTable } from '../db/schema';
import type { ServerRow } from './table-specs';

export type RemoteError = { code?: string; message: string };

export type PullCursor = { serverUpdatedAt: string; id: string };

export type SyncRemote = {
  /** Zeilen anlegen/ersetzen. ignoreDuplicates: vorhandene Zeilen nicht anfassen (Lernhistorie). */
  upsert(table: SyncedTable, rows: ServerRow[], ignoreDuplicates: boolean): Promise<RemoteError | null>;
  /** Zeilen mit server_updated_at >= since, sortiert, nach dem Cursor "after" (Seitenweise). */
  pull(
    table: SyncedTable,
    since: string | null,
    after: PullCursor | null,
    limit: number,
  ): Promise<{ rows: ServerRow[]; error: RemoteError | null }>;
};

/**
 * Abgelehnt (Server hat geantwortet, die Daten sind nicht zulaessig) oder voruebergehend (kein Netz,
 * Zeitueberschreitung)? Postgres-Fehler haben einen 5-stelligen SQLSTATE (z. B. 42501 = keine Berechtigung,
 * 23503 = Fremdschluessel), PostgREST-Fehler beginnen mit PGRST.
 */
export function isRejection(error: RemoteError): boolean {
  const code = error.code ?? '';
  return /^[0-9A-Z]{5}$/.test(code) || code.startsWith('PGRST');
}

export function createSupabaseRemote(client: SupabaseClient): SyncRemote {
  return {
    async upsert(table, rows, ignoreDuplicates) {
      const { error } = await client.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates });
      return error ? { code: error.code, message: error.message } : null;
    },

    async pull(table, since, after, limit) {
      let query = client
        .from(table)
        .select('*')
        .order('server_updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit);
      if (since) query = query.gte('server_updated_at', since);
      if (after) {
        // Keyset: (server_updated_at, id) > (after.serverUpdatedAt, after.id)
        const ts = `"${after.serverUpdatedAt}"`;
        query = query.or(`server_updated_at.gt.${ts},and(server_updated_at.eq.${ts},id.gt.${after.id})`);
      }
      const { data, error } = await query;
      if (error)
        return {
          rows: [],
          error: { code: error.code, message: error.message },
        };
      return { rows: (data ?? []) as ServerRow[], error: null };
    },
  };
}
