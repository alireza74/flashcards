# Karteikarten - Konzept Version 1 (Oberflaeche und Datenmodell)

Stand: 27.11.2026 - aus zwei Recherchen, **von Alireza freigegeben am 27.11.2026** (inkl. Testmodus mit is_test, Anki-Import erst altes Format, Medien in Stufe 2).
Grundentscheidungen und Fachkonzept: `Karteikarten-Wissen.md`. Eigene Bewertungen sind als solche markiert;
Quellen am Ende.

---

## 1. Was die Recherche gezeigt hat (Kurzfassung)

- Anki wird fuer Logik gelobt und fuer die Oberflaeche kritisiert: ueberladen, Funktionen schwer zu finden,
  Einstellungsflut, Statistik ueberfordert.
- Mochi gilt als "schoen, sauber, elegant" (Kuerzel direkt auf den Knoepfen); Kritik: Fortschritt zu unauffaellig.
- **Zwei Knoepfe sind belegt sinnvoll:** offizielle Anki-FSRS-FAQ - FSRS kann mit nur "Nochmal" und "Gut"
  sogar genauer sein. Wichtig: bei Vergessen nie "Schwer".
- Wischgesten loesen in AnkiDroid oft versehentlich aus (beim Scrollen, auf der falschen Kartenseite).
- Lernserien (Duolingo) koennen Druck erzeugen; Nutzer finden eine nachsichtige Serie und wenige Kennzahlen motivierend.
- Einstieg: lange Anleitungen werden nicht gelesen; besser gefuehrte Einrichtung oder Beispieldeck.

## 2. Oberflaeche - Regeln fuer Version 1

1. **Lernbildschirm:** grosse Flaeche "Tippen zum Aufdecken"; danach zwei Knoepfe unten in voller Breite,
   in Daumenreichweite: "Nochmal" und "Gewusst", je mit naechstem Termin ("10 min", "4 T").
   Farbe nie allein - immer mit Text. 4 Knoepfe nur per Einstellung.
2. **Rueckgaengig** immer sichtbar (Symbol oben); Web: Leertaste = aufdecken/Gewusst, 1/2 (bzw. 1-4), Strg+Z.
3. **Fortschrittsleiste** oben schmal (erledigt/gesamt), ohne Zeitdruck.
4. **Abschlussbildschirm:** Karten, Trefferquote, Dauer, morgen faellig, eine klare naechste Aktion.
5. **Wischen** standardmaessig aus; als Option nur auf der Antwortseite, nie auf scrollbaren Karten.
6. **Startseite "Heute":** eine grosse Zahl (faellig) und ein grosser Knopf "Lernen". Details erst auf der Deckseite.
7. **Deckseite:** Ring (gefestigt/gesamt), Kartei-Box (Neu/Lernen/Jung/Gefestigt), Balken je Niveau,
   7-Tage-Prognose als einfache Balken. Keine weiteren Diagramme in Version 1.
8. **Serie nachsichtig:** ein Tag zaehlt ab einer Wiederholung; keine Erinnerungen mit schlechtem Gewissen.
   Behaltensquote erst ab genug Daten und als Monatswert.
9. **Karte anlegen:** "Speichern und naechste" - Fokus zurueck ins erste Feld, Deck und Niveau bleiben stehen.
   Mehrere Zeilen einfuegen mit Vorschau (Stufe 2, Datenmodell schon vorbereitet).
10. **Gestaltungssystem:** eine Akzentfarbe, Abstaende im 4/8-Raster, etwa 4 Schriftgroessen, Hell/Dunkel
    ueber Farb-Tokens, Haptik nur beim Bewerten und am Sitzungsende (abschaltbar), Animationen mit
    react-native-reanimated (beachtet "Bewegung reduzieren" des Systems).
11. **RTL (Persisch):** im Layout nur `start`/`end`, nie `left`/`right`; Pfeile spiegeln; Sprachwechsel braucht
    Neustart (Basis macht das schon).
12. **Leere Seiten** zeigen immer den naechsten Schritt (z. B. "Noch keine Karten - Karte anlegen / Anki-Deck importieren").

Zu vermeiden: Einstellungsflut, versteckte Funktionen, 4 Knoepfe als Standard, Diagramm-Friedhof,
Serien-Druck, Rueckmeldung dort, wo der Daumen sie verdeckt.

## 3. Datenmodell - Vorschlag

**Von Anki uebernehmen:** Notiz -> Karten (eine Karte je Vorlage), Notiztypen als Daten, stabile Kennung fuer
erneuten Import, Pruefschluessel fuer Duplikate, Lernhistorie nur anfuegen, Loeschmarker statt Loeschen,
Lernoptionen als eigener Datensatz, auf den Decks verweisen.

**Anki-Altlasten bewusst NICHT uebernehmen:** `due` mit je nach Zustand anderer Bedeutung, doppelte
Zustandsspalten (`type`/`queue`), alle Felder in einem Text mit Trennzeichen, Hierarchie im Decknamen,
gemischte Zeiteinheiten, Konfiguration als Binaerblock.

**Gemeinsame Spalten jeder Tabelle:** `id` (UUID, auf dem Geraet erzeugt), `organization_id`, `created_at`,
`updated_at` (Geraetezeit, nur fuer "neuere Aenderung gewinnt"), `server_updated_at` (setzt der Server per
Trigger mit `clock_timestamp()`, Grundlage fuer "seit dem letzten Abgleich"), `deleted_at` (Loeschmarker).

| Tabelle | Inhalt / wichtige Spalten |
|---|---|
| `deck_configs` | Lernoptionen: Zielquote (Standard 90 %), Lernschritte, neue Karten pro Tag, Wiederholungen pro Tag, 2 oder 4 Knoepfe |
| `decks` | `parent_id` (Hierarchie), `name`, `kind` (Vokabeln/Redewendungen/Grammatik/frei), `lang`, `config_id`, `position` |
| `note_types` | `name`, `kind` (Basic, Basic+Rueckrichtung, Vokabel), `version` |
| `note_type_fields` | `note_type_id`, `ord`, `name`, `field_key` (stabil, englisch, z. B. `word`) |
| `card_templates` | `note_type_id`, `ord`, `name`, Vorder- und Rueckseite |
| `notes` | `note_type_id`, `deck_id`, `fields` (JSON, Schluessel = `field_key`), `tags`, `level` (A1-C2), `topic`, `source`, `lang`, `dedupe_key`, `external_guid` (Anki-Kennung) |
| `cards` | `note_id`, `template_ord`, `deck_id`, FSRS-Zustand (`state`, `due_at`, `last_review_at`, `stability`, `difficulty`, `scheduled_days`, `learning_step`, `reps`, `lapses`), `suspended`, `fsrs_model` |
| `review_logs` | `card_id`, `rating`, Zustand vorher/nachher, `reviewed_at`, `duration_ms`, `is_test`; nur anfuegen, kein Loeschmarker |
| `media` | Stufe 2: `sha1`, `filename`, `mime`, `size`, `storage_path` |
| nur Geraet: `sync_outbox` | `table_name`, `row_id`, `op`, `payload`, `attempts`, `last_error` |
| nur Geraet: `sync_state` | je Tabelle der Stand des letzten Abgleichs |

Eindeutig: eine Karte je (`note_id`, `template_ord`); Duplikatpruefung ueber (`organization_id`, `lang`, `dedupe_key`).

**Kartei-Box aus den Daten:** Neu = `state` neu; Lernen = lernen/neu lernen; Jung = Wiederholung mit
`scheduled_days` < 21; Gefestigt = >= 21.

**Testmodus:** Karte bleibt unveraendert; Antwort wird mit `is_test = true` protokolliert (fuer die
Test-Auswertung), aber nie fuer FSRS verwendet. *(Eigene Einschaetzung - zur Entscheidung.)*

## 4. Abgleich - Regeln aus der Recherche

1. Die Server-Uhr bestimmt "seit dem letzten Abgleich", nie die Geraete-Uhr.
2. `now()` in Postgres ist der Beginn der Transaktion - eine spaeter festgeschriebene Zeile kann einen
   aelteren Zeitstempel haben und wuerde uebersprungen. Daher `clock_timestamp()` **und** beim Holen ein
   kurzes Rueckblick-Fenster mit Doppelpruefung ueber die `id`.
3. Loeschen nur als Loeschmarker, sonst tauchen Daten auf anderen Geraeten wieder auf.
4. Senden idempotent (Upsert ueber die `id`), in Paketen; ein grosser Import nicht als zehntausende Einzelauftraege.
5. Abgelehnte Auftraege (z. B. RLS) nicht endlos wiederholen, sondern als Fehler markieren und anzeigen.
6. Alle Zeiten in UTC.

## 5. Anki-Import - Befund

- Drei Formate: `collection.anki2` / `collection.anki21` (alt, Konfiguration als JSON) und
  `collection.anki21b` (neu, zstd-komprimiert, Protobuf). Exportoption "Support older Anki versions" erzeugt das alte.
- In neuen Paketen ist `collection.anki2` nur ein Platzhalter - nicht als echte Daten lesen.
- Keine fertige Bibliothek ist fuer React Native belegt -> **eigener Leser** mit freien Bibliotheken:
  `fflate` (entpacken), `fzstd` (zstd), `@bufbuild/protobuf`, SQLite ueber expo-sqlite.
- Vorschlag Reihenfolge: zuerst altes Format (einfacher), danach neues. Medien (Bilder/Ton) in Stufe 2;
  in Version 1 Text uebernehmen und fehlende Medien in der Vorschau anzeigen. *(Zur Entscheidung.)*

## 6. Technische Risiken - zuerst pruefen

- **ts-fsrs 6.0 (MIT, Nov. 2026)** hat eine neue, inkompatible Schnittstelle (Standard FSRS-7) und verlangt
  laut Paketangabe Node >= 24. **Ob es unter React Native (Hermes) laeuft, ist nicht belegt.**
- Ebenso nicht belegt: `fzstd` unter Hermes.
- Deshalb als erster technischer Schritt ein kurzer Probelauf auf dem Android-Emulator und im Browser.
  Falls ts-fsrs nicht laeuft: FSRS selbst umsetzen (die Formeln sind offen dokumentiert) - passt zur Regel
  "eigene Logik".
- Persoenliche FSRS-Optimierung: die JS-Variante braucht Node -> nicht in der App, spaeter auf dem Server oder am PC.

## Quellen (Auswahl)

- Anki-FSRS-FAQ (2 Knoepfe): https://docs.ankiweb.net/faqs/frequently-asked-questions-about-fsrs.md
- Anki-Statistik, 21-Tage-Grenze: https://docs.ankiweb.net/stats.html
- Anki-Schema: https://github.com/ankitects/anki/blob/main/rslib/src/storage/schema11.sql
- apkg-Versionen: https://github.com/ankitects/anki/blob/main/rslib/src/import_export/package/meta.rs
- Notiztyp-Protobuf: https://github.com/ankitects/anki/blob/main/proto/anki/notetypes.proto
- ts-fsrs Migration v6: https://open-spaced-repetition.github.io/ts-fsrs/guide/migration
- expo-sqlite: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Abgleich-Backend-Regeln: https://watermelondb.dev/docs/Sync/Backend
- Postgres now()/clock_timestamp(): https://www.postgresql.org/docs/current/functions-datetime.html
- AnkiDroid Lernbildschirm 2.23: https://forums.ankiweb.net/t/new-study-screen-official-thread/67394
- Wischgesten-Probleme: https://forums.ankiweb.net/t/gestures-work-when-they-shouldnt/67535
- Mochi: https://borretti.me/article/first-impressions-mochi
- Leere Zustaende (NN/g): https://www.nngroup.com/videos/empty-states-in-application-design-guidelines/
- Reanimated Barrierefreiheit: https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility
