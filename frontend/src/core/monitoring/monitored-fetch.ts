// Huelle um fetch fuer den Supabase-Client: notiert jede Anfrage als Schritt
// (Methode, Pfad, Status, Dauer) - ohne Inhalte und ohne Abfragewerte.

import { addBreadcrumb } from './breadcrumbs';
import { sanitizeUrl } from './sanitize';

type FetchInput = Parameters<typeof fetch>[0];

function urlOf(input: FetchInput | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

async function monitoredFetchImpl(input: FetchInput, init?: Parameters<typeof fetch>[1]): Promise<Response> {
  const path = sanitizeUrl(urlOf(input));
  // Berichte selbst nicht als Schritt notieren
  if (path.includes('/error_reports')) {
    return fetch(input, init);
  }

  const method = init?.method ?? 'GET';
  const started = Date.now();
  try {
    const response = await fetch(input, init);
    addBreadcrumb('http', `${method} ${path} -> ${response.status} (${Date.now() - started} ms)`);
    return response;
  } catch (error) {
    addBreadcrumb('http', `${method} ${path} -> Netzwerkfehler`);
    throw error;
  }
}

// Exakt der Typ von fetch: weicht er ab, verliert createClient<Database> die Tabellentypen.
export const monitoredFetch = monitoredFetchImpl as typeof fetch;
