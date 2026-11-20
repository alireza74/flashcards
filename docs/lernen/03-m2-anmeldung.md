# 03 - M2: Anmeldung

Stand: 20.11.2026. Was gebaut wurde, wie es zusammenspielt und wo es liegt.

## Ablaeufe

```
Registrieren:  Formular -> signUp -> Mail mit 6-stelligem Code -> Code eingeben -> angemeldet
                                     (DB-Trigger legt Profil + persoenliche Organisation an)
Anmelden:      E-Mail + Passwort -> angemeldet
               noch nicht bestaetigt -> Knopf "Code eingeben" -> neuer Code -> wie oben
Passwort weg:  E-Mail -> Mail mit Code -> Code eingeben -> "Neues Passwort" -> angemeldet
Abmelden:      Knopf auf der Startseite -> Anmeldeseite, Daten-Cache geleert
App-Neustart:  gespeicherte Sitzung wird geladen -> direkt angemeldet
```

**Warum Codes statt Links in der Mail:** Ein Link muss aus dem Mailprogramm zurueck in die
App springen (Deep Link) und pro Umgebung in Redirect-Listen stehen - laut Recherche die
haeufigste Fehlerquelle. Ein Code funktioniert auf Handy und im Browser gleich.

## Dateien

| Datei | Aufgabe |
|---|---|
| `frontend/src/core/config/env.ts` | liest Supabase-URL und oeffentlichen Schluessel aus `.env.local` |
| `frontend/src/core/supabase/client.ts` | der eine Supabase-Client; Token-Erneuerung nur im Vordergrund |
| `frontend/src/core/supabase/large-secure-store.ts` | Sitzung verschluesselt speichern (Handy) |
| `frontend/src/core/auth/auth-api.ts` | alle Auth-Aufrufe: signIn, signUp, verifyCode, resendCode, ... |
| `frontend/src/core/auth/auth-provider.tsx` | aktuelle Sitzung fuer die ganze App (React Context) |
| `frontend/src/core/auth/schemas.ts` | Eingaberegeln (zod), gleiche Passwortregel wie der Server |
| `frontend/src/core/auth/auth-errors.ts` | Fehlercode von Supabase -> Text-Schluessel |
| `frontend/src/core/auth/screens/*` | die fuenf Seiten |
| `frontend/src/core/profile/use-profile.ts` | Profil + aktive Organisation laden (TanStack Query) |
| `frontend/src/core/i18n/de.ts`, `en.ts` | alle Texte, Deutsch und Englisch |
| `frontend/src/shared/ui/*` | Bausteine: Screen, TextField, FormTextField, Button, FormMessage |
| `frontend/src/app/_layout.tsx` | Provider + Zugangsschutz |
| `backend/supabase/config.toml` (`[auth]`) | Passwortregel, Bestaetigung an, Mail-Vorlagen |
| `backend/supabase/templates/*.html` | Mail-Vorlagen mit `{{ .Token }}` (der Code) |

## Zugangsschutz (Stack.Protected)

In `_layout.tsx` steht je Seitengruppe eine Bedingung (`guard`):

| Gruppe | sichtbar wenn | Seiten |
|---|---|---|
| nicht angemeldet | keine Sitzung | sign-in, sign-up, verify-code, forgot-password |
| Passwort-Reset | Sitzung **und** gerade Passwort-Code bestaetigt | new-password |
| angemeldet | Sitzung, kein Passwort-Reset | index (Startseite) |

Aendert sich die Sitzung, springt Expo Router selbst auf eine erlaubte Seite. Deshalb
navigieren die Seiten nach erfolgreichem Anmelden nicht selbst.
**Wichtig:** Das ist nur Navigation. Welche Daten jemand bekommt, entscheidet RLS in der Datenbank.

## Der Weg einer Anmeldung (Datenfluss)

1. `sign-in-screen.tsx`: Formular -> zod prueft E-Mail-Format -> `signIn()` in `auth-api.ts`
2. `supabase.auth.signInWithPassword` -> HTTPS an `http://127.0.0.1:54321/auth/v1/token`
3. Supabase Auth prueft Passwort, liefert Sitzung (Access-Token 1 h + Refresh-Token)
4. supabase-js speichert die Sitzung (Handy: `LargeSecureStore`, Web: localStorage)
5. `onAuthStateChange` im `AuthProvider` -> `session` gesetzt
6. `_layout.tsx`: guard "angemeldet" wird wahr -> Startseite
7. `useProfile` -> `GET /rest/v1/profiles?...` mit Access-Token -> Postgres prueft RLS -> nur eigenes Profil

## Sitzung sicher speichern (Handy)

Die Sitzung enthaelt Tokens, mit denen man als Nutzer handeln kann. Daher:
- AES-256-Schluessel zufaellig erzeugen und in **SecureStore** ablegen (iOS Keychain, Android Keystore)
- Sitzung mit diesem Schluessel verschluesseln und in AsyncStorage ablegen
  (SecureStore allein ist fuer grosse Werte auf manchen iOS-Versionen ungeeignet)
- Im Browser gibt es kein SecureStore; dort nutzt supabase-js localStorage.

## Texte (i18n)

Alle sichtbaren Texte stehen in `src/core/i18n/de.ts` und `en.ts`, im Code nur Schluessel:
`t('auth.signIn.title')`. Die Sprache folgt dem Geraet (Deutsch, sonst Englisch moeglich).
TypeScript und ein Test pruefen, dass beide Dateien dieselben Schluessel haben.
Neue Texte: Schluessel in beiden Dateien anlegen.

## Selbst ausprobieren

1. Rancher Desktop laeuft; in `backend/`: `npm run db:start`
2. Einmalig: `frontend/.env.example` nach `frontend/.env.local` kopieren, Schluessel aus
   `npm run db:status` (backend) eintragen
3. In `frontend/`: `npm run web` -> `http://localhost:8081`
4. Registrieren; den Code findest du im Mail-Testpostfach `http://127.0.0.1:54324`
5. In Studio (`http://127.0.0.1:54323`) unter `auth.users`, `profiles`, `organizations` nachsehen

Auf dem Handy: in `.env.local` statt `127.0.0.1` die WLAN-IP des Laptops eintragen
(`ipconfig`, "IPv4-Adresse"), dann `npm start` und QR-Code scannen.
