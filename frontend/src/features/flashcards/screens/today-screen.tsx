// Startseite "Heute": Fortschrittsring (heute erledigt / offen, gruen wenn geschafft), ein grosser Knopf,
// darunter die Bereiche.
// Ohne Decks geht es direkt zur Einrichtung "Was moechtest du lernen?".

import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProfileButton } from '@/core/profile/profile-button';
import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { FormMessage } from '@/shared/ui/form-message';
import { ListRow } from '@/shared/ui/list-row';
import { Screen } from '@/shared/ui/screen';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { spacing, usePalette } from '@/shared/ui/theme';

import { SyncNotice } from '../components/sync-notice';
import { getDeckTreeIds, listChildDecks } from '../data/decks';
import { getDeckCounts, getTodayCounts, getTodayProgress, type TodayProgress } from '../data/stats';
import { ProgressRing } from '../components/progress-ring';
import { useBoxColors } from '../components/box-bar';
import { markDayDone } from '../data/statistics';
import { useDataContext, useLocalQuery } from '../data/use-local-data';

export function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const palette = usePalette();
  const boxColors = useBoxColors();

  const context = useDataContext();
  const overview = useLocalQuery(['today'], async (db) => {
    const now = Date.now();
    const decks = await listChildDecks(db, null);
    const withCounts = [];
    for (const deck of decks) {
      const counts = await getDeckCounts(db, deck.id, now);
      const progress = await getTodayProgress(db, now, counts, await getDeckTreeIds(db, deck.id));
      if (progress.status === 'done') await markDayDone(db, now, deck.id);
      withCounts.push({ deck, counts, progress });
    }
    const totals = await getTodayCounts(db, now);
    const progress = await getTodayProgress(db, now, totals);
    if (progress.status === 'done') await markDayDone(db, now, null); // fuer die 7-Tage-Leiste der Statistik
    return { totals, progress, decks: withCounts };
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

  const { totals, progress, decks } = overview.data;
  const finished = progress.status === 'done';
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

        <Pressable
          role="button"
          aria-label={t('flashcards.stats.open')}
          onPress={() => router.push('/stats')}
          style={styles.hero}
        >
          <ProgressRing
            ratio={finished ? 1 : progress.ratio}
            color={finished ? boxColors.mature : palette.primary}
            label={
              finished
                ? t('flashcards.today.doneAll')
                : t('flashcards.today.progress', { done: progress.done, total: progress.done + progress.open })
            }
          >
            {finished ? (
              <AppText style={[styles.check, { color: boxColors.mature }]}>✓</AppText>
            ) : (
              <>
                <AppText style={[styles.bigNumber, { color: palette.text }]}>{dueNow}</AppText>
                <AppText variant="caption" tone="secondary">
                  {t('flashcards.today.openLabel')}
                </AppText>
              </>
            )}
          </ProgressRing>
          <AppText variant="heading">
            {finished
              ? t('flashcards.today.doneAll')
              : progress.status === 'nothing'
                ? t('flashcards.today.nothingToday')
                : t('flashcards.today.progress', { done: progress.done, total: progress.done + progress.open })}
          </AppText>
          {!finished && totals.newToday > 0 ? (
            <AppText tone="secondary">{t('flashcards.today.newToday', { count: totals.newToday })}</AppText>
          ) : null}
          {progress.comingBack > 0 ? (
            <AppText tone="secondary">{t('flashcards.today.comingBack', { count: progress.comingBack })}</AppText>
          ) : null}
          <AppText variant="caption" tone="secondary">
            {t('flashcards.stats.open')} ›
          </AppText>
        </Pressable>

        <Button title={t('flashcards.today.learn')} onPress={() => router.push('/study')} disabled={dueNow === 0} />

        <AppText variant="heading">{t('flashcards.today.areas')}</AppText>
        {decks.map(({ deck, counts, progress: area }) => (
          <ListRow
            key={deck.id}
            leading={<AreaRing progress={area} />}
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
  bigNumber: { fontSize: 48, fontWeight: '700', lineHeight: 56 },
  check: { fontSize: 64, fontWeight: '700', lineHeight: 72 },
  smallCheck: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  footer: { flexDirection: 'row', gap: spacing.sm },
  footerButton: { flex: 1 },
});

/** Kleiner Ring je Bereich: blau = Anteil erledigt, gruen mit Haken = heute fertig, leer = nichts faellig. */
function AreaRing({ progress }: { progress: TodayProgress }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const boxColors = useBoxColors();
  const finished = progress.status === 'done';
  return (
    <ProgressRing
      size={36}
      stroke={4}
      ratio={finished ? 1 : progress.ratio}
      color={finished ? boxColors.mature : palette.primary}
      label={
        finished
          ? t('flashcards.today.doneAll')
          : t('flashcards.today.progress', { done: progress.done, total: progress.done + progress.open })
      }
    >
      {finished ? <AppText style={[styles.smallCheck, { color: boxColors.mature }]}>✓</AppText> : null}
    </ProgressRing>
  );
}
