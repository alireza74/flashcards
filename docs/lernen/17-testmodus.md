# 17 - Testmodus

Stand: 27.11.2026. Voraussetzung: `13-lernen.md`, `16-kartenliste.md`.

## 1. Fuer den Nutzer

Deck oder Bereich -> Menue "..." -> "Testen" (`/quiz?deck=<id>`):
1. Auswahl: Anzahl (10/20/50/alle), Karten (schon gelernt / alle / ein Kartei-Box-Fach), Niveau, Richtung
   (wie die Karten / Wort -> Bedeutung / Bedeutung -> Wort).
2. Test: zufaellige Reihenfolge, aufdecken, "Gewusst" / "Nicht gewusst"; Rueckgaengig wie beim Lernen.
   Browser: Leertaste aufdecken, 1 = nicht gewusst, 2/Enter = gewusst, u = rueckgaengig.
3. Ergebnis: Ring mit Prozent (gruen ab 80 %), Liste der nicht gewussten,
   "Nicht gewusste noch einmal testen", "Neuer Test", optional "Nicht gewusste neu lernen".

## 2. Regeln (`study/test-mode.ts`)

- Der Test aendert **keine Termine**: Antwort = Eintrag in `review_logs` mit `is_test = 1` und dem
  unveraenderten Zustand der Karte. Kartenauswahl, Tageslimits und Fortschrittsring zaehlen nur `is_test = 0`.
- Je Notiz hoechstens eine Karte (sonst kaeme "Haus" und "das Haus <- Haus" im selben Test).
- "Nicht gewusste neu lernen" ist bewusst eine echte Antwort "Nochmal" (`is_test = 0`): die Karten gehen
  in "Neu lernen" und kommen bald wieder.
- Rueckgaengig nur, solange die Antwort noch nicht gesendet ist.

## 3. Hinweis Route

Die Datei heisst `app/quiz.tsx`, nicht `test.tsx`: Jest haelt `test.tsx` fuer eine Testdatei.

## 4. Tests

`study/test-mode.test.ts` (4 Tests): Auswahl (je Notiz eine, Anzahl, Niveau, Richtung, Fach), Mischen,
Antwort ohne Terminaenderung + Rueckgaengig, "Nicht gewusste neu lernen".
FSRS-7 verlangt bei gelernten Karten `stability_fast > 0` - Testdaten muessen das setzen.

## 5. Spaeter

Antwort eintippen (Vergleich mit Toleranz), Testergebnisse ueber die Zeit in der Statistik.
