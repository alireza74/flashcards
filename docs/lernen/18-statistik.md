# 18 - Statistik

Stand: 27.11.2026. Voraussetzung: `13-lernen.md`, `16-kartenliste.md`, `17-testmodus.md`.

## 1. Aufruf und Inhalt

- Startseite: Tipp auf den grossen Ring ("Statistik ansehen") -> `/stats` (alle Bereiche).
- Deck/Bereich: Menue "..." -> "Statistik" -> `/stats?deck=<id>`. Oben Wechsel Alle / Bereiche.

| Abschnitt | Inhalt |
|---|---|
| Ueberblick | "X von Y Karten gefestigt" + Kartei-Box |
| Nach Niveau | Balken je A1-C2 / ohne, unterteilt in die Faecher, "gefestigt / gesamt" |
| Serie und Aktivitaet | Tage in Folge, Rekord, Lernzeit 7 Tage, 7-Tage-Leiste, gelernte Karten je Tag (30 Tage) |
| Vorschau | faellige Karten je Tag, naechste 14 Tage (heute inkl. ueberfaellige) |
| Gedaechtnis | Trefferquote bei Wiederholungen (30 Tage), Ziel (desired_retention), Test-Quote |

## 2. Regeln (`data/statistics.ts`)

- Tag = 4 bis 4 Uhr. Testantworten zaehlen nur in "Test".
- **Serie:** ein Tag zaehlt, sobald eine Karte gelernt wurde (Entscheidung Alireza, Variante a).
  Hat man heute noch nicht gelernt, gilt die Serie bis gestern weiter.
- **7-Tage-Leiste:** voll gruen = Tagespensum geschafft, halb = gelernt, leer = nicht gelernt.
  "Geschafft" merkt sich das Geraet (`local_meta`, Schluessel `day-done:<all|deckId>:<Tagesbeginn>`),
  gesetzt, wenn die Startseite den Ring gruen zeigt. Nur lokal: auf einem neuen Geraet fehlen alte Marken.
- Trefferquote: Antworten auf Wiederholungen (Zustand vorher = 2), "gewusst" = nicht "Nochmal".

## 3. Diagramme und Farben

Eigene Bausteine, keine Bibliothek: `components/day-bars.tsx` (Saeulen, antippen zeigt Datum und Wert),
`components/level-bars.tsx`, `ProgressRing`. Saeulen oben 4 px gerundet, 2 px Luecke; jede Zahl auch als Text.
Kartei-Box-Farben: die Faecher sind eine **Reihenfolge**, darum EIN Gruenton in Helligkeitsstufen
(hell: `#6DBB92 #3E9E70 #217A51 #0D5134`, dunkel: `#2D6B4E #3F9468 #5BBF8B #A2E6C0`),
mit dem Pruefskript des dataviz-Skills (`--ordinal`) gegen die Flaechenfarbe geprueft. Die alten Farben
(grau/orange/hellgruen/gruen) fielen dort durch.

## 4. Tests und Tempo

`data/statistics.test.ts` (2 Tests): Serie, Niveaus, Vorschau, Trefferquote, Test, Lernzeit, 7-Tage-Leiste.
Gemessen: 12 800 Karten + 20 000 Lerneintraege -> 65 ms.
