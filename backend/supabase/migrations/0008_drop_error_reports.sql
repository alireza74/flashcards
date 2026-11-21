-- 0008 Fehlerberichte-Tabelle wieder entfernen.
--
-- Entscheidung 21.11.2026: Statt Berichte automatisch an den Server zu senden, schreibt die App
-- ein Protokoll auf dem Geraet. Der Nutzer teilt es bei Bedarf selbst (Mail, Messenger).
-- Migration 0007 bleibt unveraendert (sie ist auf Staging bereits eingespielt); diese Migration
-- nimmt sie zurueck.

select cron.unschedule('purge-old-error-reports');

drop table if exists public.error_reports;

drop function if exists private.limit_error_reports();
drop function if exists private.has_crash_report_consent();
drop function if exists private.purge_old_error_reports();

-- Datenexport wieder ohne error_reports (Stand von 0006)
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
      from public.audit_log a where a.actor_id = uid), '[]'::jsonb)
  );
end;
$$;
