-- 0001 Basis: Schema "private" und allgemeine Hilfsfunktionen.
--
-- Schema "private" ist NICHT ueber die API erreichbar (siehe config.toml, [api] schemas).
-- Hier liegen Funktionen, die Policies und Trigger nutzen, die die App aber nie direkt aufrufen soll.

create schema if not exists private;
comment on schema private is 'Interne Hilfsfunktionen; nicht ueber die API erreichbar.';

-- Angemeldete Nutzer brauchen USAGE, damit Policies die Funktionen hier aufrufen koennen.
grant usage on schema private to authenticated;

-- Funktionen sind in Postgres standardmaessig fuer alle (PUBLIC) ausfuehrbar.
-- Fuer dieses Schema wird das abgeschaltet; Rechte werden gezielt vergeben.
alter default privileges in schema private revoke execute on functions from public;

-- Setzt updated_at bei jeder Aenderung automatisch.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function private.set_updated_at() is 'Trigger: setzt updated_at auf den aktuellen Zeitpunkt.';
