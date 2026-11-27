# 12 - Erste Oberflaeche

Stand: 27.11.2026. Voraussetzung: `10-datenmodell.md`, `11-abgleich.md`.

## 1. Seiten

| Route | Datei (Screen) | Inhalt |
|---|---|---|
| `/` | `features/flashcards/screens/today-screen.tsx` | "Heute": grosse Zahl faellig, Knopf Lernen, Bereiche; ohne Decks -> `/setup` |
| `/setup` | `setup-screen.tsx` | "Was moechtest du lernen?" - Sprache / Schulfach / Beruf-Pruefung / anderes |
| `/decks/[id]` | `deck-screen.tsx` | Kartei-Box, Unterdecks, Karten mit Suche; Menue umbenennen / Unterdeck / loeschen |
| `/cards/new?deck=` | `note-editor-screen.tsx` | Karte anlegen |
| `/cards/[noteId]` | `note-editor-screen.tsx` | Karte bearbeiten, loeschen |

Die Dateien in `src/app/` sind nur duenne Verweise auf die Screens. Neue Seiten muessen in
`app/_layout.tsx` im geschuetzten Bereich (`Stack.Protected` fuer Angemeldete) stehen.

## 2. Datenfluss

```
Screen ──useLocalQuery──> data/*.ts ──SQL──> SQLite (Geraet)
Screen ──useLocalMutation──> data/*.ts ──saveRow──> SQLite + Warteschlange ──> Abgleich
```

- `data/use-local-data.ts`:
  - `useLocalQuery(['deck', id], (db) => ...)` liest; Cache-Schluessel beginnt immer mit `['local', userId]`.
  - `useLocalMutation((ctx, input) => ...)` schreibt; danach wird alles unter `['local', userId]` neu geladen
    und ein Abgleich angestossen.
  - `useDataContext()` liefert `db`, `organizationId`, `newId`, `now`. Ohne gespeicherte Organisation
    (allererster Start ohne Netz) ist er `null` - die Startseite bittet dann, einmal online zu gehen.
- Nach jedem erfolgreichen Abgleich laedt `SyncTriggers` die Anzeige ebenfalls neu.

## 3. Datenfunktionen (`features/flashcards/data/`)

| Datei | Funktionen |
|---|---|
| `areas.ts` | `createArea`: Bereich aus Vorlage (Sprache -> 3 Unterdecks), Standard-Lernoptionen |
| `decks.ts` | Decks lesen, Pfad, Teilbaum, anlegen, umbenennen, `deleteDeckTree` (Loeschmarker fuer alles darunter) |
| `notes.ts` | `createNote` (Notiz + je Vorlage eine Karte), `updateNote` (Lernstand bleibt), `deleteNote`, `listNotes`, `findDuplicates`, `normalizeDedupeKey` |
| `stats.ts` | Kartei-Box (Neu / Lernen / Jung / Gefestigt), faellig, neue Karten heute (Tageslimit) |

Getestet mit node:sqlite in `data/data.test.ts` (12 Tests).

## 4. Entscheidungen in diesem Baustein

- **Notiztyp ergibt sich aus dem Deck:** Vokabeln und Redewendungen -> "Vokabel" (zwei Richtungen),
  sonst "Einfach" mit Wahl "nur vorwaerts / beide Richtungen".
- **Niveau** nur bei Decks mit Sprache.
- **Duplikat-Hinweis** blockiert nicht (ein Wort kann zwei Bedeutungen haben).
- **"Speichern und naechste"**: Felder leeren, Deck und Niveau behalten; das Formular wird ueber einen
  `key` neu aufgebaut, dadurch bekommt das erste Feld wieder den Fokus.
- **Kein setState im Effekt** (Linter-Regel): Der Editor ist geteilt in `NoteEditorScreen` (laedt) und
  `NoteForm` (startet mit fertigen Anfangswerten).
- **Typisierte Routen**: Seiten mit Platzhalter immer als Objekt aufrufen:
  `router.push({ pathname: '/decks/[id]', params: { id } })` - eine Zeichenkette `/decks/${id}` lehnt
  TypeScript ab.
- Kartei-Box-Farben stehen in `components/box-bar.tsx` (hell/dunkel); Farbe ist nie das einzige Signal.

## 5. Noch nicht in diesem Baustein

Lernen (Knopf zeigt einen Hinweis), Testen, Anki-Import, Ring/Niveau-Balken/Prognose,
Einfuehrungsseiten der App, Hinweis "Keine Verbindung" der Basis passt noch nicht zum Offline-Lernen.
