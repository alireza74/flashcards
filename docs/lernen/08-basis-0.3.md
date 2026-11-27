# 08 - Basis 0.3: Seitenaufbau, Updates, Offline, Einfuehrung, Tests

Was ist neu, wo liegt es, wie probierst du es aus.

## 1. Seitenaufbau

Jede Seite benutzt `Screen` (`src/shared/ui/screen.tsx`):

```tsx
<Screen
  headerLeft={<BackButton />}          // links: Zurueck
  title="Profil"                       // Mitte
  headerAction={<ProfileButton />}     // rechts: z. B. Profil-Knopf oder MoreMenu
  footer={<Button title="Speichern" onPress={save} />}  // unten fest: Hauptknopf der Seite
>
  ...Inhalt (scrollt)...
</Screen>
```

- Ohne `headerLeft`/`headerAction` steht der Titel wie frueher mittig (Anmeldeseiten).
- `BackButton` geht zurueck; gibt es keinen Verlauf (Seite direkt geoeffnet, im Browser neu geladen),
  geht er zur Startseite.
- Regel aus der WandAkte: oben links Zurueck, oben rechts seltene Aktionen im Menue "...",
  unten EIN Hauptknopf fuer den naechsten Arbeitsschritt.

Bausteine in `src/shared/ui`:

| Datei | Baustein |
|---|---|
| `header-buttons.tsx` | `IconButton` (44 x 44), `BackButton`, `MoreMenu` (Eintraege mit `confirmLabel` brauchen einen zweiten Tipp) |
| `icons.tsx` | Linien-Icons (react-native-svg) |
| `list-row.tsx` | antippbare Zeile mit Pfeil |
| `chip-select.tsx` | Auswahl als Kacheln |
| `confirm-button.tsx` | Loeschen in zwei Schritten |
| `bottom-sheet.tsx` | Blatt von unten bzw. Popup (`centered`) |
| `offline-banner.tsx` | Leiste "Keine Verbindung" (steckt schon in `Screen`) |

## 2. Updates sichtbar machen

Bisher: expo-updates laedt ein Update beim Start still, aktiv wird es erst nach dem Beenden der App.
Jetzt (`src/core/app-version/`):

- **Hinweis** (`update-prompt.tsx`): sobald ein Update geladen ist, fragt die App
  "Jetzt neu starten?". Gesucht wird beim Start (von expo-updates selbst) und wenn die App aus dem
  Hintergrund zurueckkommt (hoechstens alle 10 Minuten).
- **Profil** (`update-section.tsx`): Knopf "Nach Updates suchen" mit Meldung (aktuell / wird geladen /
  neu starten / Fehler).
- Im Browser und mit dem Dev-Server ausgeblendet - testen nur mit einer APK.

Ausprobieren: neue APK installieren, dann eine Aenderung per `eas update --channel preview` schicken,
App in den Hintergrund und nach 10 Minuten zurueck - oder im Profil "Nach Updates suchen".
Wichtig: der Hinweis selbst steckt im Code. Eine APK, die ihn noch nicht hat, zeigt ihn erst nach dem Update.

## 3. Einfuehrung beim ersten Start

`src/core/onboarding/`, Seiten in `src/config/onboarding.ts`, Texte unter `onboarding.pages.<name>` in den
Sprachdateien. Nach "Los geht's" oder "Ueberspringen" merkt sich das Geraet das (AsyncStorage).
Leere Liste = keine Einfuehrung. Neu zeigen (neue Fassung): Schluessel in `use-onboarding.ts` auf `-v2`.

## 4. Feedback

Profil -> "Feedback senden" oeffnet das Mailprogramm. Adresse: `supportEmail` in
`src/config/app-identity.json` (Platzhalter `support@example.com` ersetzen; leer = Abschnitt weg).
Mitgeschickt wird nur der technische Stand (App, Version, Plattform), keine Nutzerdaten.

## 5. Pruefung vor jedem Commit (Husky)

Bei `git commit` laufen automatisch ESLint (nur geaenderte Dateien) und die Typpruefung.
Faellt etwas durch, wird nicht committet. Eingerichtet wird das durch `npm install` in `frontend/`
(Skript `prepare`). Notfall: `git commit --no-verify`.

## 6. Oberflaechentests mit Maestro

Maestro tippt die App auf dem Emulator/Handy automatisch durch (`frontend/.maestro/`).

1. Maestro installieren (braucht Java): https://docs.maestro.dev
2. Emulator starten, APK installieren.
3. Laufen lassen:

```powershell
maestro test -e EMAIL=testkonto@example.test -e PASSWORD=... frontend/.maestro/sign-in-profile-sign-out.yaml
```

Die Ablaeufe finden Elemente ueber `testID` (z. B. `sign-in-submit`), nicht ueber Texte - deshalb laufen
sie in jeder Sprache. Neue Knoepfe, die getestet werden sollen, bekommen ein `testID`.
Stand 27.11.2026: Ablaeufe geschrieben, noch nicht auf einem Geraet ausgefuehrt.

## 7. Barrierefreiheit - Pruefliste

- Jeder Knopf hat `role` und `aria-label` (IconButton braucht `label`).
- Tippflaechen mindestens 44 x 44.
- Am Handy: Systemschrift auf groesste Stufe stellen und alle Seiten ansehen; TalkBack einmal durchgehen.
- Feste Kreise mit Text (Profil-Knopf) begrenzen die Vergroesserung (`maxFontSizeMultiplier`).
