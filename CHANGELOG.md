# Changelog base-app

Was sich in der Basis geaendert hat - damit Klone wissen, was sie per `git merge upstream/main`
uebernehmen und ob danach etwas zu tun ist ("Aktion").

## Unveroeffentlicht

### Hinzugefuegt
- Code-Seite: Knopf "Zurueck zur Anmeldung" (neuer Text-Schluessel ).
- Unbekannte Auth-Fehler werden zur Diagnose protokolliert (nur name, code, status).

### Behoben
- Build Android: Code wird vor dem Pruefschritt geholt.

### Aktion fuer Klone
- Eigene Sprachabschnitte pruefen: Schluessel  ist neu.

## 0.1.0 - 20.11.2026

Erste vollstaendige Basis (Meilensteine M0 bis M6).

### Hinzugefuegt
- **M0** Expo SDK 58 (React Native 0.88, TypeScript 6), Struktur `src/app|config|core|shared|features`,
  `app-identity.json`, ESLint, Jest, Web-Export, lokales Supabase, CI.
- **M1** Datenbank: Organisationen (Mandanten), Mitgliedschaften, Profile, Rollen/Rechte mit
  `private.has_permission`, RLS auf allen Tabellen, Registrierungs-Trigger, `app_settings`,
  `feature_flags`, `audit_log`, pgTAP-Tests, erzeugte TypeScript-Typen. Migrationen 0001-0005.
- **M2** Anmeldung: Registrieren mit 6-stelligem Code, Anmelden, Passwort vergessen, Abmelden,
  verschluesselte Sitzung auf dem Handy, Zugangsschutz, i18n (DE/EN).
- **M3** Profilseite, Passwort aendern, Persisch mit RTL, Sprache im Profil gespeichert,
  Design-Bausteine, einheitliche Lade- und Fehlerzustaende.
- **M4** Einwilligungen, Datenexport (JSON), Kontoloeschung mit 30 Tagen Karenz und taeglichem
  Loeschjob (pg_cron), Datenschutzerklaerung und Impressum (Platzhalter). Migration 0006.
- **M5** Mindestversion-Schalter, `eas.json`, Workflows Deploy Staging / Release Production /
  Build Android, Backup- und Rueckspiel-Ablauf.
- **M6** Klon-Anleitung (`docs/KLONEN.md`), dieses Changelog, `.gitattributes` (LF).

### Aktion fuer Klone
- Keine (erste Version).

<!--
Vorlage fuer neue Eintraege:

## 0.2.0 - TT.MM.JJJJ
### Hinzugefuegt / Geaendert / Behoben
- ...
### Aktion fuer Klone
- z. B. "npm install in frontend", "npm run db:reset", "neuen Text-Schluessel X uebersetzen"
-->
