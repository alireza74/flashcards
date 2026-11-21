-- 0007 Fehlerberichte aus der App (eigene Loesung statt externem Dienst).
--
-- Regeln:
-- - Nur mit Einwilligung "crash_reports" (wird hier in der Policy erzwungen, nicht nur in der App).
-- - Keine Inhalte: Die App filtert E-Mail-Adressen, Tokens und Codes vor dem Senden heraus.
-- - Nutzer duerfen Berichte nur anlegen, nicht lesen oder aendern. Auswerten kann nur der
--   Betreiber (Supabase Studio / SQL).
-- - Aufbewahrung 90 Tage (taeglicher Loeschjob), Loeschung des Kontos loescht die Berichte mit.

create table public.error_reports (
  id              uuid primary key default gen_random_uuid(),
  -- kurze ID, die die App dem Nutzer anzeigt ("Fehler-ID 7KQ2-M9XA") und die er dem Support nennt
  short_id        text not null unique check (short_id ~ '^[0-9A-Z]{4}-[0-9A-Z]{4}$'),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  level           text not null default 'error' check (level in ('warning', 'error', 'fatal')),
  message         text not null check (char_length(message) between 1 and 2000),
  stack           text check (char_length(stack) <= 20000),
  -- letzte Schritte vor dem Fehler (Seiten, Knoepfe, Anfragen) - ohne Inhalte
  breadcrumbs     jsonb not null default '[]'::jsonb
                  check (jsonb_typeof(breadcrumbs) = 'array' and octet_length(breadcrumbs::text) <= 100000),
  context         jsonb not null default '{}'::jsonb
                  check (jsonb_typeof(context) = 'object' and octet_length(context::text) <= 20000),
  app_version     text check (char_length(app_version) <= 50),
  update_id       text check (char_length(update_id) <= 100),
  channel         text check (char_length(channel) <= 50),
  platform        text check (char_length(platform) <= 20),
  os_version      text check (char_length(os_version) <= 50),
  device_model    text check (char_length(device_model) <= 100),
  occurred_at     timestamptz not null,
  created_at      timestamptz not null default now()
);

comment on table public.error_reports is 'Fehlerberichte der App (nur mit Einwilligung crash_reports), 90 Tage aufbewahrt. Lesen nur Betreiber.';
comment on column public.error_reports.short_id is 'Fehler-ID, die dem Nutzer angezeigt wird; damit findet der Support den Bericht.';
comment on column public.error_reports.breadcrumbs is 'Letzte Schritte vor dem Fehler (Kategorie, Text, Zeit) - ohne Eingaben und Inhalte.';

create index error_reports_user_id_idx on public.error_reports (user_id);
create index error_reports_organization_id_idx on public.error_reports (organization_id);
create index error_reports_created_at_idx on public.error_reports (created_at);

-- Schutz vor Missbrauch/Fehlerschleifen: hoechstens 30 Berichte pro Nutzer und Stunde.
create function private.limit_error_reports()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.error_reports
    where user_id = new.user_id and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'too many error reports' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;

create trigger limit_error_reports
  before insert on public.error_reports
  for each row execute function private.limit_error_reports();

-- Hat der angemeldete Nutzer aktuell in Absturzberichte eingewilligt?
create function private.has_crash_report_consent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.granted from public.consents c
    where c.user_id = (select auth.uid()) and c.purpose = 'crash_reports'
    order by c.created_at desc
    limit 1
  ), false);
$$;

grant execute on function private.has_crash_report_consent() to authenticated;

alter table public.error_reports enable row level security;
revoke all on public.error_reports from anon;
revoke select, update, delete on public.error_reports from authenticated;

create policy "send own error reports with consent" on public.error_reports
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.has_crash_report_consent())
    and (organization_id is null or organization_id in (select private.my_organization_ids()))
  );

-- ---------------------------------------------------------------------------
-- Aufbewahrung: Berichte nach 90 Tagen loeschen (taeglich 03:30 UTC).
-- ---------------------------------------------------------------------------

create function private.purge_old_error_reports()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.error_reports where created_at < now() - interval '90 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function private.purge_old_error_reports() is 'Loescht Fehlerberichte, die aelter als 90 Tage sind.';

select cron.schedule(
  'purge-old-error-reports',
  '30 3 * * *',
  $$select private.purge_old_error_reports()$$
);

-- ---------------------------------------------------------------------------
-- Datenexport um Fehlerberichte erweitern (Auskunftsrecht).
-- ---------------------------------------------------------------------------

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at)
                from auth.users u where u.id = uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object('organization', o.name, 'kind', o.kind, 'role', r.key, 'since', m.created_at)
                       order by m.created_at)
      from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      join public.roles r on r.id = m.role_id
      where m.user_id = uid), '[]'::jsonb),
    'consents', coalesce((
      select jsonb_agg(jsonb_build_object('purpose', c.purpose, 'granted', c.granted,
                                          'text_version', c.text_version, 'created_at', c.created_at)
                       order by c.created_at)
      from public.consents c where c.user_id = uid), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('action', a.action, 'entity', a.entity, 'created_at', a.created_at)
                       order by a.created_at)
      from public.audit_log a where a.actor_id = uid), '[]'::jsonb),
    'error_reports', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.short_id, 'level', e.level, 'message', e.message,
                                          'app_version', e.app_version, 'occurred_at', e.occurred_at)
                       order by e.occurred_at)
      from public.error_reports e where e.user_id = uid), '[]'::jsonb)
  );
end;
$$;

revoke execute on all functions in schema private from public, anon;
