// Route /privacy-policy - ohne Anmeldung erreichbar.
import { LegalScreen } from '@/core/legal/legal-screen';

export default function PrivacyPolicyRoute() {
  return <LegalScreen kind="privacy" />;
}
