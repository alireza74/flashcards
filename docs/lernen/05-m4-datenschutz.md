# 05 - M4: Datenschutz

Stand: 20.11.2026. Betroffenenrechte per Knopfdruck, Pflicht fuer App Store und Play Store.

## Was es gibt

| Funktion | Wo in der App | Datenbank (Migration `0006_privacy.sql`) |
|---|---|---|
| Einwilligungen (Analyse, Absturzberichte, Push, Personalisierung) | Profil -> Datenschutz, Schalter | Tabelle `consents` (nur anfuegen), View `current_consents` |
| Datenexport als JSON | Profil -> "Daten exportieren" | Funktion `export_my_data()` |
| Konto loeschen (30 Tage Karenz) | Profil -> "Konto loeschen" (zweistufig) | `request_account_deletion()`, `profiles.deletion_requested_at` |
| Loeschung abbrechen | Startseite, Hinweis nach erneuter Anmeldung | `cancel_account_deletion()` |
| Endgueltige Loeschung | automatisch, taeglich 03:15 UTC | `private.purge_deleted_accounts()` + pg_cron-Job |
| Datenschutzerklaerung, Impressum | `/privacy-policy`, `/imprint`, ohne Anmeldung | - |

## Wichtige Entscheidungen

- **Einwilligungen werden nie geaendert**, nur neue Zeilen angefuegt (Zustimmung, Widerruf).
  So ist nachweisbar, wer wann welcher Textversion (`CONSENT_TEXT_VERSION`) zugestimmt hat.
  Bei geaendertem Einwilligungstext die Version in `privacy-api.ts` erhoehen.
- **Loeschung mit Karenz:** Status `deleted` sofort, endgueltig nach 30 Tagen. Wer sich in der
  Zeit anmeldet, sieht den Hinweis und kann abbrechen.
- **Letzter Eigentuemer:** Wer einziger Eigentuemer eines Teams mit weiteren Mitgliedern ist,
  muss erst die Rolle uebertragen (Fehler `last_owner`).
- **Endgueltige Loeschung** entfernt persoenliche Organisation, Teams ohne weitere Mitglieder
  und den Nutzer in `auth.users`; alles andere folgt per `on delete cascade`.
  Im Protokoll bleibt nur "account.purged" mit der (nun bedeutungslosen) ID.
- **Export:** im Browser als Download, auf dem Handy ueber den Teilen-Dialog.
- Funktionen `public.*` mit `security definer` pruefen selbst `auth.uid()` und sind fuer `anon` gesperrt.

## Fachanwendungen

Jede Fachanwendung muss
1. ihre Tabellen in `export_my_data()` ergaenzen (neue Migration mit `create or replace function`),
2. beim Loeschen pruefen, ob `on delete cascade` reicht oder Dateien (Storage) mitgeloescht werden muessen.

## Tests

`backend/supabase/tests/database/05_privacy.test.sql` (22 Pruefungen): Einwilligungen nur eigene und
nicht aenderbar, Export ohne fremde Daten, Loeschen/Abbrechen, letzter Eigentuemer, anon gesperrt,
Loeschjob loescht nur nach 30 Tagen, Job ist eingeplant.

## Offen vor Veroeffentlichung

- Texte von Datenschutzerklaerung und Impressum sind Platzhalter -> juristisch pruefen.
- AV-Vertraege mit Supabase und Expo; Verzeichnis der Verarbeitungstaetigkeiten.
- pg_cron auf dem Cloud-Projekt pruefen (Erweiterung muss dort aktiviert sein).
