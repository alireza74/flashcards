# 14 - Anki-Import

Stand: 27.11.2026. Voraussetzung: `10-datenmodell.md` bis `13-lernen.md`.

## 1. Ablauf fuer den Nutzer

Deckseite -> Menue "..." -> "Anki-Deck importieren" (`/import?deck=<id>`):

1. Datei waehlen (.apkg).
2. Zuordnung je Anki-Notiztyp: unser Kartentyp (Einfach / Beide Richtungen / Vokabel) und welches Anki-Feld
   in welches unserer Felder kommt. Vorschlag nach Feldnamen; die Wahl merkt sich die App.
3. Niveau fuer alle (nur bei Decks mit Sprache).
4. Vorschau: Gruppen mit Beispielen, Auswahl, Hinweise (Medien, Lueckentext, Unterdecks, Richtung).
5. Import mit Fortschritt, danach Zusammenfassung.

Karten starten neu (kein Lernstand aus Anki). Bilder und Ton fehlen noch (Stufe 2).

## 2. Die Datei (`import/anki-package.ts`)

- .apkg = ZIP. Darin `collection.anki21` oder `collection.anki2` (SQLite, Schema 11) - lesen wir.
- `collection.anki21b` = neues Format (zstd, Schema 18) - noch nicht; Hinweis: in Anki mit
  "Support older Anki versions" exportieren.
- Notiztypen und Decks stehen als JSON in `col.models` / `col.decks`, Felder in `notes.flds` (Trenner 0x1F),
  das Deck einer Notiz an ihrer ersten Karte (`cards.did`).
- Entpacken: fflate (MIT). Oeffnen: expo-sqlite `deserializeDatabaseAsync` - nur im Speicher.
  In Tests: node:sqlite `deserialize` (`import.test.ts` baut eine eigene kleine .apkg).

## 3. Umwandeln

- HTML zu Text (`html-to-text.ts`): `<br>` und Bloecke -> Zeilen, Tags weg, Sonderzeichen umwandeln.
  `[sound:...]` und `<img>` fallen weg und werden gezaehlt.
- Lueckentext-Notiztypen werden uebersprungen.

## 4. Richtung angleichen (`scripts.ts`)

Manche Decks mischen die Richtung (mal Persisch vorne, mal Deutsch). Erkennung ueber die Schrift:
- Welche Schrift gehoert vorne hin? Die der Zieldeck-Sprache, sonst die haeufigste.
- Vertauscht = vorne falsche UND hinten richtige Schrift -> umdrehen (Standard: an).
- Gleiche Schrift auf beiden Seiten (z. B. Deutsch-Deutsch) bleibt unveraendert.
Umgedreht wird VOR dem Duplikatvergleich, sonst bleiben "X - Y" und "Y - X" zwei Woerter.

## 5. Vorschau-Gruppen (`import-plan.ts`)

| Gruppe | Bedeutung | Standard |
|---|---|---|
| neu | Wort noch nicht da | uebernehmen |
| andere Bedeutung | gleiches Wort, anderes zweites Feld | uebernehmen (abwaehlbar) |
| schon vorhanden | gleiches Wort, gleiche Bedeutung | ueberspringen (waehlbar) |
| schon importiert | gleiche Anki-guid (`external_guid`) | immer ueberspringen |

"Gleiches Wort" = gleicher Vergleichsschluessel in derselben Sprache, ueber alle Decks und in der Datei selbst.
Unterdecks: Anki-Decks relativ zum gemeinsamen Anfang, z. B. "Spanisch::Lektion 1" -> Unterdeck "Lektion 1".

## 6. Speichern (`run-import.ts`)

Pakete zu 100 Notizen, je Paket eine Transaktion (`saveRows`) - mit Warteschlange fuer den Abgleich.
`source = 'anki'`, `external_guid` = Anki-guid; `created_at` steigt je Notiz, damit neue Karten in der
Reihenfolge der Datei kommen.

## 7. Tests

`import/import.test.ts` (12 Tests): HTML, Lesen (beide Formate, Fehlerfaelle), Zuordnung, Vorschau, Duplikate,
Import mit Unterdecks, zweiter Import, Pakete, Richtung angleichen.

## 8. Spaeter

Medien (Stufe 2), neues Format anki21b (fzstd ist installiert), Lueckentext, CSV ueber dieselbe Vorschau.
