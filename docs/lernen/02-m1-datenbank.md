# 02 - M1: Die Datenbank-Grundlage

Stand: 20.11.2026. Was gebaut wurde, wo es liegt und warum.

## Dateien

| Datei | Inhalt |
|---|---|
| `backend/supabase/migrations/0001_base_helpers.sql` | Schema `private`, Trigger fuer `updated_at` |
| `.../0002_roles_permissions.sql` | `permissions`, `roles`, `role_permissions` + Startwerte |
| `.../0003_organizations_profiles.sql` | `organizations`, `organization_members`, `profiles`, Berechtigungsfunktionen, Schutz "letzter Eigentuemer", RLS |
| `.../0004_signup.sql` | Trigger: Registrierung legt Profil + persoenliche Organisation an |
| `.../0005_settings_audit.sql` | `app_settings`, `feature_flags`, `audit_log` + Protokoll-Trigger |
| `backend/supabase/tests/database/*.test.sql` | pgTAP-Tests (43 Pruefungen) |
| `frontend/src/core/supabase/database.types.ts` | aus dem Schema erzeugte TypeScript-Typen (nie von Hand aendern) |

Migrationen der Basis haben den Nummernkreis `0001`, `0002`, ...; Migrationen einer
Fachanwendung bekommen Zeitstempel (`supabase migration new`) und laufen danach.

## Die Tabellen und wie sie zusammenhaengen

```
auth.users (von Supabase, E-Mail + Passwort)
   |  Trigger bei Registrierung (0004)
   +--> profiles (1:1, Anzeigename, Sprache, aktive Organisation)
   +--> organizations (persoenliche Organisation, kind = personal)
   +--> organization_members (Nutzer + Organisation + Rolle)
                                   |
                         roles --- role_permissions --- permissions
```

- **organizations**: Mandanten. Jeder Nutzer hat mindestens eine (seine persoenliche).
  Spaeter: Team-Organisationen, z. B. ein Elektrobetrieb in WandAkte.
- **organization_members**: wer ist wo Mitglied, mit welcher Rolle. Rollen gelten
  pro Organisation: Alice kann in Team A Eigentuemerin und in Team B nur Mitglied sein.
- **roles / permissions / role_permissions**: Rolle = Buendel von Rechten.

| Rolle | Rechte |
|---|---|
| owner | alle |
| admin | members.read, members.manage, settings.manage, audit.read |
| member | members.read |

- **app_settings**: z. B. `min_app_version`; `is_public = true` ist ohne Login lesbar.
- **feature_flags**: Schalter zum schrittweisen Freischalten.
- **audit_log**: wer hat wann was getan (z. B. Rollenaenderung), keine Inhalte.

## Wie die Sicherheit funktioniert (RLS)

Die App spricht direkt mit der Datenbank. Deshalb entscheidet **die Datenbank selbst**
fuer jede Zeile, ob der angemeldete Nutzer sie sehen oder aendern darf:
Row Level Security (RLS) mit Policies.

Beispiel aus 0003:

```sql
create policy "members read organization" on public.organizations
  for select to authenticated
  using (id in (select private.my_organization_ids()));
```

Lies: "Angemeldete Nutzer duerfen eine Organisation lesen, wenn ihre ID unter
den eigenen Organisationen ist." Alle anderen Zeilen sind fuer diesen Nutzer unsichtbar,
als gaebe es sie nicht.

Die drei Hilfsfunktionen in `private`:

| Funktion | Liefert |
|---|---|
| `private.my_organization_ids()` | IDs aller eigenen Organisationen |
| `private.has_permission(org, 'recht')` | true, wenn der Nutzer in org dieses Recht hat |
| `private.my_colleague_ids()` | Nutzer, die eine Organisation mit mir teilen |

Policies fragen **Rechte** ab, nie Rollen. Eine neue Rolle "Buchhaltung" ist daher nur
ein neuer Datensatz in `roles` + `role_permissions`, keine Codeaenderung.

Zusaetzliche Schutzschichten:
- **Spaltenrechte**: Ein Nutzer darf an seinem Profil nur `display_name`, `locale`,
  `time_zone`, `active_organization_id` aendern, nicht `status`.
- **Kein Insert ueber die API** fuer Organisationen und Mitgliedschaften; sie entstehen
  ueber den Registrierungs-Trigger (spaeter: Einladungen).
- **Letzter Eigentuemer**: Ein Trigger verhindert, dass eine Organisation ohne Eigentuemer bleibt.
- **Admin-Grenze**: Ein Admin kann sich nicht selbst zum Eigentuemer machen und
  keinen Eigentuemer absetzen.
- `anon` (nicht angemeldet) sieht nur `app_settings` (oeffentliche) und `feature_flags`.

## Die Tests

`npm run db:test` in `backend/` fuehrt alle Dateien in `supabase/tests/database/` aus.
Jede Datei startet eine Transaktion, legt Testnutzer an, meldet sich als dieser Nutzer
an und prueft, was er sehen und tun kann. Am Ende `rollback`: nichts bleibt zurueck.

So meldet sich ein Test als Alice an:

```sql
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
```

| Datei | Prueft |
|---|---|
| `01_security_baseline` | jede Tabelle hat RLS, Policy, Kommentar; anon darf keine private-Funktion |
| `02_signup` | Registrierung legt Profil, Organisation, Eigentuemer-Rolle, Protokoll an |
| `03_tenant_isolation` | Alice sieht und aendert nichts von Bob; anon sieht nichts |
| `04_roles_permissions` | was owner, admin, member im Team duerfen und was nicht |

Gegenprobe am 20.11.2026: Eine absichtlich zu offene Policy liess Test 03 sofort rot werden.

## Selbst nachsehen

1. Rancher Desktop laeuft, dann in `backend/`: `npm run db:start`
2. Studio: `http://localhost:54323` -> Table Editor -> Schema `public`
3. Oder in VS Code mit der PostgreSQL-Erweiterung: `localhost:54322`, `postgres/postgres`
4. Studio -> Authentication -> "Add user" legt einen Nutzer an; danach in `profiles`,
   `organizations`, `organization_members` nachsehen, was der Trigger erzeugt hat.

Beispielabfrage im SQL-Editor:

```sql
select r.key as rolle, p.key as recht
from public.role_permissions rp
join public.roles r on r.id = rp.role_id
join public.permissions p on p.id = rp.permission_id
order by 1, 2;
```
