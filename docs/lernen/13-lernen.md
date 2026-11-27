# 13 - Lernen mit FSRS

Stand: 27.11.2026. Voraussetzung: `10-datenmodell.md` bis `12-oberflaeche-1.md`.

## 1. Ablauf einer Sitzung

1. Start: "Lernen" auf der Startseite (alle Decks) oder auf einer Deckseite (Deck + Unterdecks) -> `/study`.
2. Karte zeigen, Tippen (oder Leertaste) deckt auf.
3. Knopf waehlen; auf jedem steht der naechste Termin ("Gewusst · 10 min").
4. Weiter, bis nichts mehr faellig ist -> Abschlussbildschirm (Karten, beim ersten Mal gewusst, Dauer, morgen faellig).
5. Beim Verlassen: Anzeige neu laden und abgleichen.

Tastatur im Browser: Leertaste/Enter = aufdecken bzw. "Gewusst", 1/2 (bei 4 Knoepfen 1-4), Strg+Z oder u = rueckgaengig.

## 2. Welche Karten kommen dran? (`study/queue.ts`)

| Reihenfolge | Karten |
|---|---|
| 1 | Lernkarten (Lernen / Neu lernen), deren Termin erreicht ist |
| 2 | Wiederholungen bis Ende des Lerntags, gemischt mit neuen Karten (Tageslimits) |
| 3 | ist sonst nichts mehr da: Lernkarten bis zu 20 Minuten frueher |

- **Lerntag beginnt um 4 Uhr** (`study/study-day.ts`).
- **Gegenrichtung erst morgen:** je Notiz hoechstens eine neue/Wiederholungskarte pro Tag; hatte eine Karte
  der Notiz heute schon eine Antwort, bleibt die andere bis morgen liegen.
- Die Zahl "faellig" auf Startseite und Deckseite rechnet mit **derselben** Auswahl (`data/stats.ts` ruft
  `loadStudyCards` auf) - sonst zeigt die Startseite 2 und die Sitzung bringt nur 1 Karte.

## 3. Termine (`study/scheduler.ts`)

- Einzige Stelle, die ts-fsrs benutzt (Algorithmus austauschbar).
- FSRS-7 mit den Lernoptionen des Decks; **`allowModelOverride: false`**, sonst ueberspringt FSRS-7 die
  Lernschritte (neue Karte nach "Gut" sofort mehrere Tage).
- Gemessen (Test): neue Karte Nochmal 1 min, Gewusst 10 min; zweimal Gewusst -> Tage; Vergessen -> Neu lernen 10 min.
- Fuzz (etwas Zufall bei langen Abstaenden) in der App an, in Tests aus.

## 4. Speichern und Rueckgaengig (`study/review.ts`)

- Eine Antwort speichert **in einer Transaktion** (`saveRows`): neuen Zustand der Karte + Eintrag in
  `review_logs` (Zustand VOR der Antwort, Antwortdauer, `is_test`).
- Rueckgaengig: nur solange der Eintrag noch in der Warteschlange steht. Dann lokal entfernen, Karte bekommt
  ihren alten Lernstand mit **neuer** Aenderungszeit (gewinnt so beim Abgleich). Auf dem Server bleibt die
  Lernhistorie "nur anfuegen".
- Darum gleicht die App **waehrend** einer Sitzung nicht ab, erst beim Verlassen.

## 5. Darstellung (`study/render.ts`)

- Vorlage `{{feld}}` wird mit dem Inhalt gefuellt; leere Felder hinterlassen keine Leerzeilen.
- Abstaende als kurze Beschriftung: min, h, T, Mo, J.

## 6. Tests

`study/study.test.ts` (18 Tests): Termine, Gegenrichtung, Tageslimit, Mischen, Sitzungsablauf,
Speichern, Rueckgaengig, Lernoptionen, Vorlage, Beschriftung, Zaehlung = Sitzung.
Im Browser durchgespielt (siehe Wissensdatei, Chronik).

## 7. Spaeter

Testmodus (`is_test`), Einstellungsseite fuer Lernoptionen (4 Knoepfe, Limits, Zielquote), Statistik,
persoenliche FSRS-Parameter (Optimierung braucht Node -> nicht in der App).
