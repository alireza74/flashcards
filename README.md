# base-app

Wiederverwendbare Basis-App: Anmeldung, Rollen und Berechtigungen, Profil,
Datenschutzfunktionen, CI und Deployment. Fachliche Anwendungen entstehen
als Klon dieser Vorlage.

Erste geplante Fachanwendung: Sprachlern-App nach der Leitner-Kartei.

## Struktur

| Ordner | Inhalt |
|---|---|
| `frontend` | Expo-App (React Native, TypeScript) |
| `backend/supabase` | Migrationen, Edge Functions, Supabase-Konfiguration |
| `docs` | Wissensdatei, Plan, Entscheidungen |

## Dokumentation

Alle Entscheidungen und offenen Punkte stehen in `docs/Grundapp-Wissen.md`.
Diese Datei bei jeder Sitzung lesen und ergaenzen.

## Eine neue App aus dieser Vorlage

1. Repo klonen und umbenennen
2. Neues Supabase-Projekt anlegen, Migrationen einspielen
3. Name, Icon und Farben anpassen
4. Fachliche Tabellen als neue Migration ergaenzen
