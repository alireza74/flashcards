-- 0005 App-Einstellungen, Feature-Schalter und Protokoll (Audit-Log).

-- ---------------------------------------------------------------------------
-- app_settings: Werte, die ohne neues App-Release geaendert werden koennen.
-- is_public = true -> auch ohne Anmeldung lesbar (z. B. Mindestversion beim App-Start).
-- ---------------------------------------------------------------------------

create table public.app_settings (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z_]+$'),
  value       jsonb not null,
  is_public   boolean not null default false,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.app_settings is 'Globale Einstellungen ohne App-Release. Aenderung nur per Migration oder Service-Zugriff.';
comment on column public.app_settings.is_public is 'true = auch ohne Anmeldung lesbar.';

insert into public.app_settings (key, value, is_public, description) values
  ('min_app_version', '"0.0.0"', true, 'Aeltere App-Versionen fordern beim Start zum Update auf.');

-- ---------------------------------------------------------------------------
-- feature_flags: Funktionen schrittweise freischalten.
-- ---------------------------------------------------------------------------

create table public.feature_flags (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z_]+$'),
  enabled     boolean not null default false,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.feature_flags is 'Globale Feature-Schalter; lesbar fuer alle, aenderbar nur serverseitig.';

-- ---------------------------------------------------------------------------
-- audit_log: wer hat wann was getan. Nur Handlungen, keine Inhalte und keine
-- personenbezogenen Daten ausser Nutzer-IDs.
-- organization_id null = Ereignis ohne Organisationsbezug (z. B. Kontoloeschung).
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_id        uuid references auth.users (id) on delete set null,
  action          text not null,
  entity          text not null,
  entity_id       uuid,
  details         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

comment on table public.audit_log is 'Protokoll von Handlungen (keine Inhalte). Schreiben nur ueber Trigger/Funktionen.';
comment on column public.audit_log.actor_id is 'Ausloesender Nutzer; null = System (z. B. Registrierung, Hintergrundjob).';

create index audit_log_organization_id_created_at_idx on public.audit_log (organization_id, created_at desc);
create index audit_log_actor_id_idx on public.audit_log (actor_id);

create trigger set_updated_at before update on public.app_settings
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.feature_flags
  for each row execute function private.set_updated_at();

-- Schreibt einen Eintrag ins Protokoll. Nur fuer Trigger und Server-Funktionen.
create function private.write_audit(
  org uuid,
  action text,
  entity text,
  entity_id uuid,
  details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, details)
  values (org, (select auth.uid()), action, entity, entity_id, details);
$$;

comment on function private.write_audit(uuid, text, text, uuid, jsonb) is 'Schreibt einen Protokolleintrag; actor_id = angemeldeter Nutzer.';

-- Protokolliert Aenderungen an Mitgliedschaften.
create function private.audit_organization_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data public.organization_members := case when tg_op = 'DELETE' then old else new end;
begin
  -- Organisation wird gerade geloescht (Kaskade): nichts protokollieren.
  if not exists (select 1 from public.organizations where id = row_data.organization_id) then
    return null;
  end if;

  perform private.write_audit(
    row_data.organization_id,
    'member.' || lower(tg_op),
    'organization_members',
    row_data.id,
    jsonb_strip_nulls(jsonb_build_object(
      'user_id',     row_data.user_id,
      'role',        (select key from public.roles where id = row_data.role_id),
      'old_role',    case when tg_op = 'UPDATE'
                       then (select key from public.roles where id = old.role_id) end
    ))
  );
  return null;
end;
$$;

create trigger audit_organization_members
  after insert or update of role_id or delete on public.organization_members
  for each row execute function private.audit_organization_members();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.app_settings enable row level security;
alter table public.feature_flags enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.app_settings, public.feature_flags, public.audit_log from anon, authenticated;
grant select on public.app_settings, public.feature_flags to anon, authenticated;
grant select on public.audit_log to authenticated;

create policy "read public settings" on public.app_settings
  for select to anon, authenticated
  using (is_public);

create policy "read feature flags" on public.feature_flags
  for select to anon, authenticated
  using (true);

create policy "read audit log with permission" on public.audit_log
  for select to authenticated
  using (
    organization_id is not null
    and (select private.has_permission(organization_id, 'audit.read'))
  );

-- Sicherheitsnetz: keine Funktion in private darf fuer anon/PUBLIC ausfuehrbar sein.
revoke execute on all functions in schema private from public, anon;
