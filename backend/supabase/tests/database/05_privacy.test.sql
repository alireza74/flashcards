-- Datenschutz: Einwilligungen, Datenexport, Kontoloeschung mit Karenz und Loeschjob.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test',   '{"display_name": "Bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.test', '{"display_name": "Carol"}');

-- Carol ist einzige Eigentuemerin eines Teams, in dem Bob Mitglied ist.
insert into public.organizations (id, name, kind, created_by) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Team C', 'team', '33333333-3333-3333-3333-333333333333');
insert into public.organization_members (organization_id, user_id, role_id) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', private.system_role_id('owner')),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', private.system_role_id('member'));

set local role authenticated;

-- ---- Einwilligungen (Alice) ----
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.consents (purpose, granted, text_version) values ('analytics', true, 'v1') $$,
  'Alice erteilt eine Einwilligung'
);
select lives_ok(
  $$ insert into public.consents (purpose, granted, text_version) values ('analytics', false, 'v1') $$,
  'Alice widerruft (neue Zeile)'
);
select results_eq(
  $$ select granted from public.current_consents where purpose = 'analytics' $$,
  array[false],
  'Aktueller Stand ist der letzte Eintrag (widerrufen)'
);
select throws_ok(
  $$ insert into public.consents (user_id, purpose, granted, text_version)
     values ('22222222-2222-2222-2222-222222222222', 'analytics', true, 'v1') $$,
  '42501', null,
  'Alice kann keine Einwilligung fuer Bob anlegen'
);
select throws_ok(
  $$ update public.consents set granted = true $$,
  '42501', null,
  'Einwilligungen lassen sich nicht nachtraeglich aendern'
);

-- ---- Export (Alice) ----
select results_eq(
  $$ select public.export_my_data() -> 'account' ->> 'email' $$,
  array['alice@example.test'],
  'Export enthaelt die eigene E-Mail'
);
select results_eq(
  $$ select jsonb_array_length(public.export_my_data() -> 'consents') $$,
  array[2],
  'Export enthaelt beide Einwilligungs-Eintraege'
);
select ok(
  position('bob@example.test' in public.export_my_data()::text) = 0,
  'Export enthaelt keine Daten anderer Nutzer'
);

-- ---- Loeschung beantragen und abbrechen (Alice) ----
select ok(
  public.request_account_deletion() > now() + interval '29 days',
  'Loeschantrag liefert Datum in 30 Tagen'
);
select results_eq(
  $$ select status from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  array['deleted'],
  'Profil ist als geloescht markiert'
);
select lives_ok($$ select public.cancel_account_deletion() $$, 'Loeschung abbrechen');
select results_eq(
  $$ select status, deletion_requested_at is null from public.profiles
     where id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('active'::text, true) $$,
  'Nach Abbruch wieder aktiv'
);

-- ---- Letzte Eigentuemerin (Carol) ----
select set_config('request.jwt.claims',
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.request_account_deletion() $$,
  'P0001', 'user is the last owner of a team organization',
  'Einzige Eigentuemerin eines Teams mit Mitgliedern kann nicht loeschen'
);

-- ---- anon ----
reset role;
set local role anon;
select throws_ok($$ select public.request_account_deletion() $$, '42501', null, 'anon darf keine Loeschung beantragen');
select throws_ok($$ select public.export_my_data() $$, '42501', null, 'anon darf nicht exportieren');

-- ---- Loeschjob ----
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select public.request_account_deletion();
reset role;

select results_eq(
  $$ select private.purge_deleted_accounts() $$,
  array[0],
  'Innerhalb der Karenz wird nichts geloescht'
);

update public.profiles set deletion_requested_at = now() - interval '31 days'
where id = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$ select private.purge_deleted_accounts() $$,
  array[1],
  'Nach 30 Tagen wird das Konto geloescht'
);
select is_empty(
  $$ select id from auth.users where id = '11111111-1111-1111-1111-111111111111' $$,
  'Nutzer ist aus auth.users entfernt'
);
select is_empty(
  $$ select id from public.organizations where created_by = '11111111-1111-1111-1111-111111111111' or name = 'Alice' $$,
  'Persoenliche Organisation ist entfernt'
);
select isnt_empty(
  $$ select id from auth.users where id = '22222222-2222-2222-2222-222222222222' $$,
  'Andere Nutzer bleiben erhalten'
);
select isnt_empty(
  $$ select id from public.audit_log where action = 'account.purged' $$,
  'Endgueltige Loeschung ist protokolliert'
);
select results_eq(
  $$ select count(*)::int from cron.job where jobname = 'purge-deleted-accounts' $$,
  array[1],
  'Taeglicher Loeschjob ist eingeplant'
);

select * from finish();
rollback;
