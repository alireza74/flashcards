# Karteikarten - Wissensdatei

Lern-App mit Karteikarten (Arbeitstitel "Karteikarten"). Klon der base-app.

Ablage: `C:\Users\alh\Documents\MY-APPS\flashcards`
Repo: github.com/alireza74/flashcards (privat, seit 27.11.2026), upstream: github.com/alireza74/base-app
Basis: base-app `main` vom 27.11.2026 (Tag v0.3.0 plus Commit dfb2e33 "App-Version 0.3.0")

Stand: 27.11.2026
Diese Datei bei jeder Sitzung lesen und ergaenzen. Wissen zur Basis (Anmeldung, Datenschutz,
Auslieferung, Fehlerprotokoll, Bausteine): `docs/Grundapp-Wissen.md` und `docs/lernen/` - gilt hier unveraendert.
Uebergreifendes: `../MY-APPS-Wissen.md`.

---

## 1. Stand und naechste Schritte

- 27.11.2026: Fachkonzept fuer Version 1 besprochen (Abschnitt 2-6), Klon angelegt:
  Name Karteikarten, Kennung `de.example.flashcards` (Platzhalter), Farbe `#2E9E6B`,
  App-Version 0.1.0, lokales Supabase `project_id = "flashcards"`, `supportEmail` leer (Feedback-Knopf aus),
  `easProjectId` leer bis `eas init`.
- Naechste Schritte:
  1. (erledigt 27.11.) GitHub-Repo angelegt und gepusht.
  2. (erledigt 27.11.) Offline-Abgleich entschieden und gebaut - `docs/lernen/11-abgleich.md`.
  3. (erledigt 27.11.) Datenmodell gebaut - `docs/lernen/10-datenmodell.md`.
  4. (erledigt 27.11.) Erste Oberflaeche - `docs/lernen/12-oberflaeche-1.md`.
     (erledigt 27.11.) Lernen mit FSRS - `docs/lernen/13-lernen.md`. 
     (erledigt 27.11.) Anki-Import (altes .apkg-Format, nur Text) - `docs/lernen/14-anki-import.md`.
     (erledigt 27.11.) Lernpensum: Tageslimits je Deck - `docs/lernen/15-lernpensum.md`.
     (erledigt 27.11.) Kartenliste mit Filtern, Verschieben, Import-Ziel - `docs/lernen/16-kartenliste.md`.
     (erledigt 27.11.) Testmodus (aendert keine Termine) - `docs/lernen/17-testmodus.md`.
     (erledigt 27.11.) Statistikseite - `docs/lernen/18-statistik.md`. Damit ist der Umfang von Version 1 gebaut.
  5. Einfuehrungsseiten (`config/onboarding.ts`) fachlich anpassen - aktuell noch die der Basis.
  6. Offen fuer die veroeffentlichte Web-App: Webserver muss COOP/COEP-Header senden (expo-sqlite).
  7. (erledigt 27.11.) Android-Emulator (Expo Go 58): Alireza hat alles durchgetestet - "funktioniert alles".
  8. Basis-Text `common.offline` ("Aenderungen koennen nicht gespeichert werden") passt nicht zum Offline-Lernen.
  9. Integrationstests loeschen ihre Nutzer; deren persoenliche Organisationen mit Testdaten bleiben im lokalen Supabase.

Hinweis lokal: base-app, wandakte und flashcards nutzen dieselben lokalen Ports (Supabase 54321 ff.,
Web 8081) - immer nur ein lokales Supabase gleichzeitig (im anderen `backend/` `npx supabase stop`).
Nach einem anderen Projekt den Dev-Server mit `--clear` starten (geteilter Metro-Cache).
Emulator (Pixel_9_Pro, Expo Go 58): `adb reverse tcp:8081 tcp:8081` und `adb reverse tcp:54321 tcp:54321`
(sonst erreicht das Handy weder Metro noch das lokale Supabase unter 127.0.0.1), dann
`adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent`.
Fenster unsichtbar? Lag ausserhalb des Bildschirms (y = -947, frueherer zweiter Monitor) - per
user32 MoveWindow auf den Bildschirm geholt.
`frontend/.env.local` ist aus `.env.example` kopiert; Publishable Key aus `npm run db:status` eintragen.

---

## 2. Grundentscheidungen (27.11.2026)

| Thema | Entscheidung | Begruendung |
|---|---|---|
| Kartenart | allgemein: Vorder-/Rueckseite, jedes Thema (Sprachen, Mathe, Physik ...) | nicht nur Vokabeln |
| Inhalte | eigene Karten + Import (CSV, Anki `.apkg`) | keine Lizenzfragen bei eigenen Inhalten |
| Nutzer | Version 1 nur Einzelnutzer (persoenliche Organisation der Basis) | Teilen/Lerngruppen spaeter |
| Lernlogik | **Anki-Logik mit FSRS statt Leitner** (aendert MY-APPS-Wissen 6.1) | falsche Karten kommen in derselben Sitzung wieder; Abstaende je Karte; passt zum Anki-Import |
| Oberflaeche | einfacher als Anki: standardmaessig 2 Knoepfe "Nochmal" / "Gewusst" | Schwer/Einfach optional zuschaltbar |
| Offline | **Lernen muss ohne Netz gehen** | lokale Datenbank auf dem Geraet als Hauptquelle, Supabase fuer Konto, Sicherung, Abgleich |
| Supabase | bleibt | Anmeldung, Sicherung, mehrere Geraete, spaeter Teilen |
| KI | nicht in Version 1; spaeter eigene/offene Modelle, kein Claude/ChatGPT per API | siehe Abschnitt 7 |

Noch zu pruefen (nicht geraten):
- Bibliothek `ts-fsrs`: aktuelle Version, Lizenz.
- Ob FSRS mit nur 2 Knoepfen (Nochmal/Gewusst) gleich gut rechnet - FSRS-Doku pruefen.
- Formel-Darstellung (LaTeX) in React Native - spaeter, nicht Version 1.

## 3. Erweiterbarkeit - Grundsaetze

1. Notiztypen sind Daten (Felder + Kartenvorlagen), kein Code. Eine Notiz erzeugt eine oder mehrere
   Karten (z. B. vorwaerts/rueckwaerts). Bildet Anki-Decks direkt ab.
2. Lernalgorithmus hinter einer Schnittstelle ("naechster Termin fuer Karte X bei Antwort Y"); heute FSRS.
3. Lernhistorie wird nur angefuegt, nie geaendert (Antwort, Zeitpunkt, Antwortdauer, Kartenzustand).
   Grundlage fuer Statistik, FSRS-Optimierung, spaetere eigene Modelle.
4. Alle Importe (CSV, Anki, spaeter KI) erzeugen ein gemeinsames Zwischenformat, dann Speichern.
5. Inhaltsanzeige ueber austauschbare Bausteine (Text, spaeter Markdown, Formel, Bild, Ton).
6. Rechte wie `decks.manage` schon anlegen, auch wenn Version 1 nur einen Nutzer hat.

## 4. Gliederung, Niveau, Duplikate

- Decks in Ebenen, beliebig tief (z. B. `Sprachen > Englisch > Vokabeln`, `Mathe > Analysis`).
- **Die App legt die Gliederung an:** Start mit "Was moechtest du lernen?" (Sprache, Schulfach,
  Beruf/Pruefung, Frei). Bei Sprache: Sprache waehlen -> Vokabeln, Redewendungen, Grammatik.
  Vorlagen sind Daten.
- Uebersicht: immer nur eine Ebene anzeigen; Startseite "Heute" zaehlt ueber alle Decks.
- **Niveau (A1-C2) ist eine Eigenschaft der Karte, kein Deck.** Filter beim Lernen und Statistik
  je Niveau. Ebenso Thema und Quelle. Regel: eigenes Deck nur fuer das, was man getrennt lernen will.
- **Import mit Abgleich:** Ziel waehlen -> Felder zuordnen (Zuordnung je Quelle merken) -> Niveau
  fuer alle setzen -> Vorschau mit Gruppen neu / gleich / gleich mit anderer Bedeutung / aehnlich ->
  uebernehmen. Bestehende Karten behalten ihren Lernstand.
- Vergleich: Wortfeld, bereinigt (Gross-/Kleinschreibung, Leerzeichen, HTML, Artikel/"to"),
  innerhalb derselben Sprache ueber alle Decks; Tippfehler ueber Aehnlichkeitsmass.
- Offen: Zaehlt dasselbe Wort in Vokabeln und Redewendungen als Duplikat?

## 5. Version 1 - Umfang

1. Start "Was moechtest du lernen?" -> Gliederung aus Vorlage
2. Decks anlegen, umbenennen, verschieben (eine Ebene je Ansicht)
3. Karten anlegen, bearbeiten, suchen; Notiztypen Basic und Vokabel, je mit Niveau
4. Anki-Import (`.apkg`) mit Feldzuordnung, Niveau, Duplikat-Abgleich
5. Lernen mit FSRS (Lernschritte in Minuten fuer neue/vergessene Karten)
6. Testen: frei gewaehlte Karten, veraendert den Lernstand nicht, Ergebnis mit Fehlerliste
7. Statistik: Startseite "Heute", Deckseite mit Ring (gefestigt/gesamt), Kartei-Box,
   Balken je Niveau, Prognose 7 Tage

**Kartei-Box** (Bild aus Leitner, Inhalt aus Anki-Zustaenden):
Neu (grau) | Lernen (orange) | Jung, Abstand < 21 Tage (hellgruen) | Gefestigt, >= 21 Tage (dunkelgruen).
"Gelernt" = gefestigt. Antippen eines Fachs zeigt dessen Karten.

**Offline-Abgleich - ENTSCHIEDEN 27.11.2026 (Alireza): eigener Abgleich mit expo-sqlite.**
Ablauf: offline alles lokal schreiben, Aenderung mit Merker "nicht gesendet"; bei Netz
1. senden (Merker loeschen), 2. holen, was sich auf dem Server seit dem letzten Abgleich geaendert hat,
3. Zeitpunkt merken. Ausloeser: App-Start, Netz zurueck, nach einer Lernsitzung, Knopf "Jetzt abgleichen".
Konflikt: neuere Aenderung gewinnt; Lernhistorie nur anfuegen.

Recherche 27.11.2026:
Empfehlung: **expo-sqlite (+ Drizzle) mit eigenem Abgleich** ueber supabase-js. RLS gilt unveraendert,
kein Zusatzdienst, keine Kosten; serverseitig nur `updated_at`-Trigger und Soft-Delete-Spalten.
Aufwand: eigene Push-Warteschlange, Checkpoints, Loeschungen, Wiederholen.
Rueckfall: PowerSync (Open Edition selbst gehostet).

| Option | Ergebnis |
|---|---|
| expo-sqlite + eigener Abgleich | offizielles Expo-Paket, Web mit COOP/COEP-Headern + `wasm` in Metro; Web-Build ohne FTS |
| PowerSync | sehr aktiv, Dev-Build (op-sqlite); Lesen ueber Sync Streams statt RLS (Regeln doppelt pflegen), Logical Replication mit BYPASSRLS-Rolle, Zusatzdienst; Free begrenzt, Pro ab 49 USD/Monat |
| WatermelonDB | seit 2025 kaum gepflegt, New Architecture offen - verworfen |
| Legend-State | Supabase-Plugin, v3 noch Beta; State-Ansatz passt schlecht zu grosser Lernhistorie |
| RxDB | SQLite-Speicher fuer RN nur Premium |
| ElectricSQL | nur Lesepfad, Direct Connection (IPv6) noetig |
| Supabase selbst | keine offizielle Offline-Loesung gefunden |

Quellen: docs.expo.dev/versions/latest/sdk/sqlite, expo.dev/changelog/sdk-58,
docs.powersync.com/integration-guides/supabase-+-powersync, www.powersync.com/pricing,
legendapp.com/open-source/state/v3/sync/supabase, rxdb.info/rx-storage-sqlite.html,
electric.ax/docs/integrations/supabase.

Anki-Format vor dem Bau im Anki-Quelltext pruefen (ZIP mit SQLite + Medien; neuere Exporte
komprimiert, Exportoption "Support older Anki versions"). Direkte Verbindung zu AnkiWeb: keine
offizielle Schnittstelle bekannt - pruefen.

## 6. Anki-Logik (Referenz, Anki-Standardwerte)

- Zustaende: Neu, Lernen, Wiederholung, Neu lernen.
- Neue Karte: Lernschritte 1 min, 10 min; "Gut" im letzten Schritt -> Wiederholung, morgen;
  "Einfach" -> 4 Tage.
- Wiederholung: "Nochmal" = vergessen -> Neu lernen (10 min), Zaehler +1. Abstaende in Tagen
  bei FSRS aus Stabilitaet/Schwierigkeit und Zielquote (Standard 90 %).
- Leech: nach 8-mal vergessen markieren.
- Tageslimits Standard: 20 neue, 200 Wiederholungen.

## 7. Spaeter (nicht Version 1)

- Schnellerfassung (Liste "Wort - Bedeutung"), CSV-Import, Bilder, Ton, Vorlesen, Lueckentext, Formeln
- Motivation: Tagesziel, Lernserie
- Teilen und Lerngruppen
- KI mit eigenen/offenen Modellen, Stufen:
  A FSRS-Parameter aus eigener Historie optimieren;
  B kleine eigene Modelle (Schwierigkeit neuer Karten, Problemkarten frueh erkennen);
  C offene Modelle selbst betreiben (Antwort nach Sinn pruefen, OCR, Aussprache);
  D kleines offenes Sprachmodell per LoRA anpassen (Karten aus Text, Erklaerungen), eigener Server.
  App spricht nur mit eigener Schnittstelle; Training mit fremden Daten nur mit Einwilligung.
- Einzigartigkeit (Richtung offen): DE/EN/FA mit RTL, KI als Lernbegleiter, Anki-kompatibel ohne Anki-Komplexitaet.

---

## 7a. Wichtiger Code

| Datei | Zweck | Hinweis |
|---|---|---|
| `backend/supabase/migrations/20261127161130_flashcards.sql` | 8 Fachtabellen, Rechte, RLS, Abgleich-Trigger, Export | Erklaerung `docs/lernen/10-datenmodell.md` |
| `private.flashcards_sync_row()` | setzt `server_updated_at` (clock_timestamp), verwirft aelteres `updated_at`, verbietet Org-Wechsel | gilt fuer alle Tabellen ausser review_logs |
| `frontend/src/features/flashcards/db/schema.ts` | SQLite-Schema als Migrationsliste (`PRAGMA user_version`) | ausgelieferte Migrationen nie aendern |
| `frontend/src/features/flashcards/db/system-note-types.ts` | eingebaute Notiztypen mit festen IDs | muss mit der Supabase-Migration uebereinstimmen |
| Rechte `decks.manage`, `cards.write` | owner + member | admin bewusst nicht: Basis-Test 01 prueft Admin-Rechte exakt |

| `frontend/src/features/flashcards/sync/` | Offline-Abgleich (Warteschlange, Senden, Holen, Ausloeser, Status) | Erklaerung `docs/lernen/11-abgleich.md` |
| `frontend/metro.config.js` | `wasm` + COOP/COEP fuer expo-sqlite im Browser | nur Dev-Server; Webserver spaeter gleich einstellen |
| `frontend/jest.integration.config.js` | Tests gegen lokales Supabase (`npm run test:integration`) | ohne jest-expo-Preset (ersetzt fetch) |
| `app/_layout.tsx` | bindet `<SyncTriggers />` und die Fachseiten ein | Aenderung an Basis-Datei |
| `shared/ui/list-row.tsx` | Eigenschaft `leading` (z. B. kleiner Ring) | Aenderung an Basis-Datei; Kandidat fuer base-app |
| `shared/ui/text-field.tsx` | `outlineOffset: -2` (Fokusrahmen nach innen) | Aenderung an Basis-Datei; Kandidat fuer base-app |
| `study/queue.ts` `limitingDecks` | Tageslimit je Deck; Bereich ohne Gesamtlimit | Erklaerung `docs/lernen/15-lernpensum.md` |
| `frontend/src/features/flashcards/import/` | Anki-Import: lesen, Zuordnung, Richtung, Vorschau, Speichern | Erklaerung `docs/lernen/14-anki-import.md` |

## 8. Fehler und Loesungen

| Datum | Fehler | Ursache | Loesung |
|---|---|---|---|
| 27.11.2026 | Admin-API in Jest: `"undefined" is not valid JSON` | jest-expo-Setup ersetzt `fetch` durch Platzhalter | Integrationstests mit eigener Jest-Konfiguration ohne Preset |
| 27.11.2026 | Dateiauswahl im Browser liest die Datei doppelt | expo-document-picker hat `base64: true` als Standard | `base64: false` setzen, Bytes aus `asset.file` |
| 27.11.2026 | Anki-Deck mit gemischter Richtung (Persisch mal vorne, mal hinten), Woerter doppelt | so im Deck angelegt | Richtung ueber die Schrift angleichen (`import/scripts.ts`), danach Duplikate erkennen |
| 27.11.2026 | Jest fuehrt `app/test.tsx` als Testdatei aus | Name passt auf das Jest-Muster fuer Tests | Route `app/quiz.tsx` |
| 27.11.2026 | `FSRSValidationError: both stabilities must be positive` im Test | Testdaten ohne `stability_fast` | gelernte Karten in Tests mit `stability_fast > 0` |
| 27.11.2026 | (vorab vermieden) `withExclusiveTransactionAsync` | gibt es im Browser nicht (expo-sqlite-Doku) | eigene Schreibsperre `writeTransaction` mit `withTransactionAsync` |

## 9. Chronik

- 27.11.2026 - Ideen gesammelt, Fachkonzept Version 1 festgelegt, Klon von base-app angelegt.
- 27.11.2026 - Recherche Oberflaeche/Datenmodell, Konzept-Version1.md freigegeben; Probelauf ts-fsrs/fzstd ok.
- 27.11.2026 - Baustein Datenmodell: Supabase-Migration (8 Tabellen), 29 pgTAP-Pruefungen (95 gesamt gruen),
  db lint ohne Befund, Typen erzeugt; SQLite-Schema + Migrationslauf, 5 Jest-Tests. expo-sqlite installiert.
  Lokaler Publishable Key in frontend/.env.local eingetragen.
- 27.11.2026 - Baustein Offline-Abgleich: DB je Nutzer, Warteschlange, Senden/Holen mit Sicherheitsfenster,
  "neuere gewinnt", Ausloeser, Status. 18 Tests ohne Server + 5 gegen lokales Supabase gruen. Im Browser
  geprueft (crossOriginIsolated, Abgleich nach Anmeldung ohne Fehler). Lokales Testkonto web-test@example.test.
- 27.11.2026 - Baustein Oberflaeche 1: Heute, Einrichtung, Deckseite mit Kartei-Box, Karte anlegen/bearbeiten,
  Duplikat-Hinweis; Texte DE/EN/FA (FA von Muttersprachler pruefen). 12 neue Tests (77 + 5 Integration gruen).
  Im Browser in Handygroesse durchgeklickt (Einrichtung Englisch, Vokabel B1, Speichern und naechste,
  Duplikat-Hinweis, Startseite 2 faellig); Daten in Supabase angekommen. Emulator nicht getestet.
  Fallstrick: `npx prettier` ohne Projektkonfiguration formatiert mit doppelten Anfuehrungszeichen -
  im Projekt `--single-quote --print-width 120` verwenden.
- 27.11.2026 - Baustein Lernen: Lernsitzung mit FSRS-7 (allowModelOverride false -> Lernschritte 1/10 min),
  2 Knoepfe mit Termin, Tastatur im Browser, Rueckgaengig solange nicht gesendet, Abschlussbildschirm,
  Lerntag ab 4 Uhr, Gegenrichtung erst morgen. Zaehlung "faellig" nutzt dieselbe Auswahl wie die Sitzung
  (Fehler gefunden: Startseite zeigte 2, Sitzung brachte 1). 95 Tests + 5 Integration gruen. Im Browser
  durchgespielt inkl. Rueckgaengig; Lernantworten in Supabase angekommen. Emulator nicht getestet.
- 27.11.2026 - Baustein Anki-Import: .apkg (collection.anki21/anki2) mit fflate entpacken, mit
  deserializeDatabaseAsync im Speicher lesen; Zuordnung je Anki-Notiztyp (Vorschlag nach Feldnamen, gemerkt in
  local_meta), HTML zu Text, Vorschau mit Gruppen neu/vorhanden/andere Bedeutung/schon importiert, Unterdecks,
  Richtung angleichen ueber die Schrift, Speichern in Paketen zu 100 Notizen. Neues Format anki21b -> Hinweis.
  12 neue Tests (60 im Bereich gruen). Alireza hat sein Deck Deutsch-Persisch B2-C1 (3213 Notizen) im Browser
  importiert; Befund: 262 Notizen dort Deutsch-Deutsch (so im Deck), ~1400 Woerter doppelt in Gegenrichtung.
  Karten-Editor: alle Felder mehrzeilig (mehrzeilige Anki-Felder waren abgeschnitten).
- 27.11.2026 - Baustein Lernpensum: Seite "Lernpensum" (neu/Wiederholungen pro Tag je Deck, Summe je Bereich,
  wartende neue Karten). Limit gilt je Deck fuer seine Unterdecks, Bereich ohne Gesamtlimit; heute gelernte
  zaehlen ueber alle Startdecks. Neue Sprachbereiche: Vokabeln 20, Grammatik 10, Redewendungen 5. Termine mit
  den Lernoptionen des Kartendecks. 6 neue Tests (113 gruen). Seite im Browser angezeigt; Speichern im Browser
  nicht selbst durchgeklickt (Alireza testete parallel).
- 27.11.2026 - Kartenliste: Deckseite ohne lange Liste, "Karten ansehen" + anklickbare Kartei-Box-Faecher,
  eigene Seite mit Suche/Filtern/Mehr laden/Verschieben. Import bei einem Bereich fragt nach dem Unterdeck
  (Vorschlag Vokabeln). Lernpensum: Zeile "Direkt in <Bereich>", Summe = was heute wirklich kommt.
  Anlass: Alirezas 6422 Karten lagen direkt im Bereich "Deutsch". 5 neue Tests (118 gruen). Im Browser
  (Testkonto) Kartei-Box -> Liste "Jung" geprueft; Verschieben im Browser nicht durchgeklickt.
- 27.11.2026 - Fortschrittsring auf "Heute" (erledigt/offen, gruen mit Haken wenn geschafft, Hinweis auf
  Lernkarten spaeter heute). 2 neue Tests (120 gruen). Im Browser (Testkonto) "Heute geschafft" gesehen.
  Feld "am Rand abgeschnitten": Fokusrahmen des Browsers liegt ausserhalb des Feldes und wird von der
  ScrollView abgeschnitten -> `outlineOffset: -2` in `shared/ui/text-field.tsx` (Basis-Datei geaendert,
  gilt fuer alle Eingabefelder). Im Browser geprueft: Rahmen ringsum sichtbar.
- 27.11.2026 - Kleine Fortschrittsringe je Bereich auf "Heute". 1 neuer Test (121 gruen). Im Browser geprueft.
- 27.11.2026 - Test auf dem Android-Emulator in Expo Go: Alireza hat die App durchgetestet, "funktioniert alles".
- 27.11.2026 - Tempo gemessen (6400 Vokabeln / 12 800 Karten): neue Karten wurden bei jeder Zaehlung alle geladen.
  Jetzt je Deck nur so viele wie noetig -> Startseite 133 -> 24 ms, Kartenauswahl 47 -> 9 ms. 122 Tests gruen.
- 27.11.2026 - Testmodus: Auswahl (Anzahl, Fach, Niveau, Richtung), Gewusst/Nicht gewusst mit is_test = 1
  (Termine unveraendert), Rueckgaengig, Ergebnis mit Ring, nicht gewusste erneut testen oder bewusst neu
  lernen. 4 neue Tests (126 gruen). Im Browser (Testkonto) durchgespielt inkl. erneut testen.
- 27.11.2026 - Statistikseite: Ueberblick, Niveau-Balken, Serie (Tag zaehlt ab 1 Karte), 7-Tage-Leiste,
  Aktivitaet 30 Tage, Vorschau 14 Tage, Trefferquote/Ziel/Test. Kartei-Box-Farben auf gepruefte Gruenstufen
  umgestellt. 2 neue Tests (128 gruen), 65 ms bei 12 800 Karten. Im Browser (Testkonto) angesehen.
