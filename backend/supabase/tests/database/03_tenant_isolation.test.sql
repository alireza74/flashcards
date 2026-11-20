-- Mandantentrennung: Alice sieht und aendert nichts von Bob. Wichtigster Test -
-- ein Fehler hier waere ein Datenleck.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test', '{"display_name": "Bob"}');

-- IDs der persoenlichen Organisationen fuer die Tests bereitstellen
create temporary table org_ids as
  select created_by as user_id, id from public.organizations;
grant select on org_ids to authenticated;

-- ---- als Alice ----
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select results_eq(
  $$ select count(*)::int from public.organizations $$,
  array[1],
  'Alice sieht genau eine Organisation (ihre eigene)'
);

select is_empty(
  $$ select id from public.organizations
     where id = (select id from org_ids where user_id = '22222222-2222-2222-2222-222222222222') $$,
  'Alice sieht Bobs Organisation nicht'
);

select is_empty(
  $$ select id from public.profiles where id = '22222222-2222-2222-2222-222222222222' $$,
  'Alice sieht Bobs Profil nicht'
);

select is_empty(
  $$ select id from public.organization_members where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'Alice sieht Bobs Mitgliedschaft nicht'
);

select is_empty(
  $$ select id from public.audit_log
     where organization_id = (select id from org_ids where user_id = '22222222-2222-2222-2222-222222222222') $$,
  'Alice sieht Bobs Protokoll nicht'
);

select is_empty(
  $$ update public.organizations set name = 'gehackt'
     where id = (select id from org_ids where user_id = '22222222-2222-2222-2222-222222222222')
     returning id $$,
  'Alice kann Bobs Organisation nicht umbenennen'
);

select is_empty(
  $$ delete from public.organization_members
     where user_id = '22222222-2222-2222-2222-222222222222' returning id $$,
  'Alice kann Bobs Mitgliedschaft nicht loeschen'
);

select throws_ok(
  $$ update public.profiles
     set active_organization_id = (select id from org_ids where user_id = '22222222-2222-2222-2222-222222222222')
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'Alice kann Bobs Organisation nicht als aktive Organisation setzen'
);

select throws_ok(
  $$ update public.profiles set status = 'locked' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'Alice kann ihren Status nicht selbst aendern (Spaltenrecht)'
);

select lives_ok(
  $$ update public.profiles set display_name = 'Alice B.' where id = '11111111-1111-1111-1111-111111111111' $$,
  'Alice kann ihren Anzeigenamen aendern'
);

select throws_ok(
  $$ insert into public.organizations (name) values ('Neue Firma') $$,
  '42501', null,
  'Organisationen lassen sich nicht direkt ueber die API anlegen'
);

-- ---- ohne Anmeldung (anon) ----
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  $$ select id from public.organizations $$,
  '42501', null,
  'anon hat keinen Zugriff auf Organisationen'
);

select throws_ok(
  $$ select id from public.profiles $$,
  '42501', null,
  'anon hat keinen Zugriff auf Profile'
);

select results_eq(
  $$ select key from public.app_settings $$,
  array['min_app_version'],
  'anon liest oeffentliche Einstellungen (Mindestversion)'
);

reset role;
select * from finish();
rollback;
