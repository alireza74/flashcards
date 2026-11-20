# 01 - Lokal starten

## Einmalig

- Node.js (vorhanden: 26), Docker (Rancher Desktop) muessen installiert sein.
- Abhaengigkeiten installieren:
  - `cd frontend` und `npm install`
  - `cd backend` und `npm install` (bringt die Supabase-CLI mit, kein globales Installieren noetig)
- Fuer das Handy: App **Expo Go** aus dem Store installieren (reicht, solange keine eigenen
  nativen Module dazukommen; danach Development Build).

## App starten

In `frontend/`:

| Befehl | Ergebnis |
|---|---|
| `npm run web` | App im Browser unter `http://localhost:8081` |
| `npm start` | Dev-Server mit QR-Code; mit Expo Go scannen -> App auf dem Handy |
| `npm run android` | startet im Android-Emulator (falls installiert) |

Aenderungen am Code erscheinen sofort (Fast Refresh). Beenden mit `Strg+C`.

Handy und Rechner muessen im selben Netz sein. Klappt das nicht (Firmennetz), `npx expo start --tunnel`.

## Supabase lokal starten

1. Rancher Desktop starten und warten, bis Docker laeuft (`docker info` ohne Fehler).
2. In `backend/`: `npm run db:start`
   Beim ersten Mal werden mehrere Docker-Images geladen (einige GB, dauert).
3. Danach:

| Was | Adresse |
|---|---|
| Studio (Tabellen ansehen, nur lesen!) | `http://localhost:54323` |
| API | `http://localhost:54321` |
| Datenbank direkt (VS Code, psql) | `localhost:54322`, Benutzer/Passwort `postgres/postgres` |
| Mail-Testpostfach (Registrierungs-Mails) | `http://localhost:54324` |

`npm run db:status` zeigt alle Adressen und die lokalen Schluessel.
`npm run db:stop` beendet alles; Daten bleiben erhalten.
`npm run db:reset` baut die Datenbank frisch aus den Migrationen auf (ab M1 wichtig).

**Regel:** Im Studio nie Tabellen aendern. Aenderungen immer als Migration (Anleitung folgt in M1).
