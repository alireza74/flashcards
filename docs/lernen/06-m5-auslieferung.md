# 06 - M5: Auslieferung (Staging, Produktion, APK, Updates)

Stand: 20.11.2026. Code und Workflows sind fertig. **Aktiv werden sie erst nach der einmaligen
Einrichtung unten** (Konten anlegen, Zugangsdaten hinterlegen) - das geht nur mit deinen Konten.

## Ueberblick

```
Push auf main
  -> CI (Lint, Typen, Tests, Datenbank-Tests)            .github/workflows/ci.yml
  -> gruen? -> Deploy Staging                             .github/workflows/deploy-staging.yml
              1. Migrationen auf Staging-Supabase
              2. EAS Update an Kanal "preview" (alle Test-APKs bekommen den neuen JS-Code)

Manuell: Build Android -> APK auf Expo-Servern           .github/workflows/build-android.yml
Manuell: Release Production ("freigeben" eintippen)      .github/workflows/release-production.yml
              1. Migrationen auf Produktion
              2. EAS Update Kanal "production" ODER Store-Build (AAB)
```

| Begriff | Bedeutung |
|---|---|
| EAS Build | baut die installierbare App (APK/AAB) auf Servern von Expo |
| EAS Update | schickt nur neuen JavaScript-Code an installierte Apps, ohne Store |
| Kanal (channel) | welche Apps welches Update bekommen: `preview` = Test-APKs, `production` = Store-Version |
| runtimeVersion | = App-Version. Updates gehen nur an Builds mit gleicher Version. Neues natives Paket -> Version in `app-identity.json` erhoehen und neu bauen |
| Mindestversion | `app_settings.min_app_version`; aeltere Apps zeigen "Update erforderlich" |

## Einmalige Einrichtung

### 1. Supabase-Projekte (supabase.com)

1. Zwei Projekte anlegen, Region **Frankfurt (eu-central-1)**: `base-app-staging`, `base-app-prod`.
   Datenbank-Passwort jeweils sicher notieren (Passwort-Manager).
2. Je Projekt die **Project Ref** notieren (Settings -> General, z. B. `abcdefghijklmnop`).
3. **Access Token** erzeugen: Account -> Access Tokens.
4. Auth-Einstellungen je Projekt (Authentication -> Settings / Emails), wie lokal in `config.toml`:
   - Confirm email: an; Passwort: min. 8, "letters and digits"; Email OTP length: 6
   - E-Mail-Vorlagen "Confirm signup" und "Reset password": Inhalt aus
     `backend/supabase/templates/confirmation.html` bzw. `recovery.html` uebernehmen
   - **Eigener SMTP-Server** (EU-Anbieter) eintragen - der eingebaute Versand ist nur zum Testen.
5. Erste Migrationen von Hand pruefen (aus `backend/`):
   `npx supabase db push --remote=<ref> --password <db-passwort> --dry-run`

### 2. Expo (expo.dev)

1. Konto anlegen, dann in `frontend/`:
   - `npx eas-cli login`
   - `npx eas-cli init` -> liefert die **Projekt-ID** -> in `src/config/app-identity.json` bei
     `easProjectId` eintragen und committen.
2. Supabase-Werte als EAS-Umgebungsvariablen (je Umgebung, Werte aus Supabase -> Settings -> API):
   ```
   npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<staging-ref>.supabase.co --visibility plaintext
   npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <staging-publishable-key> --visibility plaintext
   ```
   Dasselbe mit `--environment production` und den Werten des Produktionsprojekts.
   (Beide Werte sind oeffentlich - nie den Secret Key eintragen.)
3. **Access Token** fuer GitHub: expo.dev -> Account settings -> Access tokens.

### 3. GitHub (Repository -> Settings)

| Wo | Name | Wert |
|---|---|---|
| Secrets and variables -> Actions -> Secrets | `SUPABASE_ACCESS_TOKEN` | Supabase Access Token |
| ebenda | `EXPO_TOKEN` | Expo Access Token |
| Environments -> `staging` -> Variable | `SUPABASE_PROJECT_REF` | Ref des Staging-Projekts |
| Environments -> `staging` -> Secret | `SUPABASE_DB_PASSWORD` | DB-Passwort Staging |
| Environments -> `production` -> Variable | `SUPABASE_PROJECT_REF` | Ref des Produktionsprojekts |
| Environments -> `production` -> Secret | `SUPABASE_DB_PASSWORD` | DB-Passwort Produktion |
| Secrets and variables -> Actions -> Variables | `STAGING_ENABLED` | `true` |
| ebenda | `PRODUCTION_ENABLED` | `true` (erst wenn Produktion eingerichtet ist) |

`EXPO_TOKEN` kann alternativ auch je Environment hinterlegt werden.

### 4. Erste APK

Actions -> **Build Android** -> Run workflow. Nach ca. 10-20 Minuten steht der Download auf
expo.dev (Projekt -> Builds). APK aufs Handy laden, Installation aus unbekannter Quelle erlauben.
Die App spricht mit **Staging**.

## Alltag

- Code aendern -> Pull Request -> CI gruen -> merge auf `main` -> Staging aktualisiert sich selbst,
  Test-APKs bekommen das Update beim naechsten Start.
- Neues natives Paket (z. B. Kamera): Version in `app-identity.json` erhoehen, neue APK bauen.
- Release: Actions -> **Release Production** -> `update` oder `build`, "freigeben" eintippen.
- Nach einem unvermeidbaren Schema-Bruch: `min_app_version` per Migration erhoehen.

## Backups und Wiederherstellung

Automatische Backups sind kein Wiederherstellungsplan - das Rueckspielen muss einmal geuebt werden.

Eigene Sicherung (zusaetzlich zu den Supabase-Backups), aus `backend/`:
```
npx supabase db dump --remote=<ref> --password <pw> -f backups/schema.sql
npx supabase db dump --remote=<ref> --password <pw> --data-only -f backups/data.sql
```
`backups/` nie committen (enthaelt personenbezogene Daten) - steht in `.gitignore`.

Rueckspielen (in eine lokale Datenbank, aus `backend/`):
1. `npm run db:reset` - frisches Schema aus den Migrationen
2. Startdaten der Migrationen leeren, sonst doppelte Schluessel (das Backup enthaelt sie auch):
   `docker exec supabase_db_base-app psql -U postgres -d postgres -c "truncate public.role_permissions, public.roles, public.permissions, public.app_settings cascade;"`
3. Daten einspielen:
   `docker exec -i supabase_db_base-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 < backups/data.sql`
4. Stichprobe: Zeilen in `auth.users`, `profiles`, `organizations`, `consents` vergleichen; Anmeldung testen.

Status:
- 20.11.2026 lokal geprueft (lokale DB sichern -> zuruecksetzen -> einspielen): Zeilenzahlen gleich,
  Anmeldung mit altem Passwort funktioniert, alle pgTAP-Tests gruen. Erster Versuch ohne Schritt 2
  scheiterte an `app_settings_key_key` - daher Schritt 2.
- Mit Staging-Daten: **noch durchzufuehren**, sobald das Projekt existiert.

Neue Tabellen mit Startdaten aus Migrationen muessen in Schritt 2 ergaenzt werden.

## Bekannte Grenzen

- Pflicht-Pruefer fuer das Environment `production` gibt es bei privaten Repos nur mit GitHub Pro/Team.
  Bis dahin ist die Freigabe: Workflow bewusst starten + "freigeben" eintippen.
- `eas update --environment` setzt eine aktuelle eas-cli voraus (der Workflow nutzt `latest`).
- iOS-Builds brauchen ein Apple-Entwicklerkonto (99 USD/Jahr); vorbereitet, aber nicht eingerichtet.
