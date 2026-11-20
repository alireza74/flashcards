-- Registrierung: neuer Nutzer bekommt Profil, persoenliche Organisation und Eigentuemer-Rolle.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test', '{}');

select results_eq(
  $$ select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  array['Alice'],
  'Profil mit Anzeigename aus den Metadaten angelegt'
);

select results_eq(
  $$ select name, kind from public.organizations
     where created_by = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('Alice'::text, 'personal'::text) $$,
  'Persoenliche Organisation angelegt'
);

select results_eq(
  $$ select r.key from public.organization_members m
     join public.roles r on r.id = m.role_id
     where m.user_id = '11111111-1111-1111-1111-111111111111' $$,
  array['owner'],
  'Nutzer ist Eigentuemer seiner persoenlichen Organisation'
);

select results_eq(
  $$ select p.active_organization_id from public.profiles p
     where p.id = '11111111-1111-1111-1111-111111111111' $$,
  $$ select o.id from public.organizations o
     where o.created_by = '11111111-1111-1111-1111-111111111111' $$,
  'Persoenliche Organisation ist aktive Organisation'
);

select results_eq(
  $$ select action from public.audit_log a
     join public.organizations o on o.id = a.organization_id
     where o.created_by = '11111111-1111-1111-1111-111111111111' $$,
  array['member.insert'],
  'Mitgliedschaft wurde protokolliert'
);

select results_eq(
  $$ select o.name, p.display_name from public.profiles p
     join public.organizations o on o.id = p.active_organization_id
     where p.id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values ('Personal'::text, null::text) $$,
  'Ohne Anzeigename: Organisation heisst Personal, Anzeigename bleibt leer'
);

select * from finish();
rollback;
