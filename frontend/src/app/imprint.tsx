// Route /imprint - ohne Anmeldung erreichbar.
import { LegalScreen } from '@/core/legal/legal-screen';

export default function ImprintRoute() {
  return <LegalScreen kind="imprint" />;
}
