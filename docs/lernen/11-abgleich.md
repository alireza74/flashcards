# 11 - Offline-Abgleich (selbst gebaut)

Stand: 27.11.2026. Voraussetzung: `10-datenmodell.md`.

## 1. Das Prinzip in einem Satz

Die App schreibt **immer** in die Datenbank auf dem Geraet; sobald Netz da ist, schickt sie die
Aenderungen an Supabase und holt, was sich dort geaendert hat.

```
  App ──schreibt──> SQLite (Geraet) ──Warteschlange──> SENDEN ──> Supabase
                         ^                                           │
                         └──────────── HOLEN <───────────────────────┘
```

## 2. Die Bausteine (`frontend/src/features/flashcards/`)

| Datei | Aufgabe |
|---|---|
| `db/local-db.ts` | Datenbank oeffnen: eine Datei je Nutzer `flashcards-<userId>.db` |
| `db/transactions.ts` | Schreibsperre (alles nacheinander) und Migrationslauf |
| `sync/table-specs.ts` | Spalten je Tabelle, Umwandlung Geraet <-> Server (Zeiten, 0/1, JSON) |
| `sync/local-write.ts` | `saveRow`, `markDeleted`: Zeile speichern + Warteschlange, in einer Transaktion |
| `sync/push.ts` | Senden |
| `sync/pull.ts` | Holen |
| `sync/remote.ts` | Verbindung zu Supabase (als Schnittstelle, damit Tests sie ersetzen koennen) |
| `sync/run-sync.ts` | ein Durchgang: senden, dann holen |
| `sync/sync-engine.ts` | `syncNow()`: angemeldeter Nutzer, Organisation merken, Status setzen |
| `sync/sync-triggers.tsx` | startet automatisch (Anmeldung, Netz zurueck, Vordergrund); in `app/_layout.tsx` |
| `sync/sync-status.ts` | `useSyncStatus()` fuer die Oberflaeche (laeuft, offline, Fehler, offene Aenderungen) |

## 3. Senden (push.ts)

1. Hoechste Nummer der Warteschlange merken. Was waehrend des Sendens dazukommt, hat eine hoehere
   Nummer und bleibt fuer den naechsten Durchgang.
2. Tabellen in fester Reihenfolge (Decks vor Notizen vor Karten - wegen der Fremdschluessel),
   Pakete zu 200 Zeilen, jeweils der **aktuelle** Stand der Zeile.
3. Ergebnis:
   - ok -> Eintraege loeschen
   - kein Netz -> abbrechen, spaeter nochmal
   - abgelehnt (z. B. RLS 42501) -> einzeln senden; die schuldige Zeile bekommt `failed = 1`
     und wird nicht endlos wiederholt
4. Lernhistorie mit `ignoreDuplicates`: zweimal senden schadet nicht, aendern geht nicht.

## 4. Holen (pull.ts)

1. Je Tabelle steht in `sync_state` der Server-Zeitpunkt der zuletzt geholten Zeile.
2. Geholt wird ab **diesem Zeitpunkt minus 5 Minuten** (Sicherheitsfenster) - so geht keine Zeile verloren,
   die auf dem Server etwas spaeter festgeschrieben wurde, als ihr Zeitstempel sagt.
3. Seiten zu 1000 Zeilen, sortiert nach (server_updated_at, id); die naechste Seite beginnt nach der
   letzten Zeile (Keyset, nicht OFFSET - schneller und ohne Luecken).
4. Eine geholte Zeile ersetzt die lokale nur, wenn sie mindestens so neu ist (`updated_at`).
5. Holen erzeugt keine Eintraege in der Warteschlange.

## 5. Konflikte

Dieselbe Notiz auf zwei Geraeten geaendert: **die neuere Aenderung gewinnt** (`updated_at`).
- Auf dem Server sorgt der Trigger `private.flashcards_sync_row` dafuer (aeltere Aenderung wird verworfen).
- Auf dem Geraet sorgt `pull.ts` dafuer (aeltere Server-Zeile ueberschreibt keine neuere lokale).

## 6. Browser

expo-sqlite laeuft im Browser als WebAssembly und braucht `SharedArrayBuffer`. Dafuer:
- `frontend/metro.config.js`: `wasm` als Asset und die Header
  `Cross-Origin-Embedder-Policy: credentialless`, `Cross-Origin-Opener-Policy: same-origin`
- **Fuer die veroeffentlichte Web-App muss der Webserver dieselben Header senden** (noch offen).
- Im Browser gibt es keine exklusiven Transaktionen - deshalb die eigene Schreibsperre.

## 7. Tests

| Befehl (in `frontend/`) | Was |
|---|---|
| `npm test` | 18 Tests ohne Server: Umwandlung, Warteschlange, Senden, Holen, Konflikt, Seiten (mit node:sqlite und einem Server-Ersatz im Speicher) |
| `npm run test:integration` | 5 Tests gegen das **lokale Supabase** mit echtem RLS: zwei Geraete, Konflikt, Loeschen, fremder Nutzer |

Fuer `test:integration` vorher in PowerShell (Werte aus `npm run db:status` in `backend/`):

```
$env:FLASHCARDS_IT_URL = 'http://127.0.0.1:54321'
$env:FLASHCARDS_IT_PUBLISHABLE_KEY = '<PUBLISHABLE_KEY>'
$env:FLASHCARDS_IT_SECRET_KEY = '<SECRET_KEY>'
```

Eigene Jest-Konfiguration (`jest.integration.config.js`), weil das jest-expo-Preset `fetch` ersetzt.

## 8. Regeln fuer spaeteren Code

- Abgeglichene Tabellen **nur** ueber `saveRow` / `markDeleted` aendern - sonst fehlt der Eintrag in
  der Warteschlange und die Aenderung kommt nie auf dem Server an.
- `saveRow` braucht die **vollstaendige** Zeile.
- Nie `writeTransaction` in `writeTransaction` (wartet ewig).
- Nach einer Lernsitzung `requestSync()` aufrufen.
