# base-app - Architektur und Vorgehen (recherchiert)

Stand: 20.11.2026
Grundlage: Recherche zu Erfahrungen anderer Entwickler mit Expo, Supabase, Mandanten,
Offline, Deployment (Quellen am Ende). Ziel: Fehler vermeiden, die andere spaeter teuer
umbauen mussten. Kennzeichnung: **[Quelle]** = in der Recherche belegt,
**[Empfehlung]** = eigene Ableitung daraus.

Leitsatz: Die base-app muss nicht vollstaendig sein, aber ihr **Fundament** muss stimmen.
Fundament = alles, was sich nachtraeglich nur mit Umbau aendern laesst.

---

## 1. Was nachtraeglich teuer ist (jetzt richtig machen)

| Thema | Warum teuer | Entscheidung |
|---|---|---|
| Mandanten (`organization_id`) | Nachruesten aendert jede Tabelle, Policy, Abfrage und jeden Test. Haeufigstes "haette ich anders gemacht" **[Quelle]** | von Anfang an, auch fuer Einzelnutzer-Apps (persoenliche Organisation bei Registrierung) |
| RLS-Muster | falsche Muster sind langsam und unsicher; Korrektur betrifft alle Policies | einheitliches Muster, siehe Abschnitt 4 |
| Migrations-Disziplin | Aenderungen im Dashboard fuehren zu Schema-Drift, Staging laesst sich nicht mehr sauber aufbauen **[Quelle]** | Schema nur per Migration, CI prueft |
| Abwaertskompatible API | alte App-Versionen laufen monatelang weiter; ein Schema-Bruch legt sie lahm **[Empfehlung]** | Erweitern-dann-Entfernen, Mindestversion-Schalter |
| Ordnerstruktur | Vermischung von Basis und Fachlogik verhindert spaeteren Rueckfluss | `src/core`, `src/features`, `src/shared` |
| Rechts-nach-links-Layout | nachtraeglich jede Komponente anfassen **[Quelle]** | von Anfang an `start/end` statt `left/right` |
| Session-Speicher | falsche Wahl = Abmeldungen, Datenverlust | Muster aus der Supabase-Doku (Abschnitt 6) |

Alles andere (Offline, Push, Bezahlung, Admin-Komfort) kann spaeter wachsen.

---

## 2. Gesamtarchitektur

```
Expo-App (iOS, Android, Web)            ein Code, TypeScript
  app/            Routen (duenn)
  src/core/       Basis: Auth, Organisation, Rechte, Einstellungen, Fehler, i18n
  src/shared/     UI-Bausteine, Hilfsfunktionen (von 2+ Features genutzt)
  src/features/   Fachfunktionen, je Ordner ein Feature
        |
        |  HTTPS/JSON, JWT  (Supabase-Client; Logik in Edge Functions)
        v
Supabase (EU, Frankfurt)
  Auth | Postgres + RLS | Storage | Edge Functions | Cron
  Schema public   -> nur Tabellen/Views, die die App lesen darf
  Schema private  -> Hilfsfunktionen, interne Tabellen (nicht per API erreichbar)
        |
Externe Dienste nur vom Backend: SMTP (E-Mail), Sentry (EU), spaeter Push
```

---

## 3. Mandanten-Modell

**[Quelle]** Empfohlene Muster aus SaaS-Erfahrungsberichten:
- `organization_id` ist die erste Fachspalte jeder neuen Tabelle, **auch im Audit-Log**.
- Bei Registrierung automatisch eine persoenliche Organisation anlegen; dann gibt es nur
  einen Berechtigungsweg statt zwei.
- Nicht nur Lesen, auch Aendern und Loeschen pro Organisation absichern.
- Mitgliedschaft als eigene Tabelle mit Eindeutigkeit (`user_id`, `organization_id`).
- Sonderfall "letzter Eigentuemer verlaesst Organisation" blockieren.
- Einladungen mit eindeutigem Token, Ablaufzeit, regelmaessigem Aufraeumen.
- Cache-Schluessel immer mit Organisation (ein Nutzer kann in mehreren sein).
- Jede `organization_id` indizieren.

**Tabellen (Basis):**
```
organizations         (id, name, kind: personal|team, created_at, ...)
organization_members  (organization_id, user_id, role_id, unique(organization_id,user_id))
organization_invites  (id, organization_id, email, role_id, token unique, expires_at)
profiles              (id = auth.users.id, display_name, locale, active_organization_id)
roles, permissions, role_permissions
consents, audit_log(organization_id, ...), app_settings, feature_flags
```
Rollen gelten **pro Organisation** (nicht global) - globale Rollen brechen, sobald
Mandanten eigene Rechte wollen **[Quelle]**. Systemrollen (Plattform-Admin) separat.

---

## 4. RLS- und Datenbank-Regeln

**[Quelle]** Sicherheit:
- RLS auf **jeder** Tabelle im Schema `public`; Tabellen ohne RLS sind ueber die API offen.
- Hilfsfunktionen (`has_permission`, `is_member`) im Schema `private`, nicht `public`.
- `security definer`-Funktionen: `set search_path = ''`, `revoke execute ... from public, anon`,
  nur gezielt `grant` an `authenticated`.
- Views mit `security_invoker = true`, sonst umgehen sie RLS.
- Policies mit echten Rollen testen, nie nur als Admin.
- Supabase **Advisors** (Security und Performance) regelmaessig pruefen, in der CI wenn moeglich.

**[Quelle]** Performance:
- `(select auth.uid())` statt `auth.uid()` in Policies - wird einmal pro Abfrage statt pro
  Zeile ausgewertet; berichtet wurden Faktor 10-100.
- Spalten aus Policies indizieren (`organization_id`, `user_id`).
- Indizierte Spalte nicht in Funktionen verpacken (`lower(col)` verhindert Index).
- Mit `explain analyze` messen, nicht raten.

**Muster [Empfehlung]:**
```sql
create policy "members read" on public.<table>
  for select to authenticated
  using ( organization_id in (select private.my_organization_ids()) );

create policy "write with permission" on public.<table>
  for update to authenticated
  using ( (select private.has_permission(organization_id, '<table>.write')) )
  with check ( (select private.has_permission(organization_id, '<table>.write')) );
```

**Rechte im JWT (spaeter, optional) [Quelle]:** Custom Access Token Hook kann Rechte ins
Token schreiben. Nachteil: Aenderungen wirken erst nach Token-Erneuerung, Token wird groesser.
Start daher mit Tabellen-Lookup; Hook erst, wenn Messungen es verlangen.

**Konventionen:** `id uuid default gen_random_uuid()`, `created_at`, `updated_at` (Trigger),
`created_by`; Fremdschluessel mit bewusstem `on delete cascade/set null`;
`comment on table/column` in jeder Migration (Doku direkt in der DB).

---

## 5. Migrationen, Umgebungen, Kompatibilitaet

**[Quelle]**
- Drei Umgebungen: lokal (Docker), Staging, Produktion - je eigenes Supabase-Projekt.
  Staging frisch anlegen und nur per Migration befuellen.
- Nie im Studio aendern. Wenn `supabase db reset` lokal durchlaeuft, laeuft es auch in Produktion.
- TypeScript-Typen aus der DB in der CI erzeugen; Abweichung = CI rot.
- Reihenfolge beim Ausrollen: erst Migrationen, dann App/Functions.
- Geheimnisse (Access Token, DB-Passwort) nur als GitHub Secrets.

**[Empfehlung] Mobile-spezifisch - alte App-Versionen:**
- Migrationen immer **erweitern, dann entfernen**: neue Spalte dazu, App umstellen,
  alte Spalte erst entfernen, wenn keine alte Version mehr aktiv ist.
- `app_settings.min_app_version`: die App prueft beim Start und fordert ggf. zum Update auf.
  Notbremse fuer unvermeidbare Brueche.

---

## 6. Auth

**[Quelle]**
- Produktionsfehler kommen meist aus der Konfiguration: Site URL, Redirect-Allowlist,
  Deep-Link-Schema. Fuer jede Umgebung pruefen.
- Eingebauter E-Mail-Versand von Supabase ist nur fuer Tests gedacht und stark limitiert;
  fuer Staging/Produktion eigenen SMTP-Dienst einrichten (EU-Anbieter).
- Session-Speicher: Supabase-Session kann groesser sein als SecureStore auf manchen iOS-Versionen
  akzeptiert. Muster der Supabase-Doku: Schluessel in SecureStore, verschluesselte Session in
  AsyncStorage (`LargeSecureStore`).
- Token-Erneuerung in React Native ueber `AppState`: im Vordergrund `startAutoRefresh`,
  im Hintergrund `stopAutoRefresh`.
- Authentifizierung beweist Identitaet; was erlaubt ist, entscheidet RLS.

**[Quelle] Apple-Pflichten:**
- Wer Konten anlegt, muss die **Kontoloeschung in der App** anbieten (Richtlinie 5.1.1(v)),
  sonst Ablehnung.
- Wer Google-Login o. ae. anbietet, braucht eine gleichwertige datensparsame Alternative
  (Richtlinie 4.8), praktisch "Sign in with Apple"; dann bei Loeschung Apple-Token widerrufen.
- Folge: Kontoloeschung gehoert vor dem ersten Store-Release zwingend in die Basis.

---

## 7. Frontend

**Bibliotheken [Empfehlung, gestuetzt auf Quellen]:**
| Zweck | Wahl |
|---|---|
| Navigation | Expo Router (Routen in `app/`, duenn) |
| Server-Daten, Cache | TanStack Query |
| lokaler UI-Zustand | React-State; Zustand nur wenn noetig |
| Formulare/Validierung | react-hook-form + zod (Schemas auch fuer Edge Functions) |
| Listen | FlashList statt FlatList **[Quelle]** |
| Bilder | expo-image (Platzhalter, Cache) **[Quelle]** |
| i18n | i18next; Texte nur ueber Schluessel |
| Sicherer Speicher | expo-secure-store + LargeSecureStore-Muster |

**[Quelle] Expo-Erfahrungen:**
- New Architecture ist ab React Native 0.82 / Expo SDK 55 Pflicht - nur Bibliotheken
  waehlen, die sie unterstuetzen; bevorzugt von Expo gepflegte Module.
- Development Builds statt Expo Go, sobald native Module dazukommen.
- React Compiler aktivieren; Rendering mit DevTools pruefen.
- Groesstes Bedauern in Erfahrungsberichten: am ersten Tag erkannte Probleme nicht
  priorisiert. -> Liste "Technische Schulden" in der Wissensdatei fuehren.

**Ordnerstruktur [Quelle]:**
```
app/                    Routen, importieren nur Screens aus src/
src/core/               auth, organization, permissions, settings, i18n, errors, config
src/shared/             ui/ (Design-System), lib/, hooks/   - nur was 2+ Features nutzen
src/features/<name>/    components, hooks, api, types, screens
src/config/app.config.ts  Name, Farben, Feature-Schalter, URLs (eine Stelle je Klon)
```
Regel: Ein Feature importiert nie aus einem anderen Feature, nur aus `core`/`shared`.

**RTL [Quelle]:** `I18nManager.forceRTL` wirkt erst nach Neustart; Nutzer einmal informieren
und neu laden. Von Anfang an Styles mit `start/end`, `marginStart` usw.

**Performance-Regeln:**
- Listen immer paginiert (Cursor), nie "alles laden".
- Bilder vor Upload verkleinern; Anzeige ueber Storage-Transformation bzw. Thumbnails.
- Realtime nur gezielt, Kanaele beim Verlassen entfernen **[Quelle]**.
- Indizes fuer jede Filter-/Join-Spalte **[Quelle]**.

---

## 8. Offline

**[Quelle]** Eigene Synchronisation ist die haeufigste Fehlerquelle.
Optionen mit Supabase: **PowerSync** (liest Postgres-Aenderungen, lokale SQLite, passt zu
Supabase, kostenpflichtig ab gewisser Groesse) oder **WatermelonDB** (Sync selbst bauen,
Web-Unterstuetzung experimentell).

**[Empfehlung]** Nicht in die erste Basis. Erst wenn eine App es braucht (z. B. WandAkte),
PowerSync mit einem Prototyp pruefen. Die Basis bereitet nur vor: Datenzugriff je Feature
hinter `api/`-Modul kapseln, damit die Quelle spaeter austauschbar ist; UUIDs auf dem
Client erzeugbar (bereits durch `uuid`-Schluessel gegeben).

---

## 9. Build, Updates, Deployment

**[Quelle]**
- EAS Build fuer Store-Builds; EAS Update fuer JS-Korrekturen ohne Store-Pruefung.
- `runtimeVersion` mit Policy `appVersion` beginnen (Expo-Standard); bei jeder Aenderung an
  nativem Code Version erhoehen. Optional `eas fingerprint:compare` in der CI, um
  unbemerkte native Aenderungen zu finden.
- Kanaele `preview` (Staging) und `production`; Updates schrittweise ausrollen, Rollback nutzen.

**Pipeline (GitHub Actions) [Empfehlung]:**
| Ausloeser | Schritte |
|---|---|
| Pull Request | Lint, Typpruefung, Jest, `supabase db reset` + pgTAP (RLS-Tests), Typ-Drift, Web-Build |
| Merge auf `main` | Migrationen + Functions auf Staging, EAS Update Kanal `preview` |
| manuelle Freigabe | Migrationen auf Produktion, danach EAS Update/Build `production` |

Web-Ansicht: `expo export --platform web`, statisch ausliefern.

---

## 10. Tests

- **pgTAP-Tests fuer jede Policy** (Nutzer A sieht nichts von Organisation B; ohne Recht kein Schreiben).
  Wichtigste Testart - ein Policy-Fehler ist ein Datenleck.
- Jest fuer Logik in `core` und `features`.
- Deno-Tests fuer Edge Functions.
- Maestro fuer Hauptablaeufe vor Releases (Registrieren, Login, Organisation, Loeschen).
- Regel: neue Tabelle = Migration + Policy + pgTAP-Test im selben Pull Request.

---

## 11. Sicherheit und Datenschutz (Ergaenzungen zur Wissensdatei)

- Nur URL und oeffentlicher Schluessel in der App; Service-Key nur in Edge Functions/Secrets.
- Storage-Buckets privat, Pfad beginnt mit `organization_id`, Policies darauf; Auslieferung per signierter URL.
- Rate-Limiting fuer oeffentliche Edge Functions.
- Sentry mit EU-Datenregion, erst nach Einwilligung, PII-Filter aktiv.
- Abhaengigkeiten: Dependabot, `npm audit` in CI.

---

## 12. Betrieb und Ausstieg

**[Quelle]** Selbst gehostetes Supabase ist moeglich, aber: Community-Support, Studio nur ein
Projekt, Luecken bei Logs, Backups, E-Mail-Vorlagen; Betrieb, Haertung, Backups selbst.
**[Empfehlung]** Supabase Cloud (EU) fuer Staging und Produktion. Ausstiegsfaehigkeit sichern:
Standard-SQL, eigene Logik in Migrationen/Edge Functions im Repo, regelmaessiger `pg_dump`
als zusaetzliches Backup.

**[Quelle]** Automatische Backups sind kein Wiederherstellungsplan - Rueckspielen testen.

---

## 13. Klone aktuell halten

**[Quelle]** GitHub-Vorlagen uebertragen spaetere Aenderungen nicht; Klone driften auseinander.
Bewaehrt: Vorlage als zweites Remote (`upstream`) im Klon, Aenderungen per Merge holen.

**[Empfehlung]**
- Basis-Code nur in `src/core`, `src/shared`, `backend/supabase/migrations/0000_*` (Basis-Nummernkreis);
  Fachcode nur in `src/features` und eigenem Migrations-Nummernkreis -> wenige Konflikte.
- App-spezifische Werte nur in `src/config/app.config.ts` und `app.config.ts`.
- `CHANGELOG.md` der base-app, damit Klone wissen, was sie uebernehmen.

---

## 14. Vorgehensweise

- Kleine senkrechte Schritte; jeder Meilenstein endet mit einer lauffaehigen App und gruener CI.
- **Definition of Done** je Aenderung: Code, Tests (inkl. Policy), i18n-Schluessel DE/EN,
  Eintrag in Wissensdatei (Entscheidung/Fehler), keine offenen Advisor-Warnungen.
- Entscheidungen kurz festhalten (Entscheidung, Grund, Alternative).
- Expo-SDK-Upgrade einplanen (neue SDKs mehrmals pro Jahr); nicht mehrere Versionen ueberspringen.
- Liste "Technische Schulden" pflegen und regelmaessig abbauen.

### 14.1 Selbst verstehen und selbst erweitern (Wunsch Alireza, 20.11.2026)

Ziel: Alireza kann jederzeit selbst in Tabellen schauen, Frontend- und Backend-Code
nachvollziehen und eigenstaendig Tabellen, Felder und Funktionen ergaenzen.

**Werkzeuge:**
- Supabase Studio lokal im Browser (`http://localhost:54323` nach `supabase start`):
  Tabellen, Daten, Policies, SQL-Editor - **nur zum Ansehen**, Aenderungen immer per Migration.
- VS Code mit PostgreSQL-Erweiterung, verbunden mit der lokalen DB
  (`localhost:54322`, Benutzer/Passwort lokal `postgres/postgres`): Tabellen und Abfragen direkt im Editor.
- Mails der lokalen Umgebung (Registrierung, Passwort) im lokalen Mail-Testpostfach von Supabase.
- Expo Dev Tools / React DevTools: was die App laedt und rendert.

**Lernunterlagen, wachsen mit jedem Meilenstein (`docs/lernen/`):**
- `00-ueberblick.md` - wie Frontend, Supabase und Datenbank zusammenspielen; Datenfluss
  einer Anfrage vom Button bis zur Tabelle und zurueck.
- `01-lokal-starten.md` - Umgebung starten, Studio und VS Code verbinden.
- `anleitung-neue-tabelle.md` - Schritt fuer Schritt: Migration anlegen, Tabelle mit
  `organization_id`, RLS-Policy, pgTAP-Test, `db reset`, Typen erzeugen, im Frontend nutzen.
- `anleitung-neues-feld.md` - Feld ergaenzen ohne alte App-Versionen zu brechen.
- `anleitung-neue-seite.md` - Route, Screen, Feature-Ordner, i18n-Texte.
- je Meilenstein ein Kapitel "Was wurde gebaut, wo liegt es, warum so".

**Arbeitsweise:** Nach jedem Baustein zeigt Claude, was entstanden ist (Dateien, Tabellen,
Datenfluss), und laesst die naechste gleichartige Erweiterung (z. B. ein weiteres Feld)
von Alireza selbst bauen, mit Pruefung danach.

---

## 15. Meilensteine (ueberarbeitet)

| Nr. | Inhalt | fertig wenn |
|---|---|---|
| M0 | Repo, Expo inkl. Web, Ordnerstruktur, `app.config`, Lint/TS/Jest, lokales Supabase, CI | leere App startet auf Geraet und im Browser, CI gruen |
| M1 | Schema Basis inkl. Organisationen, `private`-Schema, RLS-Muster, pgTAP, Typ-Erzeugung | `db reset` + alle Policy-Tests gruen |
| M2 | Auth: Registrieren (mit persoenlicher Organisation), Login, Passwort vergessen, Session-Speicher, eigener SMTP auf Staging | man kommt rein und bleibt drin |
| M3 | Profil, Sprache DE/EN, RTL-faehige Bausteine, einheitliche Fehler-/Ladezustaende, Design-System-Grundlage | einheitliche Oberflaeche |
| M4 | Kontoloeschung und Export, Einwilligungen, Datenschutzerklaerung/Impressum | Store-Pflichten erfuellt |
| M5 | Staging/Produktion, Pipeline mit Freigabe, EAS Build/Update, Mindestversion-Schalter, Backup-Rueckspieltest | kontrollierter Auslieferweg |
| M6 | Aufraeumen, Klon-Anleitung, CHANGELOG, `upstream`-Ablauf getestet | Basis ist klonbar |
| spaeter | Einladungen/Team, Admin, Dateien/Fotos, Offline (PowerSync-Pruefung), Push, Social Login, Bezahlung | nach Bedarf der ersten Apps |

---

## 16. Quellen

- Supabase Doku: [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments), [CI/CD](https://supabase.com/docs/guides/cli/cicd-workflows), [Row Level Security](https://supabase.com/docs/guides/database/row-level-security), [Securing your API](https://supabase.com/docs/guides/api/hardening-data-api), [Advisors](https://supabase.com/docs/guides/observability/advisors.md), [Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac), [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook), [Self-Hosting](https://supabase.com/docs/guides/self-hosting), [React Native Auth](https://supabase.com/blog/react-native-authentication)
- Supabase Erfahrungen: [Production Readiness](https://gartsolutions.com/supabase-best-practices/), [Auth in Production](https://dev.to/samrat-patel/supabase-auth-in-production-redirects-email-and-sessions-3g6l), [Common Mistakes](https://hrekov.com/blog/supabase-common-mistakes), [RLS Performance](https://tomodahinata.com/en/blog/supabase-rls-performance-optimization-select-wrap-index-guide), [Security Definer Incidents](https://dev.to/michelfaure/3-supabase-security-incidents-one-shared-root-cause-security-definer-inherits-execute-to-public-coa), [Schema Drift](https://dev.to/philip_mcclarence_2ef9475/schema-diff-catch-drift-between-staging-and-production-4jh4), [Self-hosted Erfahrungen](https://dev.to/lambopoewert/moved-from-hosted-supabase-to-self-hosted-on-a-single-vps-heres-what-i-learned-after-weeks-in-2om1), [Self-hosted Luecken](https://github.com/supabase/supabase-js/issues/1581)
- Mandanten: [Multi-Tenant Mistakes](https://medium.com/@Fahad06/multi-tenant-saas-mistakes-ill-never-make-again-ef358e1feb9f), [Add Multi-Tenancy](https://starterpick.com/guides/how-to-add-multi-tenancy-boilerplate-2026), [Database Design](https://navanathjadhav.medium.com/building-a-multi-tenant-saas-the-database-design-nobody-talks-about-7831b576655f)
- Expo: [Ordnerstruktur](https://expo.dev/blog/expo-app-folder-structure-best-practices), [Performance](https://expo.dev/blog/best-practices-for-reducing-lag-in-expo-apps), [Runtime Versions](https://docs.expo.dev/eas-update/runtime-versions/), [OTA Best Practices](https://expo.dev/blog/5-ota-update-best-practices-every-mobile-team-should-know), [New Architecture](https://procedure.tech/blogs/react-native-new-architecture-in-production/), [Ein Jahr mit Expo](https://sirlisko.com/blog/a-year-building-a-react-native-app-with-expo), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore.md), [Listen/Bilder gemessen](https://swmansion.com/blog/react-native-image-list-recreating-apple-google-photos-in-react-native-part-1-7f73fb74fc63)
- Offline: [Vergleich 2026](https://procedure.tech/blogs/react-native-offline-first/), [PowerSync + Supabase](https://powersync.com/blog/bringing-offline-first-to-supabase)
- RTL: [I18nManager](https://reactnative.dev/docs/i18nmanager), [RTL in Expo](https://geekyants.com/blog/implementing-right-to-left-rtl-support-in-expo-without-restarting-the-app)
- Apple: [Kontoloeschung 5.1.1(v)](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion), [Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app)
- Vorlagen-Sync: [Template Sync Diskussion](https://github.com/orgs/community/discussions/23528), [DevRev Erfahrungen](https://medium.com/devrev/learnings-from-using-github-templates-at-devrev-7f254b846b86), [actions-template-sync](https://redirect.github.com/AndreasAugustin/actions-template-sync)
