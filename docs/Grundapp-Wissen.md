# Grundapp - Wissensdatei

Zentrale Datei fuer das Vorhaben "Grundapp" (Repo `base-app`): eine wiederverwendbare
Basis-App, aus der spaeter mehrere fachliche Apps entstehen.

Erste Fachanwendung: Sprachlern-App nach der Leitner-Kartei.
Weitere Idee (zurueckgestellt): Sportnachrichten auf Persisch.

Ablage: `C:\Users\alh\Documents\MY-APPS\base-app`

Stand: 20.11.2026
Diese Datei bei jeder Sitzung lesen und mit neuen Entscheidungen ergaenzen.

Inhalt: nur Wissen zur base-app (Aufbau, wichtiger Code, Fehler und Loesungen).
Uebergreifende Entscheidungen und Fachanwendungen (Sprachlern-App, Sportnachrichten,
WandAkte): `../../MY-APPS-Wissen.md`.
Recherchierte Architektur, Vorgehen und ueberarbeitete Meilensteine: `Architektur-Grundlage.md`.

---

## 1. Ziel

- Zuerst eine allgemeine Grundapp bauen, keine Fachanwendung.
- Die Grundapp enthaelt Anmeldung, Rollen, Berechtigungen, Profil, Deployment, CI.
- Fuer jede neue Idee wird das Repo als Vorlage geklont und nur die Fachlogik ergaenzt.
- Langfristiges Ziel: Veroeffentlichung im App Store und Play Store, viele Nutzer.

---

## 2. Technische Entscheidungen

| Thema | Entscheidung | Begruendung |
|---|---|---|
| Frontend | React Native mit Expo, TypeScript | ein Code fuer iOS und Android, JS/TS wie bei UI5 bekannt, Cloud-Build per EAS |
| Backend | Supabase (Postgres, Auth, Edge Functions) | kein eigener Betrieb, Auth und API fertig; entscheidend ist der Ausstieg: Schema, SQL-Migrationen und RLS bleiben Standard-Postgres und sind notfalls selbst hostbar |
| Frontend geprueft | Flutter am 11.11.2026 erneut abgewogen, Entscheidung bleibt React Native | Flutter technisch einen Tick besser (eigenes Rendering, weniger Abhaengigkeitsbrueche), aber Dart waere neu; vorhandenes JS/TS-Wissen und Expo (Build, Updates, Store) geben den Ausschlag |
| Verworfen | Kotlin nativ bzw. Swift | nur eine Plattform je Sprache, als Einzelentwickler doppelte Arbeit |
| Verworfen | Firebase | dokumentenbasiert ohne echte Verknuepfungen; fuer Decks, Karten und Lernhistorie umstaendlich, Ausstieg faktisch Neubau |
| Verworfen | eigenes Backend | Auth, Mailversand, Token-Erneuerung, Monitoring und Betrieb selbst zu bauen kostet Wochen ohne fachlichen Nutzen |
| Verworfen | SAPUI5 mit Cordova | Cordova faktisch tot, UI5 ist Business-UI, keine Store-Optik |
| Verworfen | MDK | an SAP Mobile Services gebunden, kein freier Store-Vertrieb |
| Serverstandort | EU (Frankfurt) | vermeidet Drittlandtransfer-Diskussion |
| Kommunikation | HTTPS/JSON, Supabase-Client; eigene Edge Functions fuer Logik | - |
| Token | nach Login in sicherem Geraetespeicher, bei jedem Request mitgesendet | - |
| Schluessel | nur URL und oeffentlicher Schluessel in der App; Service-Key ausschliesslich serverseitig | haeufigster Anfaengerfehler |

---

## 3. Datenmodell der Grundapp

Nur Basis, keine fachlichen Tabellen.

- `profiles` - Anzeigename, Avatar, Sprache, Zeitzone, Status (aktiv/gesperrt/geloescht);
  wird per Trigger bei Registrierung angelegt
- `roles` - Rollenname, Beschreibung
- `permissions` - Einzelrechte, z. B. `users.read`, `users.manage`, `content.publish`
- `role_permissions` - Verknuepfung Rolle zu Recht
- `user_roles` - Zuordnung Nutzer zu Rolle (bewusst eigene Tabelle, nicht Spalte im Profil)
- `consents` - Nutzer, Zweck, Textversion, Zeitpunkt, Status
- `audit_log` - wer hat wann was geaendert (Handlungen, keine Inhalte)
- `app_settings` - Schalter ohne neues Release
- `feature_flags` - schrittweise Freischaltung

Konventionen: jede Tabelle mit UUID-`id`, `created_at`, `updated_at`.

**Zentrales Prinzip Berechtigungen:** Policies fragen nie nach der Rolle, sondern
nach dem Recht, ueber eine DB-Funktion `has_permission('...')`. Neue Rollen sind
dann reine Datensaetze, keine Codeaenderung.

Row Level Security auf jeder Tabelle, ausnahmslos. Der Ingestion-/Service-Zugriff
umgeht RLS bewusst, weil er kein Nutzer ist.

---

## 4. Datenschutz (von Anfang an mitgebaut)

- Datensparsamkeit: in der Basis nur E-Mail und Anzeigename; jedes weitere Feld braucht eine Begruendung
- Einwilligung getrennt vom Betrieb: Analyse, Crash-Reports, Push und Personalisierung nur nach aktiver Zustimmung
- Crash-Reporting/Tracking erst nach Zustimmung initialisieren, nicht beim App-Start
- `consents` mit Textversion, damit nachweisbar ist, wozu zugestimmt wurde; einzeln widerrufbar
- Datenexport als JSON per Knopf in den Einstellungen
- Kontoloeschung: sofortige Deaktivierung, endgueltige Loeschung nach 30 Tagen Karenz;
  Fremdschluessel `on delete cascade` bzw. `set null` von Anfang an richtig setzen
- Aufbewahrungsfristen je Tabelle plus Loeschjob; Logs 30-90 Tage
- Keine personenbezogenen Daten in Logs (haeufigster Verstoss in der Praxis)
- AV-Vertraege mit Supabase, Expo, Sentry, Push-Dienst
- Verzeichnis der Verarbeitungstaetigkeiten anlegen
- Datenschutzerklaerung und Impressum in der App erreichbar
- Offen: juristische Pruefung vor Veroeffentlichung (Datenschutzerklaerung, Rechtsgrundlagen, DSB-Pflicht)

---

## 5. Softwaretechnik und Betrieb

- Git ab der ersten Zeile, `main` geschuetzt, Feature-Branches, Pull Requests
- GitHub Actions: Lint, Typpruefung, Tests bei jedem Push
- Zwei getrennte Supabase-Projekte: Staging und Produktion; nie auf Produktion entwickeln
- Schema ausschliesslich als Migrationsdateien im Repo, nie in der Weboberflaeche aendern
- Lokal Supabase im Docker-Container
- Builds ueber Expo EAS
- Automatische Backups einschalten und eine Wiederherstellung einmal testen
- Sentry fuer Crash-Reports (erst nach Einwilligung)
- Zweisprachigkeit und RTL (Persisch) von Anfang an, nachtraeglich sehr aufwendig

---

## 6. Offene Punkte


Stand 20.11.2026 nach M0-M6:

1. **Braucht Alirezas Konten** (Anleitung `docs/lernen/06-m5-auslieferung.md`):
   Supabase-Projekte Staging/Produktion (EU), Auth-Einstellungen + Mail-Vorlagen + eigener SMTP,
   Expo-Konto + `eas init` + EAS-Umgebungsvariablen, GitHub-Secrets/Variablen, erste APK,
   Backup-Rueckspieltest mit Staging-Daten, pg_cron auf dem Cloud-Projekt pruefen.
2. Juristische Pruefung: Datenschutzerklaerung, Impressum, Einwilligungstexte (Platzhalter in i18n).
   AV-Vertraege (Supabase, Expo), Verzeichnis der Verarbeitungstaetigkeiten.
3. App-Name, Icon, Farbschema, Bundle-IDs (`app-identity.json`, Platzhalter `de.example.baseapp`).
4. Persische Texte (`fa.ts`) von Muttersprachler pruefen; RTL auf dem Handy testen.
5. Test auf echtem Handy (Expo Go bzw. APK): Sitzungsspeicher, Export per Teilen-Dialog, RTL-Neustart.

**Technische Schulden** (regelmaessig abbauen):
- App-Start ohne Netz und mit abgelaufenem Token dauert ca. 15 s (Splash bleibt stehen).
  Loesungsidee: Startseite sofort aus gespeicherter Sitzung zeigen, Erneuerung im Hintergrund.
- CI prueft Routennamen nur grob (`.expo/types/router.d.ts` entsteht nur bei `expo start`).
- Keine Oberflaechentests (Maestro) und keine Komponententests; nur Logik (Jest) und DB (pgTAP).
- Keine Team-Funktionen: Team-Organisation anlegen, Einladungen, Rollen vergeben in der App
  (Datenbank kann es, UI fehlt) - Plan "spaeter" in Architektur-Grundlage Abschnitt 15.
- Sentry/Absturzberichte nicht eingebaut (Einwilligung `crash_reports` existiert schon).
- Tabellenrechte fuer `anon`/`authenticated` kommen aus Supabase-Standardrechten; robuster waere,
  sie in jeder Migration ausdruecklich zu vergeben (dann unabhaengig von Projekteinstellungen).

Entschieden am 11.11.2026, frueher offen:
- Mandantenfaehigkeit: am 11.11. verneint, **am 20.11.2026 revidiert: ja.**
  Organisationen von Anfang an in der Basis (`organizations`, `organization_members`,
  `organization_id` in jeder Fachtabelle inkl. Audit-Log). Bei Registrierung wird eine
  persoenliche Organisation angelegt; Einzelnutzer-Apps merken davon nichts.
  Grund: Nachruesten ist laut Recherche der teuerste Umbau; WandAkte braucht Betriebe.
  Details: `Architektur-Grundlage.md`, Abschnitt 3. Meilensteinplan dort (M0-M6) ersetzt Abschnitt 8.
- Anmeldung: zunaechst **nur E-Mail und Passwort**. Google und Apple spaeter.
  Das Profilmodell wird aber schon so gebaut, dass ein Nutzer mehrere
  Anmeldearten haben kann (vermeidet spaetere Migration).

---

## 7. Projektstruktur

```
base-app/
  frontend/            Expo-App (React Native, TypeScript)
  backend/supabase/    migrations/, functions/, Konfiguration
  docs/                diese Wissensdatei, Plan, Entscheidungen
  README.md, .gitignore
```

Begruendung: Monorepo, weil Schema und App zusammen versioniert werden.
Der Unterordner heisst `supabase`, weil die Supabase-CLI diesen Namen erwartet.
Ordnernamen englisch, Inhalte deutsch.

---

## 8. Meilensteinplan der Grundapp (ueberholt, gilt: Architektur-Grundlage.md Abschnitt 15)

| Nr. | Inhalt | Ergebnis |
|---|---|---|
| M0 | Repo, Expo + TypeScript, Linter, erste GitHub Action, Supabase Staging, lokale Docker-Umgebung | leere App startet auf dem Geraet, CI gruen |
| M1 | Alle Basistabellen als Migrationen, RLS, `has_permission`, Trigger fuer Profilanlage, Startdaten Rollen/Rechte | Schema laesst sich frisch aufspielen |
| M2 | Registrieren, E-Mail-Bestaetigung, Anmelden, Passwort vergessen, Abmelden, Token sicher speichern, Sitzung ueberlebt Neustart | man kommt rein und bleibt drin |
| M3 | Profilseite, Einstellungen, Sprache mit RTL, Admin-Bereich mit Nutzerliste und Rollenvergabe | Rollenmechanismus sichtbar und wirksam |
| M4 | Einwilligungsabfrage, Widerruf, JSON-Export, Kontoloeschung mit Karenz, Loeschjob, Datenschutzerklaerung und Impressum | Betroffenenrechte funktionieren per Knopfdruck |
| M5 | Tests fuer DB-Funktionen und Policies, Oberflaechentests Anmeldung/Profil, einheitliche Fehler- und Ladezustaende | automatischer Nachweis, dass niemand fremde Daten sieht |
| M6 | Produktions-Supabase, Freigabeprozess Staging nach Produktion, erster EAS-Build als APK, Backup-Rueckspielung testen | installierbare App und kontrollierter Auslieferweg |
| M7 | Aufraeumen, README mit Klon-Anleitung, Platzhalter fuer Name/Icon/Farben zentralisieren | Grundlage ist klonbar |

Reihenfolge-Hinweise: M1 vor M2, sonst wird die Anmeldung zweimal gebaut.
M4 vor M5, weil Loeschung und Export in die Tests gehoeren.
M5 nicht ueberspringen - ein Fehler in den Policies ist ein Datenleck.

---

## 9. Wichtiger Code

Hier zentrale Code-Stellen festhalten (Datei, Zweck, Besonderheit), sobald sie entstehen.

| Datei | Zweck | Hinweis |
|---|---|---|
| `frontend/src/config/app-identity.json` | Name, Version, Kennungen, Farbe - einzige Stelle je Klon | JSON statt TS, weil `app.config.ts` keine weiteren TS-Dateien laden kann |
| `frontend/app.config.ts` | Expo-Konfiguration, liest `app-identity.json` | `runtimeVersion` Policy `appVersion`; Web `output: single` (SPA, statisch auslieferbar) |
| `frontend/src/app/` | Routen (Expo Router) | SDK 58 legt Routen unter `src/app` ab (nicht `app/` wie in Architektur-Grundlage); Routen duenn, Screens aus `src/core`/`src/features` |
| `frontend/src/shared/lib/version.ts` | Versionsvergleich fuer Mindestversion-Schalter (M5) | erster Jest-Test |
| `frontend/tsconfig.json` | `types: ["jest"]` | TypeScript 6 bindet `@types/*` nicht mehr automatisch ein |
| `backend/package.json` | Supabase-CLI als devDependency, Skripte `db:*` | keine globale Installation noetig |
| `.github/workflows/ci.yml` | Job frontend (Lint, Typen, Tests, Web-Build) + Job database (Migrationen, pgTAP, db lint, Typ-Abgleich) | Typ-Abgleich per `git diff --exit-code` |
| `backend/supabase/migrations/0001-0005_*.sql` | Basisschema M1 | Basis-Nummernkreis `0001_`; Klone nutzen Zeitstempel. Systemrollen/-rechte in Migration, nicht seed.sql (seed laeuft nur lokal) |
| `private.has_permission(org, key)` u. a. | Berechtigungspruefung fuer Policies | security definer + `search_path = ''`; umgeht RLS und vermeidet Rekursion |
| `private.prevent_last_owner_removal()` | Organisation behaelt immer einen Eigentuemer | erlaubt Kaskade (Organisation/Nutzer geloescht); Fehler `P0001`, hint `last_owner` |
| `backend/supabase/tests/database/` | 43 pgTAP-Pruefungen | Gegenprobe mit absichtlich offener Policy: Test 03 wird rot |
| `frontend/src/core/supabase/database.types.ts` | erzeugte Typen | `npm run db:types` in backend; nie von Hand aendern |
| `frontend/src/core/supabase/client.ts` | Supabase-Client | Handy: LargeSecureStore, Web: localStorage; `detectSessionInUrl: false`; AppState steuert Auto-Refresh |
| `frontend/src/core/supabase/large-secure-store.ts` | verschluesselte Sitzung | Muster Supabase-Doku, aber expo-crypto statt react-native-get-random-values (in Expo Go enthalten) |
| `frontend/src/app/_layout.tsx` | Zugangsschutz | `Stack.Protected`; Gruppe new-password nur bei `isPasswordRecovery` |
| `frontend/src/core/auth/auth-api.ts` | Auth-Aufrufe | verifyOtp: Registrierung `type: 'email'`, Passwort `type: 'recovery'` (lokal geprueft) |
| `backend/supabase/templates/*.html` | Mail-Vorlagen mit Code | `{{ .Token }}`; config.toml `[auth.email.template.*]`; Aenderung erst nach `supabase stop/start` |

---

## 10. Fehler und Loesungen

Aufgetretene Fehler mit Ursache und Loesung, damit sie nicht zweimal gesucht werden.

| Datum | Fehler | Ursache | Loesung |
|---|---|---|---|
| 20.11.2026 | `expo lint`/`expo install` brechen ab, `require` in `app.config.js` scheitert | `app.config.ts` importierte `src/config/app.config.ts`; Expo kann aus der Config keine weiteren TS-Dateien laden | Werte in `app-identity.json`, beide Seiten importieren das JSON |
| 20.11.2026 | `tsc`: `Cannot find name 'describe'` | TypeScript 6 laedt `@types/jest` nicht mehr automatisch | `"types": ["jest"]` in `tsconfig.json` |
| 20.11.2026 | Jest-Pakete landeten in `dependencies` | `npx expo install ... -- --save-dev` hat das Flag nicht durchgereicht | danach `npm install --save-dev` mit denselben Versionen |
| 20.11.2026 | `docker info`: Pipe nicht gefunden | Rancher Desktop nicht gestartet | Rancher Desktop starten, dann `npm run db:start` |
| 21.11.2026 | Build Android: `No such file or directory` fuer `.../frontend` | Pruefschritt lief vor `actions/checkout`, Standard-Arbeitsordner `frontend` existierte noch nicht | checkout als ersten Schritt |
| 20.11.2026 | Backup einspielen: `duplicate key ... app_settings_key_key` | Migrationen legen Startdaten an, das Daten-Backup enthaelt sie ebenfalls | vor dem Einspielen `truncate public.role_permissions, public.roles, public.permissions, public.app_settings cascade` |
| 20.11.2026 | Nach Abmelden erscheint das Impressum statt der Anmeldeseite | Stack.Protected ohne `redirectTo` springt auf den Anker des Navigators (erste ungeschuetzte Seite) | `redirectTo` an jeder Protected-Gruppe setzen (`_layout.tsx`) |
| 20.11.2026 | "Aktuelle Einwilligung" zufaellig bei zwei Eintraegen in einer Transaktion | `now()` ist in einer Transaktion konstant | `created_at default clock_timestamp()` |
| 20.11.2026 | "Abmelden" tut nichts, wenn Supabase nicht erreichbar ist | `signOut()` nutzt standardmaessig `scope: 'global'`; bei Netzfehler gibt supabase-js den Fehler zurueck und laesst die lokale Sitzung stehen (Quelltext auth-js `_signOut` geprueft) | `signOut({ scope: 'local' })`: loescht zuerst lokal, informiert danach den Server. Offline und online getestet (online: Sitzung in `auth.sessions` widerrufen) |
| 20.11.2026 | App-Start dauert ca. 15 s, wenn Supabase nicht erreichbar und Token abgelaufen | `getSession` versucht mehrmals, das Token zu erneuern, bevor es zurueckkehrt | offen, siehe Technische Schulden |
| 20.11.2026 | Dev-Server laeuft nach `TaskStop` weiter (Port belegt) | Beenden der Shell beendet den Node-Kindprozess unter Windows nicht | Dev-Server im Terminal-Tab starten und mit Strg+C beenden, oder Prozess auf Port 8081 gezielt beenden |
| 20.11.2026 | Code-Aenderung erscheint nicht im Browser | Metro-Watcher bemerkt mit `sed -i` ersetzte Dateien unter Windows nicht | Dev-Server mit `--clear` neu starten; Dateien besser im Editor aendern |
| 20.11.2026 | Schaltflaechen ohne Namen fuer Screenreader (Web) | `accessibilityLabel`/`accessibilityRole` an Pressable wirkt in react-native-web 0.21 nicht | `role`, `aria-label`, `aria-disabled`, `aria-busy` verwenden |
| 20.11.2026 | Typfehler bei `router.push('/neue-seite')` | `.expo/types/router.d.ts` veraltet; wird nur von `expo start` erzeugt, nicht von `expo export` | Dev-Server einmal starten. In der CI fehlt die Datei, dort sind Routen nur grob typisiert |
| 20.11.2026 | `onSubmitEditing={onSubmit}` Typfehler | react-hook-form `handleSubmit` erwartet ein anderes Event als TextInput liefert | `onSubmitEditing={() => onSubmit()}` |
| 20.11.2026 | `supabase start` bricht ab: `timed out dialing Hyper-V socket` | Kubernetes in Rancher Desktop abgeschaltet -> VM-Neustart, Verbindung Windows-VM hing danach | Rancher Desktop komplett neu starten (`rdctl shutdown`, dann App/`rdctl start`), danach `supabase start` erneut; Images bleiben erhalten |

---

## 11. Chronik

- 10.11.2026 - Idee besprochen; Technologiewahl getroffen (React Native/Expo + Supabase),
  UI5/Cordova und MDK verworfen. Rechtslage Nachrichtenuebernahme ausfuehrlich geklaert,
  Ergebnis: RSS-Teaser plus Link. Entscheidung, zuerst eine allgemeine Grundapp zu bauen.
  Backend-Planung und Datenschutzmassnahmen festgelegt. Diese Wissensdatei angelegt.
- 11.11.2026 - Erste Fachanwendung festgelegt: Sprachlern-App nach Leitner-Kartei
  (Sportnachrichten zurueckgestellt). Mandantenfaehigkeit verneint, Anmeldung
  zunaechst nur per E-Mail. Meilensteinplan M0 bis M7 beschlossen.
  Projektordner `base-app` angelegt (vormals `basic`, `doku` zu `docs`),
  Git initialisiert, README und .gitignore erstellt, Wissensdatei nach `docs` umgezogen.
  Technologiewahl auf Nachfrage erneut geprueft (Flutter, Kotlin, Firebase, eigenes Backend):
  Entscheidung fuer React Native und Supabase bestaetigt.
- 20.11.2026 - Uebergreifende Wissensdatei `MY-APPS/MY-APPS-Wissen.md` angelegt.
  Fachanwendungen (Abschnitte Sportnachrichten-Recht und Sprachlern-App) dorthin verschoben;
  diese Datei enthaelt nur noch base-app-Wissen. Abschnitte Wichtiger Code und Fehler ergaenzt.
- 20.11.2026 - Recherche zu Erfahrungen anderer (Supabase, Expo, Mandanten, Offline, Deployment);
  Ergebnis in `Architektur-Grundlage.md` inkl. ueberarbeitetem Meilensteinplan M0-M6.
- 20.11.2026 - Entscheidung: Organisationen (Mandanten) von Anfang an in der Basis.
  Meilensteinplan aus `Architektur-Grundlage.md` gilt ab jetzt.
- 20.11.2026 - Ordner aus OneDrive nach `C:\Users\alh\Documents\MY-APPS` verschoben.
- 20.11.2026 - M0 begonnen: Expo SDK 58 (React Native 0.88, React 19.3, TypeScript 6),
  Demo-Inhalte entfernt, Ordnerstruktur `src/app|config|core|shared|features`,
  `app.config.ts` + `app-identity.json`, ESLint, Jest, Web-Export, expo-doctor 20/20.
  Supabase-CLI 3.2.0 in `backend/`, `supabase init` (project_id `base-app`).
  CI-Workflow angelegt. Lernunterlagen `docs/lernen/00-ueberblick.md`, `01-lokal-starten.md`.
  Offen fuer M0: `supabase start` (Docker lief nicht), Start auf dem Handy (Expo Go).
- 20.11.2026 - GitHub-Repo `alireza74/base-app` (privat) angelegt und gepusht; erster CI-Lauf gruen.
  Commits mit GitHub-noreply-Adresse (nur lokal fuer dieses Repo gesetzt);
  Remote-URL enthaelt `alireza74@`, weil im Credential Manager sonst das Arbeitskonto greift.
- 20.11.2026 - Lokales Supabase laeuft (Postgres 17, Studio unter http://127.0.0.1:54323).
  Kubernetes in Rancher Desktop abgeschaltet (nicht benoetigt).
- 20.11.2026 - Dev-Server fuer Expo Go gestartet (QR-Code, `exp://<Laptop-IP>:8081`).
  Handy-Test von Alireza noch nicht bestaetigt. Damit ist M0 abgeschlossen; weiter mit M1.
- 20.11.2026 - M1 umgesetzt: Migrationen 0001-0005 (private-Schema, Rollen/Rechte, Organisationen,
  Mitgliedschaften, Profile, Registrierungs-Trigger, app_settings, feature_flags, audit_log), RLS auf
  allen Tabellen, Spaltenrechte, Schutz letzter Eigentuemer, Admin-Grenze. 43 pgTAP-Tests gruen,
  db lint ohne Befund, Typen erzeugt, CI-Job database. Startrollen: owner (alle Rechte),
  admin (members.read/manage, settings.manage, audit.read), member (members.read).
  Bewusst offen: Team-Organisation anlegen (RPC) und Einladungen -> spaeter; verwaiste persoenliche
  Organisation bei Kontoloeschung -> M4. Lernunterlagen `02-m1-datenbank.md`, `anleitung-neue-tabelle.md`.
  CI auf GitHub mit beiden Jobs (frontend, database) gruen. M1 abgeschlossen.
- 20.11.2026 - M2 umgesetzt: Registrieren, Anmelden, Passwort vergessen, Abmelden, Sitzung bleibt
  nach Neuladen. Bestaetigung und Passwort-Reset per 6-stelligem Code statt Link (keine Deep Links,
  keine Redirect-Listen). Lokal: Passwort min. 8 Zeichen mit Buchstaben und Ziffern, Bestaetigung an,
  Mail-Limit lokal 30/h. Neu: supabase-js, LargeSecureStore, TanStack Query, react-hook-form + zod,
  i18next (DE/EN, Geraetesprache). E-Mail wird zwischen Seiten im App-Zustand weitergegeben, nicht
  in der URL (Browser-Verlauf). Im Browser komplett durchgetestet (2 Testkonten). 21 Jest-Tests.
  Offen: eigener SMTP-Dienst (erst mit Staging in M5), Test auf dem Handy, Sprache waehlen und RTL (M3).
  Lernunterlage `03-m2-anmeldung.md`.
- 20.11.2026 - M3 umgesetzt: Profilseite (Anzeigename, Sprache, Passwort aendern, Abmelden),
  Persisch mit RTL (Web: dir am html, Handy: forceRTL + Updates.reloadAsync), Sprache in profiles.locale,
  Design-Bausteine (AppText, Card, SegmentedControl, LoadingState, ErrorState). Im Browser getestet
  (Name speichern, DE->FA->DE, Neuladen, Passwort aendern). Persische Texte von Muttersprachler pruefen.
  RTL auf dem Handy noch nicht getestet. Lernunterlage `04-m3-profil-sprache.md`.
- 20.11.2026 - M4 umgesetzt: Migration 0006 (consents nur anfuegen + View current_consents,
  export_my_data, request/cancel_account_deletion mit last_owner-Pruefung, purge_deleted_accounts,
  pg_cron taeglich 03:15 UTC), 22 neue pgTAP-Pruefungen (65 gesamt). UI: Datenschutz-Abschnitt im Profil,
  Loeschhinweis mit Abbrechen auf der Startseite, oeffentliche Seiten /privacy-policy und /imprint
  (Platzhaltertexte). Im Browser getestet (Einwilligung, Export, Loeschen, Wiederanmelden, Abbrechen).
  Fehler gefunden: nach Abmelden landete man auf /imprint -> redirectTo an Stack.Protected gesetzt.
  Lernunterlage `05-m4-datenschutz.md`.
- 20.11.2026 - M5 vorbereitet (ohne Konten): Mindestversion-Schalter (app_settings.min_app_version,
  Sperrbildschirm, im Browser mit 9.9.9 getestet), eas.json (preview = APK/Kanal preview,
  production = AAB/Kanal production), easProjectId in app-identity.json, expo-updates.
  Workflows deploy-staging (nach gruener CI: db push + eas update), release-production (manuell,
  Bestaetigungswort "freigeben"), build-android (APK per Knopf). Aktiv erst mit Variablen
  STAGING_ENABLED/PRODUCTION_ENABLED. Backup-Rueckspielen lokal geprueft (Startdaten vorher leeren).
  OFFEN (braucht Alirezas Konten): Supabase-Projekte Staging/Produktion, SMTP, Expo-Konto + eas init,
  EAS-Umgebungsvariablen, GitHub-Secrets, erste APK, Rueckspieltest mit Staging-Daten.
  Anleitung: `docs/lernen/06-m5-auslieferung.md`.
- 20.11.2026 - M6: `docs/KLONEN.md` (Klon anlegen, anpassen, Regeln, upstream holen), `CHANGELOG.md`,
  README neu, `.gitattributes` (LF). upstream-Ablauf im Scratchpad nachgestellt: Klon mit eigener
  Fachfunktion + Basis-Aenderung -> Merge ohne Konflikt. Erkenntnis: spaetere Basis-Migrationen sind
  aelter als Fachmigrationen des Klons -> Workflows nutzen `db push --include-all`.
  M0-M6 damit umgesetzt; offen nur Schritte mit Konten (siehe Offene Punkte). Version 0.1.0.
- 20.11.2026 - Expo-Konto angelegt (alireza_expo), Projekt @alireza_expo/base-app, EAS-Projekt-ID in app-identity.json. Supabase-Staging-Projekt `base-app-staging` angelegt
  (Ref `vdjyqydnxegtbridgadp`, Free-Plan). Region wurde **West EU (Ireland, eu-west-1)** statt Frankfurt;
  Entscheidung Alireza: so lassen (EU, kein Drittlandtransfer). Produktion gezielt in Frankfurt anlegen.
  Optionen beim Anlegen: Data API an, "Grant API access to new tables automatically" an
  (Migrationen verlassen sich auf die Standardrechte wie lokal), "Enable RLS automatically" an.
  Erstes generiertes DB-Passwort war im Chat gelandet -> vor dem Anlegen neu erzeugt.
- 20.11.2026 - Staging-Auth im Dashboard: Passwort min. 8 + "Letters and digits", Email OTP length 6
  (Standard war 8 - haette jeden Code abgelehnt), Confirm email an. **Mail-Vorlagen sind ohne eigenen
  SMTP nicht editierbar** -> Staging verschickt die Standard-Mail mit Link statt Code.
  Entscheidung Alireza: vorerst ohne SMTP. Folge: Registrierung auf Staging per Link bestaetigen und
  danach in der App mit Passwort anmelden; Passwort-Reset auf Staging funktioniert nicht; der
  eingebaute Versand geht nur an Organisationsmitglieder (eigene Adresse). SMTP (EU-Anbieter) vor
  Tests mit weiteren Personen einrichten, dann Vorlagen aus backend/supabase/templates uebernehmen.
- 20.11.2026 - EAS-Umgebungsvariablen `preview` gesetzt (Supabase-URL, Publishable Key; `eas env:create`
  ist veraltet -> `eas env:set`). GitHub: Secrets SUPABASE_ACCESS_TOKEN, EXPO_TOKEN, Environment
  `staging` (SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD), Variable STAGING_ENABLED=true.
  Erster manueller Lauf **Deploy Staging gruen** (3:48 min, beide Jobs): Migrationen 0001-0006 auf
  Staging (geprueft: app_settings anon lesbar, organizations anon 401), EAS Update an Kanal preview.
- 21.11.2026 - Erster Android-Build (EAS, Profil preview, APK) erfolgreich: Build e8d706f4, Version 0.1.0,
  Version code 1, Dauer ca. 22 min. Signierschluessel hat EAS beim ersten Build selbst erzeugt und
  verwahrt (nicht verlieren: ohne ihn keine Updates der installierten App). Hinweis in GitHub:
  actions/checkout@v4, setup-node@v4, expo-github-action@v8 laufen noch auf Node 20 -> spaeter
  auf neuere Hauptversionen umstellen.
- 21.11.2026 - Erster Test der APK auf dem Handy gegen Staging: Registrierung, Bestaetigung, Anmeldung,
  Profil - laut Alireza funktioniert alles. Erfahrungen: eingebauter Supabase-Mailversand ist nach
  wenigen Mails pro Stunde erschoepft (Meldung "Too many emails requested"); Testkonten besser per
  Dashboard "Add user" + "Auto Confirm". Offene Kleinigkeiten: Code-Seite braucht "Zurueck zur
  Anmeldung"; unbekannte Auth-Fehler sollten den Code protokollieren (Diagnose).
