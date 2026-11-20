# 04 - M3: Profil, Sprache, Design-Bausteine

Stand: 20.11.2026.

## Neue Seiten

| Route | Datei | Inhalt |
|---|---|---|
| `/profile` | `src/core/profile/profile-screen.tsx` | Anzeigename, Sprache, Passwort aendern, Abmelden (ab M4: Datenschutz, Rechtliches) |
| `/change-password` | `src/core/auth/screens/new-password-screen.tsx` (Modus `change`) | Passwort aendern im angemeldeten Zustand |

## Sprache und Leserichtung

- Drei Sprachen: `de.ts`, `en.ts`, `fa.ts` in `src/core/i18n/`. Neue Texte immer in alle drei.
- Startsprache: gespeicherte Wahl auf dem Geraet, sonst Geraetesprache, sonst Deutsch.
- Nach der Anmeldung gilt `profiles.locale` (gleich auf allen Geraeten): `use-sync-profile-language.ts`.
- Wechsel: `changeLanguage()` in `language.ts`:
  - Browser: setzt `dir="rtl"` bzw. `ltr` am `<html>` - sofort wirksam.
  - Handy: `I18nManager.forceRTL` wirkt erst nach Neustart, daher `Updates.reloadAsync()`.
- **Regel fuer Layouts:** Abstaende mit `Start/End` statt `Left/Right` (`paddingStart`, `marginEnd`),
  Text mit `textAlign: 'auto'`. Dann spiegelt sich alles bei Persisch automatisch.

## Design-Bausteine (`src/shared/ui/`)

| Baustein | Wofuer |
|---|---|
| `theme.ts` | Farben (hell/dunkel), Abstaende, Radien, `usePalette()` |
| `app-text.tsx` | Text in festen Stufen: title, heading, body, label, caption |
| `card.tsx` | Abschnitt mit Hintergrund und Ueberschrift |
| `button.tsx` | primary / secondary / link, mit Ladezustand |
| `text-field.tsx`, `form-text-field.tsx` | Eingabefeld; Formular-Variante fuer react-hook-form |
| `segmented-control.tsx` | Auswahl aus wenigen Optionen (Sprache) |
| `form-message.tsx` | Hinweis- oder Fehlerbox |
| `states.tsx` | `LoadingState`, `ErrorState` (mit "Erneut versuchen") |
| `screen.tsx` | Seitenrahmen: sicherer Bereich, Tastatur, Scrollen, Breite |

**Regel:** Jede Seite, die Daten laedt, zeigt waehrend des Ladens `LoadingState` und bei Fehler
`ErrorState` mit Wiederholen. Keine eigenen Spinner oder Farben in Seiten.

## Daten aendern (Muster)

`useUpdateProfile` in `use-profile.ts` zeigt das Muster fuer Schreibzugriffe:
`useMutation` -> `supabase.from('profiles').update(...)` -> danach Cache neu laden
(`invalidateQueries`). Die Datenbank erlaubt nur die Spalten aus dem Spaltenrecht (Migration 0003).

## Zum Selbermachen

Neues Feld im Profil anzeigen, z. B. Zeitzone (`profiles.time_zone` existiert schon):
1. `use-profile.ts`: `time_zone` in das `select` aufnehmen.
2. Texte: Schluessel `profile.timeZone` in `de.ts`, `en.ts`, `fa.ts`.
3. `profile-screen.tsx`: `<AppText>` in der Karte "Persoenliche Angaben".
4. `npm run check` in `frontend/`.
