// Verbindet die Fehlererfassung mit dem App-Zustand (im Wurzel-Layout aufgerufen):
// - Einwilligung "crash_reports" an/aus -> Berichte an/aus
// - aktive Organisation an Berichte haengen
// - Seitenwechsel als Schritt notieren
import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/core/auth/auth-provider';
import { useConsents } from '@/core/privacy/privacy-api';
import { useProfile } from '@/core/profile/use-profile';

import { addBreadcrumb } from './breadcrumbs';
import { installMonitoring, setMonitoringEnabled, setMonitoringOrganization } from './monitoring';

export function useMonitoring() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const consents = useConsents(userId);
  const profile = useProfile(userId);
  const pathname = usePathname();

  useEffect(() => {
    installMonitoring();
  }, []);

  const consentGiven = userId !== undefined && consents.data?.crash_reports === true;
  useEffect(() => {
    setMonitoringEnabled(consentGiven);
  }, [consentGiven]);

  const organizationId = profile.data?.active_organization?.id ?? null;
  useEffect(() => {
    setMonitoringOrganization(organizationId);
  }, [organizationId]);

  useEffect(() => {
    addBreadcrumb('navigation', pathname);
  }, [pathname]);
}
