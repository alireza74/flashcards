# Anleitung: neue Tabelle anlegen

Beispiel: eine Tabelle `notes` (Notizen innerhalb einer Organisation).
Regel: **Migration + Policy + Test im selben Commit.** Nie im Studio aendern.

## 1. Migration anlegen

In `backend/`:

```
npx supabase migration new notes
```

Das erzeugt `supabase/migrations/<zeitstempel>_notes.sql`.
(In der base-app selbst stattdessen die naechste Basisnummer verwenden, z. B. `0006_notes.sql`.)

## 2. Tabelle schreiben

```sql
create table public.notes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  body            text,
  created_by      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.notes is 'Notizen einer Organisation.';

create index notes_organization_id_idx on public.notes (organization_id);

create trigger set_updated_at before update on public.notes
  for each row execute function private.set_updated_at();
```

Pflicht in jeder Tabelle:
- `organization_id` als erste Fachspalte, mit Index
- `id`, `created_at`, `updated_at` (+ Trigger)
- `comment on table`
- `on delete` bewusst waehlen: `cascade` (mitloeschen) oder `set null` (behalten)

## 3. Recht anlegen (falls neues Recht noetig)

```sql
insert into public.permissions (key, description) values
  ('notes.write', 'Notizen anlegen und bearbeiten');

-- welche Rollen bekommen es?
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.organization_id is null and r.key in ('owner', 'admin', 'member')
  and p.key = 'notes.write';
```

## 4. RLS und Policies

```sql
alter table public.notes enable row level security;
revoke all on public.notes from anon;

create policy "members read notes" on public.notes
  for select to authenticated
  using (organization_id in (select private.my_organization_ids()));

create policy "write notes with permission" on public.notes
  for insert to authenticated
  with check ((select private.has_permission(organization_id, 'notes.write')));

create policy "update notes with permission" on public.notes
  for update to authenticated
  using ((select private.has_permission(organization_id, 'notes.write')))
  with check ((select private.has_permission(organization_id, 'notes.write')));

create policy "delete notes with permission" on public.notes
  for delete to authenticated
  using ((select private.has_permission(organization_id, 'notes.write')));
```

`using` = welche bestehenden Zeilen betroffen sein duerfen,
`with check` = wie die Zeile nach dem Schreiben aussehen darf.

## 5. Test schreiben

Neue Datei `supabase/tests/database/10_notes.test.sql`, Vorlage: `03_tenant_isolation.test.sql`.
Mindestens pruefen:
- Nutzer A sieht Notizen von Organisation B nicht.
- Nutzer A kann keine Notiz in Organisation B anlegen (`throws_ok ... '42501'`).
- Mitglied mit Recht kann in der eigenen Organisation anlegen (`lives_ok`).

## 6. Ausfuehren

In `backend/`:

```
npm run db:reset     # Datenbank frisch aus allen Migrationen
npm run db:test      # alle Tests, auch der neue
npm run db:lint      # Datenbank-Linter
npm run db:types     # TypeScript-Typen neu erzeugen
```

Test `01_security_baseline` schlaegt automatisch an, wenn RLS, Policy oder Kommentar fehlen.

## 7. Committen

Migration, Test und `frontend/src/core/supabase/database.types.ts` zusammen committen.
Die CI prueft dasselbe und ausserdem, ob die Typen zum Schema passen.
