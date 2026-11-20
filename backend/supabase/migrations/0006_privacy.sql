-- 0006 Datenschutz: Einwilligungen, Datenexport, Kontoloeschung mit Karenzzeit.

-- ---------------------------------------------------------------------------
-- Einwilligungen
-- Nur anfuegen, nie aendern: jede Zustimmung und jeder Widerruf ist eine neue Zeile.
-- So ist nachweisbar, wer wann welcher Textversion zugestimmt hat.
-- Bewusst ohne organization_id und updated_at: Einwilligungen gehoeren der Person
-- und werden nicht geaendert.
-- ---------------------------------------------------------------------------

create table public.consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  purpose      text not null check (purpose in ('analytics', 'crash_reports', 'push', 'personalization')),
  granted      boolean not null,
  text_version text not null check (char_length(text_version) between 1 and 50),
  -- clock_timestamp statt now(): eindeutige Reihenfolge auch bei mehreren Eintraegen in einer Transaktion
  created_at   timestamptz not null default clock_timestamp()
);

comment on table public.consents is 'Einwilligungen als Protokoll (nur anfuegen). Aktueller Stand: View current_consents.';
comment on column public.consents.text_version is 'Version des Einwilligungstextes, dem zugestimmt bzw. widersprochen wurde.';

create index consents_user_purpose_idx on public.consents (user_id, purpose, created_at desc);

alter table public.consents enable row level security;
revoke all on public.consents from anon;
revoke update, delete on public.consents from authenticated;

create policy "read own consents" on public.consents
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "add own consents" on public.consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Aktueller Stand je Zweck (letzte Zeile). security_invoker: RLS der Tabelle gilt auch hier.
create view public.current_consents with (security_invoker = true) as
  select distinct on (user_id, purpose) user_id, purpose, granted, text_version, created_at
  from public.consents
  order by user_id, purpose, created_at desc;

comment on view public.current_consents is 'Letzter Stand jeder Einwilligung je Nutzer und Zweck.';

revoke all on public.current_consents from anon;
grant select on public.current_consents to authenticated;

-- ---------------------------------------------------------------------------
-- Kontoloeschung: sofort deaktivieren (status = deleted), nach 30 Tagen endgueltig loeschen.
-- ---------------------------------------------------------------------------

alter table public.profiles add column deletion_requested_at timestamptz;
comment on column public.profiles.deletion_requested_at is 'Zeitpunkt des Loeschantrags; endgueltige Loeschung 30 Tage danach.';

-- Loeschung beantragen. Liefert das Datum der endgueltigen Loeschung.
create function public.request_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  owner_role uuid := private.system_role_id('owner');
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Einziger Eigentuemer eines Teams mit weiteren Mitgliedern? Dann erst Rolle uebertragen.
  if exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = uid
      and m.role_id = owner_role
      and o.kind = 'team'
      and not exists (select 1 from public.organization_members x
                      where x.organization_id = m.organization_id and x.role_id = owner_role and x.user_id <> uid)
      and exists (select 1 from public.organization_members y
                  where y.organization_id = m.organization_id and y.user_id <> uid)
  ) then
    raise exception 'user is the last owner of a team organization'
      using errcode = 'P0001', hint = 'last_owner';
  end if;

  update public.profiles
  set status = 'deleted', deletion_requested_at = now()
  where id = uid;

  perform private.write_audit(null, 'account.deletion_requested', 'profiles', uid);
  return now() + interval '30 days';
end;
$$;

comment on function public.request_account_deletion() is 'Kontoloeschung beantragen (30 Tage Karenz). Fehler last_owner, wenn ein Team sonst ohne Eigentuemer bliebe.';

-- Loeschung abbrechen (innerhalb der Karenzzeit).
create function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.profiles
  set status = 'active', deletion_requested_at = null
  where id = uid and status = 'deleted';

  perform private.write_audit(null, 'account.deletion_cancelled', 'profiles', uid);
end;
$$;

comment on function public.cancel_account_deletion() is 'Beantragte Kontoloeschung abbrechen.';

-- Endgueltige Loeschung nach Ablauf der Karenzzeit (taeglicher Job, siehe unten).
-- Loescht persoenliche Organisationen und Teams ohne weitere Mitglieder, danach den Nutzer;
-- alles Weitere folgt per "on delete cascade".
create function private.purge_deleted_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  doomed uuid[];
  purged integer;
begin
  select coalesce(array_agg(id), '{}') into doomed
  from public.profiles
  where status = 'deleted' and deletion_requested_at < now() - interval '30 days';

  delete from public.organizations o
  where o.kind = 'personal' and o.created_by = any (doomed);

  delete from public.organizations o
  where o.kind = 'team'
    and exists (select 1 from public.organization_members m
                where m.organization_id = o.id and m.user_id = any (doomed))
    and not exists (select 1 from public.organization_members m
                    where m.organization_id = o.id and not (m.user_id = any (doomed)));

  delete from auth.users u where u.id = any (doomed);
  get diagnostics purged = row_count;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id)
  select null, null, 'account.purged', 'profiles', unnest(doomed);

  return purged;
end;
$$;

comment on function private.purge_deleted_accounts() is 'Loescht Konten 30 Tage nach dem Loeschantrag endgueltig.';

-- ---------------------------------------------------------------------------
-- Datenexport: alle Daten der angemeldeten Person als JSON.
-- Fachanwendungen erweitern diese Funktion um ihre eigenen Tabellen.
-- ---------------------------------------------------------------------------

create function public.export_my_data()
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
      from public.audit_log a where a.actor_id = uid), '[]'::jsonb)
  );
end;
$$;

comment on function public.export_my_data() is 'Datenexport (Art. 20 DSGVO) fuer die angemeldete Person.';

-- Nur angemeldete Nutzer duerfen die oeffentlichen Funktionen aufrufen.
revoke execute on function public.request_account_deletion() from public, anon;
revoke execute on function public.cancel_account_deletion() from public, anon;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.export_my_data() to authenticated;
revoke execute on all functions in schema private from public, anon;

-- ---------------------------------------------------------------------------
-- Taeglicher Loeschjob (pg_cron), 03:15 UTC.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'purge-deleted-accounts',
  '15 3 * * *',
  $$select private.purge_deleted_accounts()$$
);
