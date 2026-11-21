# 07 - Fehlerberichte (eigene Loesung)

Stand: 21.11.2026. Ziel: Wenn bei einem Nutzer etwas schiefgeht, nachvollziehen koennen, was passiert
ist - ohne externen Dienst und ohne persoenliche Inhalte.

## Ablauf

```
Fehler in der App
  -> reportError(error)                       src/core/monitoring/error-sink.ts
  -> nur wenn Einwilligung "Absturz- und Fehlerberichte" an:
     Bericht bauen + filtern                   report.ts, sanitize.ts
       Fehler, Code-Stelle, App-Version, Update-Stand, Geraet,
       letzte 50 Schritte (Seiten, Knoepfe, Anfragen)          breadcrumbs.ts
     zuerst lokal merken, dann senden          monitoring.ts
  -> Supabase: Tabelle error_reports           Migration 0007
       Policy prueft Einwilligung nochmals; Nutzer duerfen nur anlegen, nicht lesen
  -> Nutzer sieht eine Fehler-ID (z. B. NDXE-6B5D) und kann sie dem Support nennen
```

## Was automatisch erfasst wird

| Quelle | Wo eingebaut | Stufe |
|---|---|---|
| Fehler beim Darstellen einer Seite | `ErrorBoundary` in `src/app/_layout.tsx` (zeigt Fehler-ID) | fatal |
| Unbehandelte JavaScript-Fehler | `installMonitoring()` (Handy: ErrorUtils, Web: window) | error/fatal |
| Fehler beim Laden/Speichern von Daten | `QueryCache`/`MutationCache` in `_layout.tsx` | warning |
| Unbekannte Anmeldefehler | `auth-errors.ts` | warning |

Schritte (Breadcrumbs): Seitenwechsel (`use-monitoring.ts`), jeder Knopf (`shared/ui/button.tsx`),
jede Supabase-Anfrage mit Pfad, Status und Dauer (`monitored-fetch.ts`), An-/Abmeldung (`auth-provider.tsx`).

## Datenschutz

- Nur mit Einwilligung; die Datenbank-Policy prueft sie zusaetzlich. Widerruf: keine neuen Berichte,
  noch nicht gesendete werden verworfen.
- Gefiltert vor dem Senden: E-Mail-Adressen, Tokens, Schluessel, Zahlen ab 6 Stellen (Codes),
  Werte in URL-Parametern. Anfragen ohne Inhalte, nur Pfad.
- Nutzer koennen Berichte weder lesen noch aendern; im Datenexport sind die eigenen enthalten.
- Loeschung nach 90 Tagen (pg_cron, taeglich 03:30 UTC) und mit dem Konto.
- Hoechstens 30 Berichte pro Nutzer und Stunde (Schutz vor Fehlerschleifen).
- In der Datenschutzerklaerung erwaehnt (Platzhaltertext, juristisch pruefen).

## Einen Fehler analysieren

Nutzer nennt die Fehler-ID, z. B. `NDXE-6B5D`. In Supabase Studio -> SQL Editor:

```sql
select short_id, level, message, app_version, update_id, channel, platform,
       device_model, context, occurred_at
from public.error_reports
where short_id = 'NDXE-6B5D';

-- die Schritte davor, lesbar
select jsonb_pretty(breadcrumbs) from public.error_reports where short_id = 'NDXE-6B5D';

-- haeufigste Fehler der letzten 7 Tage
select message, count(*) as anzahl, max(occurred_at) as zuletzt
from public.error_reports
where occurred_at > now() - interval '7 days'
group by message order by anzahl desc;
```

Mit `update_id` siehst du, welcher Stand (EAS Update) betroffen war.

## Testen

In der Entwicklung und in der Test-APK (Kanal preview) gibt es im Profil unter Datenschutz den
Knopf **"Testbericht senden"**. Ohne Einwilligung kommt ein Hinweis, mit Einwilligung die Fehler-ID.

## In eigenen Funktionen nutzen

```ts
import { reportError } from '@/core/monitoring/error-sink';

try {
  await saveCard(card);
} catch (error) {
  const errorId = reportError(error, { context: { source: 'cards: speichern' } });
  // errorId anzeigen, falls vorhanden
}
```

In `context` nur technische Angaben, nie Eingaben des Nutzers.

## Grenzen

- Harte Abstuerze im nativen Teil (App beendet sich ohne JavaScript-Fehler) werden nicht erfasst.
  Falls noetig spaeter: Sentry oder GlitchTip (EU) hinter derselben Sammelstelle `reportError`.
- Keine Alarm-Mail bei neuen Fehlern; Auswertung per SQL.
