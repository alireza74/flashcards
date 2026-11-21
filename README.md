# base-app

Wiederverwendbare Basis fuer eigene Apps (iOS, Android, Web): Anmeldung, Organisationen,
Rollen und Rechte, Profil, drei Sprachen inkl. Persisch (RTL), Datenschutzfunktionen,
Tests, CI und Auslieferung. Fachliche Apps entstehen als Klon - siehe [docs/KLONEN.md](docs/KLONEN.md).

**Technik:** Expo / React Native (TypeScript) + Supabase (Postgres, Auth, RLS).

## Schnellstart (lokal)

Voraussetzungen: Node.js, Docker (Rancher Desktop).

```
cd backend
npm install
npm run db:start          # Supabase in Docker; Studio: http://localhost:54323

cd ../frontend
npm install
copy .env.example .env.local   # Schluessel aus "npm run db:status" (backend) eintragen
npm run web               # App im Browser: http://localhost:8081
```

Mails (Registrierungs-Codes) landen lokal im Testpostfach: http://localhost:54324

## Pruefungen

| Wo | Befehl | Prueft |
|---|---|---|
| `frontend/` | `npm run check` | Lint, TypeScript, Jest |
| `frontend/` | `npm run build:web` | Web-Build |
| `backend/` | `npm run db:test` | pgTAP: RLS, Mandantentrennung, Rollen, Datenschutz |
| `backend/` | `npm run db:lint` | Datenbank-Linter |
| `backend/` | `npm run db:types` | TypeScript-Typen aus dem Schema neu erzeugen |

Dieselben Pruefungen laufen bei jedem Push in GitHub Actions (`.github/workflows/ci.yml`).

## Struktur

| Ordner | Inhalt |
|---|---|
| `frontend/src/app` | Routen (Expo Router), duenn |
| `frontend/src/core` | Basis: Auth, Profil, Sprache, Datenschutz, Rechtliches, Mindestversion |
| `frontend/src/shared` | Design-Bausteine (`ui/`), Hilfsfunktionen (`lib/`) |
| `frontend/src/features` | Fachfunktionen der Klone |
| `frontend/src/config/app-identity.json` | Name, Kennungen, Farbe - einzige Stelle je Klon |
| `backend/supabase/migrations` | Datenbankschema (Basis: `0001`-`0099`) |
| `backend/supabase/tests` | pgTAP-Tests |
| `backend/supabase/templates` | Mail-Vorlagen (Code statt Link) |
| `.github/workflows` | CI, Deploy Staging, Release Production, Build Android |
| `docs/` | Wissen, Architektur, Lernunterlagen |

## Dokumentation

| Datei | Inhalt |
|---|---|
| [docs/Grundapp-Wissen.md](docs/Grundapp-Wissen.md) | Entscheidungen, wichtiger Code, Fehler und Loesungen, Chronik |
| [docs/Architektur-Grundlage.md](docs/Architektur-Grundlage.md) | recherchiertes Zielbild und Regeln |
| [docs/lernen/](docs/lernen/) | Lernunterlagen je Meilenstein und Anleitungen |
| [docs/KLONEN.md](docs/KLONEN.md) | neue App aus der Basis erstellen, Basis-Aenderungen holen |
| [CHANGELOG.md](CHANGELOG.md) | Aenderungen der Basis |

## Stand

Version **0.2.0** (Git-Tag `v0.2.0`, Aenderungen in [CHANGELOG.md](CHANGELOG.md)).
Im Einsatz auf Staging mit Test-APK; Updates kommen ohne Neuinstallation (EAS Update).
Offen vor Store-Veroeffentlichung: eigener SMTP, juristische Pruefung der Rechtstexte,
App-Name/Icon/Kennung, Produktionsprojekt - siehe `docs/Grundapp-Wissen.md`, Abschnitt "Offene Punkte".

Hinweis: Die Vorlagen-Version (0.2.0) ist unabhaengig von der App-Version in
`frontend/src/config/app-identity.json` (bestimmt, welche Updates zu welchem Build passen).
