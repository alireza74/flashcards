-- 0003 Organisationen (Mandanten), Mitgliedschaften, Profile
--      und die zentralen Berechtigungsfunktionen.

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 200),
  kind       text not null default 'team' check (kind in ('personal', 'team')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is 'Mandanten. Jeder Nutzer bekommt bei der Registrierung eine persoenliche Organisation (kind = personal).';
comment on column public.organizations.kind is 'personal = automatisch angelegt, nur ein Mitglied; team = gemeinsame Organisation.';

create index organizations_created_by_idx on public.organizations (created_by);

alter table public.roles
  add constraint roles_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete cascade;

create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role_id         uuid not null references public.roles (id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

comment on table public.organization_members is 'Wer ist in welcher Organisation mit welcher Rolle. Rollen gelten pro Organisation.';

create index organization_members_user_id_idx on public.organization_members (user_id);
create index organization_members_role_id_idx on public.organization_members (role_id);

create table public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  display_name           text check (char_length(display_name) <= 100),
  locale                 text not null default 'de' check (locale in ('de', 'en', 'fa')),
  time_zone              text not null default 'Europe/Berlin',
  status                 text not null default 'active' check (status in ('active', 'locked', 'deleted')),
  active_organization_id uuid references public.organizations (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.profiles is 'Profil je Nutzer (id = auth.users.id). Nur E-Mail (in auth) und Anzeigename sind personenbezogen.';
comment on column public.profiles.status is 'active, locked (gesperrt), deleted (Loeschung beantragt, Karenzzeit). Nur serverseitig aenderbar.';
comment on column public.profiles.active_organization_id is 'Zuletzt gewaehlte Organisation; die App startet darin.';

create index profiles_active_organization_id_idx on public.profiles (active_organization_id);

create trigger set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.organization_members
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Berechtigungsfunktionen
-- security definer: laufen mit den Rechten des Eigentuemers und umgehen RLS.
-- Das verhindert Endlosschleifen (Policy auf organization_members fragt organization_members ab).
-- set search_path = '': schuetzt vor untergeschobenen Objekten gleichen Namens.
-- ---------------------------------------------------------------------------

-- Alle Organisationen, in denen der angemeldete Nutzer Mitglied ist.
create function private.my_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.organization_members
  where user_id = (select auth.uid());
$$;

-- Hat der angemeldete Nutzer in Organisation org das Recht permission_key?
create function private.has_permission(org uuid, permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.role_permissions rp on rp.role_id = m.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.organization_id = org
      and m.user_id = (select auth.uid())
      and p.key = permission_key
  );
$$;

-- Alle Nutzer, die mit dem angemeldeten Nutzer mindestens eine Organisation teilen (inkl. ihm selbst).
create function private.my_colleague_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct m.user_id
  from public.organization_members m
  where m.organization_id in (select private.my_organization_ids());
$$;

comment on function private.my_organization_ids() is 'Organisationen des angemeldeten Nutzers; Grundlage fuer Lese-Policies.';
comment on function private.has_permission(uuid, text) is 'Prueft ein Recht des angemeldeten Nutzers in einer Organisation.';
comment on function private.my_colleague_ids() is 'Nutzer, die eine Organisation mit dem angemeldeten Nutzer teilen.';

-- ---------------------------------------------------------------------------
-- Schutz: Eine Organisation behaelt immer mindestens einen Eigentuemer.
-- Ausnahme: Die Zeile verschwindet durch Loeschen der Organisation oder des Nutzers (Kaskade).
-- ---------------------------------------------------------------------------

create function private.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_role uuid := private.system_role_id('owner');
begin
  if old.role_id = owner_role
     and (tg_op = 'DELETE' or new.role_id <> owner_role)
     and exists (select 1 from public.organizations where id = old.organization_id)
     and exists (select 1 from auth.users where id = old.user_id)
     and not exists (
       select 1 from public.organization_members
       where organization_id = old.organization_id
         and role_id = owner_role
         and id <> old.id
     )
  then
    raise exception 'organization must keep at least one owner'
      using errcode = 'P0001', hint = 'last_owner';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger prevent_last_owner_removal
  before update or delete on public.organization_members
  for each row execute function private.prevent_last_owner_removal();

-- ---------------------------------------------------------------------------
-- Rechte auf die Funktionen: nur angemeldete Nutzer (fuer Policies).
-- ---------------------------------------------------------------------------

grant execute on function private.my_organization_ids() to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.my_colleague_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Muster: (select ...) um Funktionsaufrufe -> wird einmal pro Abfrage ausgewertet.
-- Kein Insert ueber die API: Organisationen und Mitgliedschaften entstehen
-- bei der Registrierung (0004) bzw. spaeter ueber Einladungen.
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.profiles enable row level security;

revoke all on public.organizations, public.organization_members, public.profiles from anon;

-- Spaltenrechte: nur diese Spalten darf die App aendern.
revoke insert, update on public.organizations from authenticated;
grant update (name) on public.organizations to authenticated;

revoke insert, update on public.organization_members from authenticated;
grant update (role_id) on public.organization_members to authenticated;

revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, locale, time_zone, active_organization_id) on public.profiles to authenticated;

-- organizations
create policy "members read organization" on public.organizations
  for select to authenticated
  using (id in (select private.my_organization_ids()));

create policy "manage organization" on public.organizations
  for update to authenticated
  using ((select private.has_permission(id, 'organization.manage')))
  with check ((select private.has_permission(id, 'organization.manage')));

create policy "delete team organization" on public.organizations
  for delete to authenticated
  using (kind = 'team' and (select private.has_permission(id, 'organization.delete')));

-- organization_members
create policy "read members" on public.organization_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_permission(organization_id, 'members.read'))
  );

-- Eigentuemer-Zeilen und die Eigentuemer-Rolle darf nur aendern, wer organization.manage hat.
-- So kann ein Admin sich nicht selbst zum Eigentuemer machen und keinen Eigentuemer absetzen.
create policy "manage members" on public.organization_members
  for update to authenticated
  using (
    (select private.has_permission(organization_id, 'members.manage'))
    and (
      role_id <> (select private.system_role_id('owner'))
      or (select private.has_permission(organization_id, 'organization.manage'))
    )
  )
  with check (
    (select private.has_permission(organization_id, 'members.manage'))
    and (
      role_id <> (select private.system_role_id('owner'))
      or (select private.has_permission(organization_id, 'organization.manage'))
    )
  );

create policy "remove members" on public.organization_members
  for delete to authenticated
  using (
    (select private.has_permission(organization_id, 'members.manage'))
    and (
      role_id <> (select private.system_role_id('owner'))
      or (select private.has_permission(organization_id, 'organization.manage'))
    )
  );

-- profiles
create policy "read own and colleague profiles" on public.profiles
  for select to authenticated
  using (id in (select private.my_colleague_ids()) or id = (select auth.uid()));

create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (
      active_organization_id is null
      or active_organization_id in (select private.my_organization_ids())
    )
  );

-- roles: zusaetzlich eigene Rollen der eigenen Organisationen lesbar
create policy "members read organization roles" on public.roles
  for select to authenticated
  using (organization_id in (select private.my_organization_ids()));
