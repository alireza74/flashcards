# 15 - Lernpensum (Tageslimits je Deck)

Stand: 27.11.2026. Voraussetzung: `13-lernen.md`.

## 1. Fuer den Nutzer

Deck oder Bereich -> Menue "..." -> "Lernpensum" (`/pensum?deck=<id>`):
- je Deck "Neu pro Tag" und "Wiederholungen pro Tag" (- / + oder eintippen),
- darunter, wie viele neue Karten noch warten ("noch keine neuen Karten" ist kein Problem),
- bei einem Bereich die Summe: "Zusammen: 35 neue Karten pro Tag".

Die Zahlen sind **Obergrenzen**. Fehlen Karten, kommen weniger. Karten, die man nicht wusste, kommen
ausserdem wieder (Lernschritte, siehe `13-lernen.md`).

Vorgaben fuer neue Sprachbereiche: Vokabeln 20, Grammatik 10, Redewendungen 5 (je Unterdeck eigene
Lernoptionen). Aeltere Bereiche teilen sich "Standard" (20) bis zur ersten Aenderung.

## 2. Was ein Limit begrenzt (`study/queue.ts`)

| Deck | begrenzt |
|---|---|
| normales Deck (z. B. "Vokabeln") | sich selbst und alle Unterdecks zusammen (z. B. importierte Lektionen) |
| oberstes Deck (Bereich, z. B. "Spanisch") | nur Karten direkt darin - ein Bereich hat kein Gesamtlimit |

- Eine Karte kommt nur, wenn **alle** Decks, die sie begrenzen, noch Platz haben (`limitingDecks`).
- Heute schon gelernte Karten zaehlen mit, egal von wo aus gelernt wurde (Startseite, Bereich, Deck).
- Startseite, Bereich und Deck zeigen dieselbe Zahl wie die Sitzung (`data/stats.ts` nutzt `loadStudyCards`).
- Termine (FSRS) rechnet die Sitzung mit den Lernoptionen des Decks der Karte (`StudyLoad.configs`).

## 3. Aendern (`data/pensum.ts`)

Teilt sich ein Deck seine Lernoptionen mit anderen Decks, bekommt es beim Speichern eine eigene Kopie
(neue `deck_configs`-Zeile + `decks.config_id`, eine Transaktion). Die anderen Decks bleiben unveraendert.
Werte werden auf 0 bis 9999 begrenzt.

## 4. Tests

`data/pensum.test.ts` (6 Tests): Vorgaben, Auswahl je Unterdeck, leeres Deck, Lektionen unter einem Deck,
heute schon gelernt, eigene Kopie beim Aendern, begrenzende Decks.

## 5. Spaeter

4 Antwortknoepfe, Zielquote (heute 90 %), Lernschritte - auf derselben Seite.
