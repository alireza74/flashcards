-- 0004 Registrierung: Bei jedem neuen Nutzer in auth.users entstehen automatisch
--      1. eine persoenliche Organisation,
--      2. das Profil (mit dieser Organisation als aktiver Organisation),
--      3. die Mitgliedschaft als Eigentuemer.
--
-- Der Anzeigename kommt aus den Metadaten der Registrierung:
--   supabase.auth.signUp({ email, password, options: { data: { display_name: '...' } } })

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id uuid;
  display text := left(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 100);
begin
  insert into public.organizations (name, kind, created_by)
  values (coalesce(display, 'Personal'), 'personal', new.id)
  returning id into new_organization_id;

  insert into public.profiles (id, display_name, active_organization_id)
  values (new.id, display, new_organization_id);

  insert into public.organization_members (organization_id, user_id, role_id)
  values (new_organization_id, new.id, private.system_role_id('owner'));

  return new;
end;
$$;

comment on function private.handle_new_user() is 'Trigger auf auth.users: legt Profil, persoenliche Organisation und Eigentuemer-Mitgliedschaft an.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
