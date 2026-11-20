// Route /change-password - gleiche Seite wie nach "Passwort vergessen", hier im Modus change.
import { NewPasswordScreen } from '@/core/auth/screens/new-password-screen';

export default function ChangePasswordRoute() {
  return <NewPasswordScreen mode="change" />;
}
