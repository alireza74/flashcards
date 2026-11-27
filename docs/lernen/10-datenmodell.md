# 10 - Datenmodell der Karteikarten-App

Stand: 27.11.2026. Konzept dazu: `../Konzept-Version1.md`.

## 1. Warum zwei Datenbanken?

| Wo | Was | Wozu |
|---|---|---|
| **Handy: SQLite** (expo-sqlite) | Hauptquelle. Die App liest und schreibt nur hier. | Lernen ohne Netz, schnell |
| **Supabase: Postgres** | Kopie in der Cloud | Sicherung, zweites Geraet, spaeter Teilen |

Beide haben dieselben Tabellen. Der Abgleich (naechster Baustein) schickt Aenderungen vom Handy an
Supabase und holt neue Aenderungen zurueck.

## 2. Die Tabellen

```
deck_configs  (Lernoptionen)
     ^
decks ── parent_id ──> decks        (Gliederung in Ebenen)
     ^
notes ──> note_types ──< note_type_fields   (welche Felder: word, meaning ...)
     ^              └──< card_templates     (welche Karten: vorwaerts, rueckwaerts)
cards  (eine Karte je Notiz und Vorlage, mit FSRS-Lernstand)
     ^
review_logs  (jede Antwort, nur anfuegen)
```

- **Notiz und Karte sind getrennt** (wie Anki): Die Notiz "house = Haus" erzeugt mit dem Typ
  "Vokabel" zwei Karten (Wort -> Bedeutung, Bedeutung -> Wort). Korrigierst du die Notiz, aendern sich beide.
- **Notiztypen sind Daten:** neue Typen brauchen keinen neuen Code. Die drei eingebauten Typen
  (`basic`, `basic_reverse`, `vocabulary`) haben feste IDs und `organization_id = null`.
- **Niveau, Thema, Quelle, Sprache** stehen an der Notiz, nicht im Decknamen (Filter statt Deck-Explosion).
- **`dedupe_key`**: bereinigtes Hauptwort fuer den Duplikat-Abgleich beim Import.
- **`external_guid`**: die Kennung aus Anki, damit ein erneuter Import die Notiz wiedererkennt.
- **Kartei-Box** ergibt sich aus `cards.state` und `cards.scheduled_days` (< 21 Tage jung, >= 21 gefestigt).

## 3. Spalten fuer den Abgleich

| Spalte | Gesetzt von | Bedeutung |
|---|---|---|
| `id` | Geraet (UUID) | Datensatz entsteht offline, braucht sofort eine eindeutige Kennung |
| `updated_at` | Geraet | entscheidet bei Konflikten: die neuere Aenderung gewinnt |
| `server_updated_at` | Server (Trigger) | "was hat sich seit meinem letzten Abholen geaendert?" |
| `deleted_at` | Geraet | Loeschmarker. Hart geloeschte Zeilen koennte der Abgleich nicht weitergeben |

Warum zwei Zeiten? Die Uhr des Handys kann falsch gehen. Fuer "was ist neu seit dem letzten Abholen"
zaehlt deshalb nur die Server-Uhr. Der Trigger nimmt `clock_timestamp()` statt `now()`, weil `now()` der
Beginn der Transaktion ist und dadurch aelter sein kann als eine Zeile, die schon abgeholt wurde.

Auf dem Handy zusaetzlich:
- `sync_outbox`: Warteschlange der noch nicht gesendeten Aenderungen
- `sync_state`: je Tabelle der Zeitpunkt des letzten Abholens

## 4. Sicherheit in Supabase

- **RLS:** lesen nur in der eigenen Organisation; schreiben nur mit Recht `decks.manage`
  (Decks, Optionen, Notiztypen) bzw. `cards.write` (Notizen, Karten, Antworten).
- **Zusammengesetzte Fremdschluessel** `(organization_id, deck_id)`: eine Notiz kann nie auf das
  Deck einer anderen Organisation zeigen - selbst wenn jemand die ID kennt.
- **Kein hartes Loeschen** ueber die App (`delete` ist entzogen); nur der Loeschmarker.
- **`review_logs` nur anfuegen** (`update`/`delete` entzogen).
- **Trigger `private.flashcards_sync_row`:** verwirft eine Aenderung mit aelterem `updated_at`
  und verbietet das Wechseln der Organisation.
- **Datenexport** `export_my_data()` enthaelt jetzt auch alle Lerndaten.

## 5. Dateien

| Datei | Inhalt |
|---|---|
| `backend/supabase/migrations/20261127161130_flashcards.sql` | Tabellen, Trigger, Rechte, RLS, eingebaute Notiztypen, Export |
| `backend/supabase/tests/database/10_flashcards.test.sql` | 29 pgTAP-Pruefungen |
| `frontend/src/features/flashcards/db/schema.ts` | SQLite-Schema als Migrationen |
| `frontend/src/features/flashcards/db/local-db.ts` | Datenbank oeffnen, Migrationen ausfuehren |
| `frontend/src/features/flashcards/db/system-note-types.ts` | eingebaute Notiztypen (muss zur Supabase-Migration passen) |
| `frontend/src/features/flashcards/db/schema.test.ts` | Jest-Test des SQLite-Schemas (mit node:sqlite) |

## 6. Selbst ausprobieren

In `backend/`: `npm run db:start`, dann Studio unter http://127.0.0.1:54323 oeffnen und die Tabellen
ansehen (Table Editor). `npm run db:test` zeigt die Pruefungen.

Lokale Migrationen auf dem Handy laufen ueber `PRAGMA user_version`: Version 0 = leer,
jede Migration erhoeht um 1. **Ausgelieferte Migrationen nie aendern, nur neue anfuegen.**
