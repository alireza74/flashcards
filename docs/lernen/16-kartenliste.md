# 16 - Kartenliste, Verschieben, Import-Ziel

Stand: 27.11.2026. Voraussetzung: `12-oberflaeche-1.md`, `14-anki-import.md`, `15-lernpensum.md`.

## 1. Deckseite = Uebersicht

Die Deckseite listet keine Karten mehr (bei 6000 Karten unbrauchbar). Stattdessen:
- Zeile "Karten ansehen" mit Anzahl -> `/browse?deck=<id>`,
- Kartei-Box-Faecher in der Legende sind anklickbar -> `/browse?deck=<id>&box=learning` usw.

## 2. Kartenliste (`screens/browse-screen.tsx`, `data/card-browser.ts`)

- Deck mit allen Unterdecks; Suche, Filter Kartei-Box-Fach und Niveau (Chips).
- Laedt 50 Eintraege, "Mehr laden" holt die naechsten 50.
- Gezaehlt werden Eintraege (Notizen). Eine Vokabel hat zwei Karten (je Richtung); sie passt zu einem Fach,
  wenn mindestens eine ihrer Karten darin liegt.
- "Verschieben": alle Eintraege, die zum Filter passen, mit ihren Karten in ein anderes Deck.
  Lernstand bleibt; Pakete zu 200 je Transaktion; Eintraege, die schon im Ziel liegen, zaehlen nicht.

## 3. Import-Ziel

Startet der Import bei einem Bereich (oberstes Deck mit Unterdecks), waehlt man zuerst das Ziel:
Vorschlag "Vokabeln", sonst ein anderes Unterdeck oder "Direkt in <Bereich>".

## 4. Lernpensum klarer

- Karten direkt im Bereich: eigene Zeile "Direkt in <Bereich>".
- Summe = was heute wirklich kommen kann: je Deck hoechstens so viele, wie neue warten
  (`possibleNewPerDay`). Leere Decks blasser, aber einstellbar.

## 5. Tests

`data/card-browser.test.ts` (5 Tests): Filter, Seiten, Verschieben mit Karten, Zeile "direkt", Tagessumme.

## 6. Fortschrittsring auf der Startseite

`data/stats.ts` `getTodayProgress`, `components/progress-ring.tsx` (react-native-svg):
- erledigt = heute beantwortete Karten (jede einmal, ohne Testmodus),
- offen = faellig + neue fuer heute (dieselbe Auswahl wie die Sitzung),
- Ring = erledigt / (erledigt + offen); in der Mitte die offene Zahl.
- Alles erledigt -> Ring voll in Gruen (Farbe "gefestigt") mit Haken, "Heute geschafft".
- Lernkarten mit Termin spaeter heute (nach dem 20-Minuten-Fenster) stehen als Hinweis darunter
  ("3 Karten kommen heute noch einmal"), zaehlen aber nicht als offen.
Tests: 2 in `data/pensum.test.ts`.

## 7. Kleine Ringe je Bereich

In jeder Bereichszeile der Startseite ein kleiner Ring (`AreaRing`), gleiche Regeln wie der grosse,
aber nur fuer die Karten des Bereichs (`getTodayProgress(db, now, counts, deckIds)`):
blau = Anteil erledigt, gruen mit Haken = heute fertig, leer = nichts faellig.
`shared/ui/list-row.tsx` hat dafuer die Eigenschaft `leading` (Aenderung an Basis-Datei).
