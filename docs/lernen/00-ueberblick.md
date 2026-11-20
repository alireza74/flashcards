# 00 - Ueberblick: wie die base-app aufgebaut ist

Stand: M0 (20.11.2026). Wird mit jedem Meilenstein erweitert.

## Die zwei Haelften

```
base-app/
  frontend/    die App (Expo, React Native, TypeScript) - laeuft auf Handy und im Browser
  backend/     Supabase lokal (Datenbank, Anmeldung, API) - laeuft in Docker
  docs/        Wissen, Architektur, diese Lernunterlagen
  .github/     CI: automatische Pruefung bei jedem Push
```

Spaeter spricht die App per HTTPS mit Supabase:

```
Button in der App
  -> Funktion in src/features/<x>/api/   (Supabase-Client, ab M2)
  -> Supabase API (REST, mit Anmelde-Token)
  -> Postgres prueft per RLS-Policy: darf dieser Nutzer das?
  -> Daten zurueck an die App -> Anzeige
```

In M0 gibt es diese Verbindung noch nicht; die App zeigt nur ihren Namen.

## Frontend: wichtige Dateien

| Datei | Wozu |
|---|---|
| `frontend/package.json` | Abhaengigkeiten und Befehle (`npm run ...`) |
| `frontend/app.config.ts` | Expo-Konfiguration: Name, Icons, Splash, Kennungen |
| `frontend/src/config/app-identity.json` | **die** Stelle fuer Name, Version, Kennungen, Farbe |
| `frontend/src/app/` | Routen: jede Datei ist eine Seite (`index.tsx` = Startseite) |
| `frontend/src/core/` | Basis-Funktionen jeder App (Startseite, spaeter Auth, Rechte) |
| `frontend/src/shared/ui/theme.ts` | Farben und Abstaende |
| `frontend/src/shared/lib/version.ts` | Versionsvergleich (fuer Mindestversion in M5), mit Test daneben |
| `frontend/src/README.md` | Regeln fuer die Ordner |

Wie eine Seite entsteht: `src/app/index.tsx` ist die Route `/`. Sie enthaelt keinen
eigenen Code, sondern gibt nur `HomeScreen` aus `src/core/home/home-screen.tsx` weiter.
So bleiben Routen austauschbar und der eigentliche Code liegt geordnet in `src/`.

## Backend: wichtige Dateien

| Datei | Wozu |
|---|---|
| `backend/package.json` | Supabase-CLI als lokale Abhaengigkeit, Befehle `db:start` usw. |
| `backend/supabase/config.toml` | Einstellungen des lokalen Supabase (Ports, Auth, E-Mail) |
| `backend/supabase/migrations/` | Datenbank-Schema als SQL-Dateien (Details: `02-m1-datenbank.md`) |
| `backend/supabase/tests/database/` | pgTAP-Tests: wer darf was sehen und aendern |
| `backend/supabase/functions/` | Edge Functions (spaeter) |

## Pruefungen

| Befehl (in `frontend/`) | Prueft |
|---|---|
| `npm run lint` | Code-Stil und typische Fehler (ESLint) |
| `npm run typecheck` | TypeScript-Typen |
| `npm test` | Jest-Tests (`*.test.ts`) |
| `npm run check` | alle drei nacheinander |
| `npm run build:web` | baut die Web-Version nach `dist/` |

Dieselben Schritte laufen in `.github/workflows/ci.yml` bei jedem Push auf GitHub.
