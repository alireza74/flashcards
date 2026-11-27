// Profil-Knopf fuer die Kopfzeile: Kreis mit den Initialen des Nutzers, fuehrt zu Profil
// und Einstellungen.
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/core/auth/auth-provider';
import { usePalette } from '@/shared/ui/theme';

import { initialsOf } from './initials';
import { useProfile } from './use-profile';

const SIZE = 36;

export function ProfileButton() {
  const { t } = useTranslation();
  const router = useRouter();
  const palette = usePalette();
  const { session } = useAuth();
  const profile = useProfile(session?.user.id);

  const initials = initialsOf(profile.data?.display_name, session?.user.email);

  return (
    <Pressable
      testID="profile-button"
      role="button"
      aria-label={t('home.toProfile')}
      hitSlop={8}
      onPress={() => router.push('/profile')}
      style={({ pressed }) => [styles.circle, { backgroundColor: palette.primary, opacity: pressed ? 0.7 : 1 }]}
    >
      {/* feste Kreisgroesse: Systemschrift nur begrenzt vergroessern, sonst laeuft der Text heraus */}
      <Text maxFontSizeMultiplier={1.2} style={[styles.text, { color: palette.onPrimary }]}>
        {initials}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 14, fontWeight: '700' },
});
