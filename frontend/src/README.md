# Aufbau von `src/`

| Ordner | Inhalt | Regel |
|---|---|---|
| `app/` | Routen (Expo Router): jede Datei ist eine Seite, `_layout.tsx` definiert die Navigation | duenn halten, nur Screens aus `core/` bzw. `features/` importieren |
| `config/` | `app.config.ts`: Name, Version, Kennungen, Farben | einzige Stelle, die ein Klon anpasst |
| `core/` | Basis jeder App: Auth, Organisation, Rechte, Einstellungen, Fehler, i18n | gehoert zur base-app; Aenderungen fliessen in alle Klone |
| `shared/` | `ui/` (Design-System), `lib/` (Hilfsfunktionen), `hooks/` | nur, was mindestens zwei Stellen nutzen |
| `features/` | Fachfunktionen, je Ordner ein Feature (`components`, `hooks`, `api`, `types`, `screens`) | ein Feature importiert nie aus einem anderen Feature, nur aus `core/` und `shared/` |

Import-Kurzform: `@/` zeigt auf `src/`, z. B. `import { spacing } from '@/shared/ui/theme'`.
