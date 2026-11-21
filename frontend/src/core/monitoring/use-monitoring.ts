// Verbindet das Fehlerprotokoll mit dem App-Zustand (im Wurzel-Layout aufgerufen):
// - Erfassung einrichten
// - Einwilligung "Fehlerprotokoll" an/aus -> Datei auf dem Geraet schreiben bzw. loeschen
// - Seitenwechsel als Schritt notieren
import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/core/auth/auth-provider';
import { useConsents } from '@/core/privacy/privacy-api';

import { addBreadcrumb } from './breadcrumbs';
import { installDiagnostics } from './diagnostics';
import { setLogPersistence } from './log-file';

export function useMonitoring() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const consents = useConsents(userId);
  const pathname = usePathname();

  useEffect(() => {
    installDiagnostics();
  }, []);

  // Solange der Stand unbekannt ist (Laden), nichts aendern - sonst wuerde die Datei
  // bei jedem Start kurz geloescht.
  const consentKnown = userId !== undefined && consents.data !== undefined;
  const consentGiven = consents.data?.crash_reports === true;
  useEffect(() => {
    if (userId === undefined) {
      // abgemeldet: nicht weiter schreiben, Datei behalten
      void setLogPersistence(false, { keepFile: true });
    } else if (consentKnown) {
      void setLogPersistence(consentGiven);
    }
  }, [userId, consentKnown, consentGiven]);

  useEffect(() => {
    addBreadcrumb('navigation', pathname);
  }, [pathname]);
}
