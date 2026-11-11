# Grundapp - Wissensdatei

Zentrale Datei fuer das Vorhaben "Grundapp" (Repo `base-app`): eine wiederverwendbare
Basis-App, aus der spaeter mehrere fachliche Apps entstehen.

Erste Fachanwendung: Sprachlern-App nach der Leitner-Kartei.
Weitere Idee (zurueckgestellt): Sportnachrichten auf Persisch.

Ablage: `C:\Users\alh\OneDrive - abat AG\Dokumente\MY-APPS\base-app`

Stand: 11.11.2026
Diese Datei bei jeder Sitzung lesen und mit neuen Entscheidungen ergaenzen.

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

## 6. Fachanwendung Sportnachrichten - rechtlicher Rahmen

Ausfuehrlich geprueft, Ergebnis bindend fuer die spaetere Umsetzung:

- **Zulaessig:** RSS-Feeds nutzen und Titel, Teaser, Zeit, Quelle anzeigen; Artikel oeffnet
  die Originalseite. Nutzung von Chrome Custom Tabs bzw. SFSafariViewController,
  nicht eigene WebView (sonst Framing-Risiko). Nichts ausblenden, kein Reader-Modus.
- **Zulaessig:** strukturierte Sportdaten (Ergebnisse, Tabellen, Aufstellungen) - Fakten sind frei.
- **Nicht zulaessig:** Volltexte uebernehmen, Scraping, Bilder nachladen, Paywalls umgehen.
- **Nicht tragfaehig:** Hosting im Iran, Vertrieb ohne Store, Umschreiben einzelner Artikel per KI.
  Haftung folgt der Person in Deutschland, nicht dem Serverstandort; Agenturtexte (Reuters, AFP, dpa)
  sind auch ueber iranische Zwischenquellen geschuetzt; Sanktionsrecht bei iranischen Dienstleistern.
- **Moeglich mit Auflagen:** eigener Artikel aus 10+ Quellen plus geprueften Sportdaten per KI-Agent.
  Bedingungen: nur Fakten aus mindestens drei unabhaengigen Quellen, harte Zahlen ausschliesslich
  aus der Sportdaten-API, keine generierten Zitate, Aehnlichkeitspruefung gegen die Quelltexte,
  presserechtliche Verantwortung liegt dann beim Betreiber.
- Iran wird von Play Store und App Store nicht bedient; reale Zielgruppe ist die Diaspora.

Empfohlener Start der Fachanwendung: nur Sportdaten plus Feed-Teaser mit Link,
KI-Redaktion erst als zweite Stufe.

---

## 7. Architektur (Zielbild)

Cron-Job im Backend holt Feeds und Sportdaten, normalisiert, schreibt nach Postgres.
Nur dieser Job spricht nach aussen, nie die App. App holt ihren personalisierten Feed
ueber eine Edge Function (Cursor-Pagination, gecacht) und oeffnet Artikel im Browser-Tab.
Auth liefert das Token, RLS entscheidet pro Zeile.

---

## 8. Offene Punkte

1. Juristische Pruefung des Datenschutzteils vor Veroeffentlichung.
2. App-Name, Icon, Farbschema noch offen.
3. Supabase-Projekte (Staging und Produktion) noch nicht angelegt.

Entschieden am 11.11.2026, frueher offen:
- Mandantenfaehigkeit: **nein**. Einzelnutzer-Apps, keine Organisationen.
  Falls eine spaetere App es braucht, ist das deren Erweiterung.
- Anmeldung: zunaechst **nur E-Mail und Passwort**. Google und Apple spaeter.
  Das Profilmodell wird aber schon so gebaut, dass ein Nutzer mehrere
  Anmeldearten haben kann (vermeidet spaetere Migration).

---

## 9. Projektstruktur

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

## 10. Meilensteinplan der Grundapp

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

## 11. Erste Fachanwendung: Sprachlern-App

Methodik: **Leitner-Kartei** (Sebastian Leitner, 1972), verteiltes Wiederholen.

- 5 Faecher. Neue Karte startet in Fach 1.
- Richtig beantwortet: die Karte rueckt ein Fach weiter.
- Falsch beantwortet: zurueck nach Fach 1, unabhaengig vom bisherigen Fach.
- Aus Fach 5 heraus gilt die Karte als gelernt.
- Abstaende je Fach, z. B. 1 / 2 / 4 / 9 / 14 Tage.

Digital wird **nicht** die Fachgroesse abgebildet, sondern pro Karte das Fach und
das naechste Faelligkeitsdatum; die Tagesabfrage holt alle faelligen Karten.
Die Vorgabe "10 Vokabeln taeglich" steuert nur die Zahl **neuer** Karten;
Wiederholungen kommen zusaetzlich und schwanken.

Bewusste Entscheidung: Leitner statt SM-2 oder FSRS. Diese sind messbar
effizienter, aber komplexer. Da pro Karte ohnehin Faelligkeitsdatum und
Historie gespeichert werden, ist ein spaeterer Wechsel moeglich.

Umsetzung erst, wenn die Grundapp vollstaendig funktioniert.

---

## 12. Chronik

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
