// Startseite "Heute": eine grosse Zahl (faellig), ein grosser Knopf, darunter die Bereiche.
// Ohne Decks geht es direkt zur Einrichtung "Was moechtest du lernen?".

import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ProfileButton } from '@/core/profile/profile-button';
import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { FormMessage } from '@/shared/ui/form-message';
import { ListRow } from '@/shared/ui/list-row';
import { Screen } from '@/shared/ui/screen';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { spacing, usePalette } from '@/shared/ui/theme';

import { SyncNotice } from '../components/sync-notice';
import { listChildDecks } from '../data/decks';
import { getDeckCounts, getTodayCounts } from '../data/stats';
import { useDataContext, useLocalQuery } from '../data/use-local-data';

export function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const palette = usePalette();

  const context = useDataContext();
  const overview = useLocalQuery(['today'], async (db) => {
    const now = Date.now();
    const decks = await listChildDecks(db, null);
    const withCounts = [];
    for (const deck of decks) withCounts.push({ deck, counts: await getDeckCounts(db, deck.id, now) });
    return { totals: await getTodayCounts(db, now), decks: withCounts };
  });

  if (overview.isPending || context.isPending) {
    return (
      <Screen headerAction={<ProfileButton />}>
        <LoadingState />
      </Screen>
    );
  }
  if (overview.isError) {
    return (
      <Screen headerAction={<ProfileButton />}>
        <ErrorState message={t('flashcards.today.loadError')} onRetry={() => overview.refetch()} />
      </Screen>
    );
  }
  if (!context.data) {
    return (
      <Screen title={t('flashcards.today.title')} headerAction={<ProfileButton />}>
        <FormMessage tone="info" text={t('flashcards.today.noOrganization')} />
      </Screen>
    );
  }
  if (overview.data.decks.length === 0) {
    return <Redirect href="/setup" />;
  }

  const { totals, decks } = overview.data;
  const dueNow = totals.due + totals.newToday;

  return (
    <Screen
      title={t('flashcards.today.title')}
      headerAction={<ProfileButton />}
      footer={
        <View style={styles.footer}>
          <View style={styles.footerButton}>
            <Button variant="secondary" title={t('flashcards.today.addArea')} onPress={() => router.push('/setup')} />
          </View>
          <View style={styles.footerButton}>
            <Button
              variant="secondary"
              title={t('flashcards.today.addCard')}
              onPress={() => router.push('/cards/new')}
            />
          </View>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.content}>
        <SyncNotice />

        <View style={styles.hero}>
          <AppText style={[styles.bigNumber, { color: palette.text }]}>{dueNow}</AppText>
          <AppText tone="secondary">{t('flashcards.today.dueLabel')}</AppText>
          <AppText tone="secondary">{t('flashcards.today.newToday', { count: totals.newToday })}</AppText>
        </View>

        <Button title={t('flashcards.today.learn')} onPress={() => router.push('/study')} disabled={dueNow === 0} />

        <AppText variant="heading">{t('flashcards.today.areas')}</AppText>
        {decks.map(({ deck, counts }) => (
          <ListRow
            key={deck.id}
            title={deck.name}
            subtitle={t('flashcards.today.deckSubtitle', {
              due: counts.due + counts.newToday,
              total: counts.total,
            })}
            onPress={() => router.push({ pathname: '/decks/[id]', params: { id: deck.id } })}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  hero: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
  bigNumber: { fontSize: 64, fontWeight: '700', lineHeight: 72 },
  footer: { flexDirection: 'row', gap: spacing.sm },
  footerButton: { flex: 1 },
});
