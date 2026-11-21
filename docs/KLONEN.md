# Neue App aus der base-app erstellen

Jede Fachanwendung (z. B. Sprachlern-App, WandAkte) ist ein **eigenes Repository** als Klon der
base-app. Verbesserungen der Basis holt sich der Klon spaeter per `upstream`.
Ablauf am 20.11.2026 im Test nachgestellt (Klon, Fachfunktion, Basis-Aenderung, Merge ohne Konflikt).

## 1. Klonen

```
cd C:\Users\alh\Documents\MY-APPS
git clone https://github.com/alireza74/base-app.git vokabel-app
cd vokabel-app
git remote rename origin upstream
```

Auf GitHub ein neues, leeres privates Repository anlegen (ohne README), dann:

```
git remote add origin https://alireza74@github.com/alireza74/vokabel-app.git
git push -u origin main
git config user.email "52157626+alireza74@users.noreply.github.com"
```

Nicht `git push --tags` verwenden: Die Versions-Tags der Basis (v0.2.0 ...) gehoeren nicht ins
Repo der Fachanwendung, sie bekommt eigene Versionsnummern.

## 2. Anpassen (nur diese Stellen)

| Datei | Was |
|---|---|
| `frontend/src/config/app-identity.json` | name, slug, scheme, iosBundleIdentifier, androidPackage, primaryColor; `easProjectId` leer lassen bis `eas init` |
| `frontend/assets/images/*` | Icon, Splash, Favicon |
| `backend/supabase/config.toml` | `project_id` (z. B. `vokabel-app`) - sonst kollidieren die lokalen Docker-Container mit der base-app |
| `frontend/package.json` | `name` (optional) |
| `docs/` | neue Datei `<App>-Wissen.md`; `Grundapp-Wissen.md` bleibt als Referenz |

Danach: `npm install` in `frontend/` und `backend/`, `.env.local` wie in `docs/lernen/01-lokal-starten.md`.

## 3. Fachlich erweitern - Regeln

- Fachcode nur in `frontend/src/features/<name>/` (components, hooks, api, types, screens).
  Ein Feature importiert nie aus einem anderen Feature, nur aus `core/` und `shared/`.
- Fachtabellen nur als **neue Migrationen mit Zeitstempel**: `npx supabase migration new cards`.
  Die Nummern `0001`-`0099` gehoeren der Basis.
- Jede Fachtabelle: `organization_id`, RLS, Policies, Kommentar, pgTAP-Test
  (`docs/lernen/anleitung-neue-tabelle.md`). Test `01_security_baseline` prueft das automatisch.
- Datenexport ergaenzen: neue Migration mit `create or replace function public.export_my_data()`,
  die Fachtabellen hinzufuegt (siehe `0006_privacy.sql`).
- Fehler melden mit `reportError` aus `@/core/monitoring/error-sink` (siehe `docs/lernen/07-fehlerberichte.md`).
- Texte in `frontend/src/core/i18n/de.ts`, `en.ts`, `fa.ts` - fuer Fachtexte einen eigenen
  Abschnitt (z. B. `cards: { ... }`) anlegen, damit Merges aus der Basis selten kollidieren.
- `core/` und `shared/` moeglichst nicht im Klon aendern. Was allgemein nuetzlich ist, in der
  **base-app** bauen und per upstream holen (Rueckfluss-Regel, `MY-APPS-Wissen.md`).

## 4. Basis-Aenderungen holen

```
git fetch upstream
git merge upstream/main
```

- Konflikte sind vor allem in `app-identity.json` und den Sprachdateien zu erwarten:
  bei `app-identity.json` die Werte des Klons behalten.
- `CHANGELOG.md` der base-app zeigt, was neu ist und ob etwas zu tun ist.
- Neue Basis-Migrationen (`0007_...`) sind aelter als bereits eingespielte Fachmigrationen.
  Lokal: `npm run db:reset`. Auf Staging/Produktion spielen die Workflows sie mit
  `supabase db push --include-all` ein.
- Danach immer: `npm run check` (frontend), `npm run db:test` (backend).

## 5. Cloud einrichten

Eigene Supabase-Projekte und eigenes Expo-Projekt je App: `docs/lernen/06-m5-auslieferung.md`.
