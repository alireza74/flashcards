-- Rollen in einer Team-Organisation: Alice = owner, Carol = admin, Bob = member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test',   '{"display_name": "Bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.test', '{"display_name": "Carol"}');

insert into public.organizations (id, name, kind, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Team A', 'team', '11111111-1111-1111-1111-111111111111');

insert into public.organization_members (organization_id, user_id, role_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', private.system_role_id('owner')),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', private.system_role_id('admin')),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', private.system_role_id('member'));

create temporary table role_ids as
  select key, id from public.roles where organization_id is null;
create temporary table personal_orgs as
  select created_by as user_id, id from public.organizations where kind = 'personal';
grant select on role_ids, personal_orgs to authenticated;

set local role authenticated;

-- ---- Bob (member) ----
select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select results_eq(
  $$ select count(*)::int from public.organization_members
     where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  array[3],
  'Mitglied sieht alle Mitglieder des Teams (members.read)'
);

select results_eq(
  $$ select count(*)::int from public.profiles $$,
  array[3],
  'Mitglied sieht die Profile seiner Team-Kollegen'
);

select is_empty(
  $$ update public.organizations set name = 'X'
     where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning id $$,
  'Mitglied kann das Team nicht umbenennen'
);

select is_empty(
  $$ update public.organization_members set role_id = (select id from role_ids where key = 'admin')
     where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and user_id = '22222222-2222-2222-2222-222222222222' returning id $$,
  'Mitglied kann sich nicht selbst zum Admin machen'
);

select is_empty(
  $$ select id from public.audit_log where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'Mitglied sieht das Protokoll nicht (kein audit.read)'
);

-- ---- Carol (admin) ----
select set_config('request.jwt.claims',
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select throws_ok(
  $$ update public.organization_members set role_id = (select id from role_ids where key = 'owner')
     where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and user_id = '33333333-3333-3333-3333-333333333333' $$,
  '42501', null,
  'Admin kann sich nicht selbst zum Eigentuemer machen'
);

select is_empty(
  $$ update public.organization_members set role_id = (select id from role_ids where key = 'member')
     where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and user_id = '11111111-1111-1111-1111-111111111111' returning id $$,
  'Admin kann den Eigentuemer nicht absetzen'
);

select isnt_empty(
  $$ update public.organization_members set role_id = (select id from role_ids where key = 'admin')
     where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and user_id = '22222222-2222-2222-2222-222222222222' returning id $$,
  'Admin kann ein Mitglied zum Admin machen'
);

select results_eq(
  $$ select action, details ->> 'role', details ->> 'old_role' from public.audit_log
     where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and action = 'member.update' $$,
  $$ values ('member.update'::text, 'admin'::text, 'member'::text) $$,
  'Admin sieht die protokollierte Rollenaenderung (audit.read)'
);

select is_empty(
  $$ delete from public.organizations where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning id $$,
  'Admin kann das Team nicht loeschen'
);

-- ---- Alice (owner) ----
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ update public.organization_members set role_id = (select id from role_ids where key = 'member')
     where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and user_id = '11111111-1111-1111-1111-111111111111' $$,
  'P0001', 'organization must keep at least one owner',
  'Letzter Eigentuemer kann sich nicht selbst absetzen'
);

select lives_ok(
  $$ update public.organizations set name = 'Team A neu' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'Eigentuemer kann das Team umbenennen'
);

select is_empty(
  $$ delete from public.organizations
     where id = (select id from personal_orgs where user_id = '11111111-1111-1111-1111-111111111111')
     returning id $$,
  'Persoenliche Organisation laesst sich nicht direkt loeschen'
);

select isnt_empty(
  $$ delete from public.organizations where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning id $$,
  'Eigentuemer kann das Team loeschen (Mitgliedschaften werden mitgeloescht)'
);

reset role;

select is_empty(
  $$ select id from public.organization_members where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'Keine verwaisten Mitgliedschaften nach dem Loeschen'
);

select * from finish();
rollback;
