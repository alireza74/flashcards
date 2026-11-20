-- 0002 Rollen und Rechte.
--
-- Prinzip: Policies fragen nie nach der Rolle, sondern nach dem Recht
-- (private.has_permission). Neue Rollen sind daher nur neue Datensaetze.
--
-- roles.organization_id = null  -> Systemrolle, in jeder Organisation verfuegbar
-- roles.organization_id = <id>  -> eigene Rolle einer Organisation (spaeter)

create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.permissions is 'Einzelrechte, z. B. members.manage. Fachliche Apps ergaenzen eigene Rechte per Migration.';
comment on column public.permissions.key is 'Technischer Schluessel <bereich>.<aktion>; wird in Policies abgefragt.';

create table public.roles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid,  -- Fremdschluessel folgt in 0003, wenn organizations existiert
  key             text not null check (key ~ '^[a-z_]+$'),
  name            text not null,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique nulls not distinct (organization_id, key)
);

comment on table public.roles is 'Rollen; organization_id null = Systemrolle fuer alle Organisationen.';
comment on column public.roles.key is 'Technischer Schluessel, z. B. owner, admin, member.';

create index roles_organization_id_idx on public.roles (organization_id);

create table public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (role_id, permission_id)
);

comment on table public.role_permissions is 'Welche Rolle welches Recht hat.';

create index role_permissions_permission_id_idx on public.role_permissions (permission_id);

create trigger set_updated_at before update on public.permissions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.roles
  for each row execute function private.set_updated_at();

-- Startwerte (gehoeren in die Migration, damit sie auch auf Staging/Produktion existieren)

insert into public.permissions (key, description) values
  ('organization.manage', 'Organisation bearbeiten, Eigentuemer-Rolle vergeben'),
  ('organization.delete', 'Organisation loeschen'),
  ('members.read',        'Mitglieder der Organisation sehen'),
  ('members.manage',      'Rollen von Mitgliedern aendern, Mitglieder entfernen'),
  ('settings.manage',     'Einstellungen der Organisation aendern'),
  ('audit.read',          'Protokoll der Organisation lesen');

insert into public.roles (key, name, description) values
  ('owner',  'Eigentuemer',    'Alle Rechte inklusive Loeschen der Organisation'),
  ('admin',  'Administrator',  'Verwaltet Mitglieder und Einstellungen'),
  ('member', 'Mitglied',       'Normales Mitglied');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
     (r.key = 'owner')
  or (r.key = 'admin'  and p.key in ('members.read', 'members.manage', 'settings.manage', 'audit.read'))
  or (r.key = 'member' and p.key in ('members.read'))
where r.organization_id is null;

-- Liefert die ID einer Systemrolle, z. B. private.system_role_id('owner').
create function private.system_role_id(role_key text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.roles where key = role_key and organization_id is null;
$$;

comment on function private.system_role_id(text) is 'ID einer Systemrolle anhand ihres Schluessels.';

grant execute on function private.system_role_id(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Katalogtabellen: angemeldete Nutzer duerfen lesen, schreiben nur per Migration.
-- ---------------------------------------------------------------------------

alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;

revoke all on public.permissions, public.roles, public.role_permissions from anon;
revoke insert, update, delete on public.permissions, public.roles, public.role_permissions from authenticated;

create policy "authenticated read permissions" on public.permissions
  for select to authenticated
  using (true);

-- Policy fuer eigene Rollen einer Organisation folgt in 0003 (braucht my_organization_ids).
create policy "authenticated read system roles" on public.roles
  for select to authenticated
  using (organization_id is null);

create policy "authenticated read role permissions" on public.role_permissions
  for select to authenticated
  using (role_id in (select id from public.roles));
