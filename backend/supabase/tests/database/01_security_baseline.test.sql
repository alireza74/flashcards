-- Grundregeln, die fuer JEDE Tabelle gelten. Schlaegt fehl, sobald jemand eine
-- neue Tabelle ohne RLS, ohne Policy oder ohne Kommentar anlegt.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is_empty(
  $$ select c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'RLS ist auf allen Tabellen in public aktiv'
);

select is_empty(
  $$ select c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and not exists (select 1 from pg_policies p
                       where p.schemaname = 'public' and p.tablename = c.relname) $$,
  'Jede Tabelle in public hat mindestens eine Policy'
);

select is_empty(
  $$ select c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and obj_description(c.oid, 'pg_class') is null $$,
  'Jede Tabelle in public hat einen Kommentar'
);

select is_empty(
  $$ select p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon darf keine Funktion in private ausfuehren'
);

select is_empty(
  $$ select p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.prosecdef
       and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%') $$,
  'Jede security-definer-Funktion setzt search_path'
);

select results_eq(
  $$ select key from public.roles where organization_id is null order by key $$,
  array['admin', 'member', 'owner'],
  'Systemrollen owner, admin, member existieren'
);

select results_eq(
  $$ select p.key from public.role_permissions rp
     join public.roles r on r.id = rp.role_id
     join public.permissions p on p.id = rp.permission_id
     where r.key = 'admin' and r.organization_id is null order by p.key $$,
  array['audit.read', 'members.manage', 'members.read', 'settings.manage'],
  'Admin hat genau die vorgesehenen Rechte'
);

select results_eq(
  $$ select count(*)::int from public.role_permissions rp
     join public.roles r on r.id = rp.role_id where r.key = 'owner' $$,
  $$ select count(*)::int from public.permissions $$,
  'Eigentuemer hat alle Rechte'
);

select * from finish();
rollback;
