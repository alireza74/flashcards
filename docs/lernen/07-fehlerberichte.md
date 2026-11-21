# 07 - Fehlerprotokoll auf dem Geraet

Stand: 21.11.2026. Ziel: Wenn bei einem Nutzer etwas schiefgeht, nachvollziehen koennen, was passiert
ist - ohne externen Dienst, ohne Server-Tabelle, ohne persoenliche Inhalte.

Verlauf der Entscheidung: Zuerst Berichte an eine Supabase-Tabelle (Migration 0007), am selben Tag
ersetzt durch ein Protokoll auf dem Geraet, das der Nutzer selbst teilt (Migration 0008 entfernt die Tabelle).

## Ablauf

```
Waehrend der Nutzung
  Seitenwechsel, Knoepfe, Supabase-Anfragen, An-/Abmeldung   -> Eintrag (info)
  Fehler (reportError, unbehandelt, Darstellung, Laden)      -> Eintrag (warn/error) mit Fehler-ID
      |
      v
  Sitzungsprotokoll im Arbeitsspeicher (immer, max. 200)     breadcrumbs.ts
      |  nur mit Einwilligung "Fehlerprotokoll auf dem Geraet speichern"
      v
  Datei auf dem Geraet (max. 1000 Eintraege / 7 Tage)        log-file.ts
      Handy: App-Ordner (fehlerprotokoll.jsonl), Web: Browser-Speicher

Bei Problemen
  Profil -> Datenschutz -> "Protokoll teilen"
      Handy: Teilen-Dialog (Mail, Messenger), Web: Download
      Inhalt: Kopf (App-Version, Update, Kanal, Plattform, Geraet) + eine Zeile je Eintrag
      ohne Einwilligung: nur die Eintraege der aktuellen Sitzung
```

Beispiel einer geteilten Datei:

```
Fehlerprotokoll
Erstellt:     2026-11-21 21:31:30 UTC
App-Version:  0.1.0
Update:       3f2a... (Kanal preview)
Plattform:    android 15
Geraet:       Pixel 8
Eintraege:    42

2026-11-21 21:31:19 INFO  navigation: /profile
2026-11-21 21:31:19 INFO  http: GET /rest/v1/profiles -> 200 (76 ms)
2026-11-21 21:31:25 INFO  ui: Knopf: Speichern
2026-11-21 21:31:25 INFO  http: PATCH /rest/v1/profiles -> 400 (50 ms)
2026-11-21 21:31:25 WARN  error: [mutation] PostgrestError 23514 [Fehler-ID WRAP-CG36]
```

## Einen Fehler analysieren

1. Nutzer nennt die Fehler-ID (steht auf der Fehlerseite) und schickt das Protokoll.
2. In der Datei nach der Fehler-ID suchen; die Zeilen davor zeigen, wie es dazu kam.
3. Kopf: welche App-Version und welcher Update-Stand betroffen ist.
4. Schritte lokal nachstellen (`npm run web`), Fehler beheben, Test schreiben, pushen.
5. Falls der Server beteiligt war (z. B. Status 400/500): Supabase-Dashboard -> Logs (API, Postgres)
   zum selben Zeitpunkt.

## Datenschutz

- Datei nur mit Einwilligung (Zweck `crash_reports`, Text "Fehlerprotokoll auf dem Geraet speichern").
  Widerruf loescht die Datei sofort. Beim Abmelden wird nicht weiter geschrieben, die Datei bleibt.
- Gefiltert beim Eintragen: E-Mail-Adressen, Tokens, Schluessel, Zahlen ab 6 Stellen (Codes),
  Werte in URL-Parametern. Anfragen nur mit Pfad, ohne Inhalte.
- Die Datei verlaesst das Geraet nur, wenn der Nutzer sie selbst teilt.
- Offen fuer die juristische Pruefung: ob das Speichern auf dem Endgeraet die Einwilligung braucht
  (vorsichtig umgesetzt: ja) und der Text in der Datenschutzerklaerung.

## In eigenen Funktionen nutzen

```ts
import { reportError } from '@/core/monitoring/error-sink';

try {
  await saveCard(card);
} catch (error) {
  const errorId = reportError(error, { context: { source: 'cards: speichern' } });
  // errorId anzeigen, damit der Nutzer sie nennen kann
}
```

In `context` nur technische Angaben, nie Eingaben des Nutzers.

## Dateien

| Datei | Aufgabe |
|---|---|
| `src/core/monitoring/error-sink.ts` | Sammelstelle `reportError` (ohne Abhaengigkeiten) |
| `src/core/monitoring/diagnostics.ts` | Fehler mit Fehler-ID eintragen, unbehandelte Fehler abfangen |
| `src/core/monitoring/breadcrumbs.ts` | Sitzungsprotokoll im Speicher |
| `src/core/monitoring/log-file.ts` | Datei schreiben/loeschen, `shareLog()` |
| `src/core/monitoring/log-format.ts` | Grenzen, Textformat (getestet) |
| `src/core/monitoring/sanitize.ts` | Filter fuer persoenliche Daten (getestet) |
| `src/core/monitoring/monitored-fetch.ts` | Supabase-Anfragen als Schritt |
| `src/core/monitoring/error-screen.tsx` | Fehlerseite mit Fehler-ID |
| `src/core/monitoring/use-monitoring.ts` | Einwilligung -> Datei an/aus, Seitenwechsel |

## Grenzen

- Harte Abstuerze im nativen Teil (App beendet sich ohne JavaScript-Fehler) werden nicht erfasst.
- Du erfaehrst von Fehlern nur, wenn der Nutzer das Protokoll schickt. Spaeter moeglich:
  "Protokoll anfordern" mit Bestaetigung durch den Nutzer und Upload in einen privaten Speicher.
