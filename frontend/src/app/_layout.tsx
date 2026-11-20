// Wurzel-Layout aller Routen. Hier kommen spaeter die Provider hinein
// (Sitzung, TanStack Query, i18n, Theme).
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
