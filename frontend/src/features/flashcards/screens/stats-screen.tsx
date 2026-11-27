// Statistik (/stats oder /stats?deck=<id>): Ueberblick, Niveaus, Serie und Aktivitaet, Vorschau, Gedaechtnis.
// Oben Wechsel zwischen "Alle" und den Bereichen. Berechnung: data/statistics.ts.

import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/app-text';
import { Card } from '@/shared/ui/card';
import { ChipSelect } from '@/shared/ui/chip-select';
import { BackButton } from '@/shared/ui/header-buttons';
import { Screen } from '@/shared/ui/screen';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { spacing, usePalette } from '@/shared/ui/theme';

import { BoxBar, useBoxColors } from '../components/box-bar';
import { DayBars } from '../components/day-bars';
import { LevelBars } from '../components/level-bars';
import { ProgressRing } from '../components/progress-ring';
import { getDeckTreeIds, listChildDecks } from '../data/decks';
import { getStatistics, type Statistics, type WeekDay } from '../data/statistics';
import { getDeckCounts, getTodayCounts, getTodayProgress } from '../data/stats';
import { useLocalQuery } from '../data/use-local-data';

const ALL = 'all';

export function StatsScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ deck?: string }>();
  const [scope, setScope] = useState<string>(params.deck ?? ALL);
  const deckId = scope === ALL ? null : scope;

  const areas = useLocalQuery(['stats-areas'], (db) => listChildDecks(db, null));
  const stats = useLocalQuery(['stats', scope], async (db) => {
    const now = Date.now();
    const counts = deckId ? await getDeckCounts(db, deckId, now) : await getTodayCounts(db, now);
    const progress = await getTodayProgress(db, now, counts, deckId ? await getDeckTreeIds(db, deckId) : undefined);
    return getStatistics(db, deckId, now, progress.status === 'done');
  });

  // Auswahl: Alle + Bereiche; kommt man von einem Unterdeck, steht es zusaetzlich zur Wahl
  const scopeOptions = [
    { value: ALL, label: t('flashcards.browse.all') },
    ...(areas.data ?? []).map((d) => ({ value: d.id, label: d.name })),
  ];
  if (params.deck && !scopeOptions.some((o) => o.value === params.deck))
    scopeOptions.push({ value: params.deck, label: t('flashcards.stats.thisDeck') });

  const locale = i18n.language;
  const formatDate = (dayStart: number) =>
    new Date(dayStart).toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });

  return (
    <Screen title={t('flashcards.stats.title')} headerLeft={<BackButton />}>
      <ScrollView contentContainerStyle={styles.content}>
        {scopeOptions.length > 1 ? <ChipSelect value={scope} onChange={setScope} options={scopeOptions} /> : null}
        {stats.isPending ? <LoadingState /> : null}
        {stats.isError ? <ErrorState message={t('common.error')} onRetry={() => void stats.refetch()} /> : null}
        {stats.data ? <StatsBody stats={stats.data} formatDate={formatDate} locale={locale} /> : null}
      </ScrollView>
    </Screen>
  );
}

function StatsBody({
  stats,
  formatDate,
  locale,
}: {
  stats: Statistics;
  formatDate: (dayStart: number) => string;
  locale: string;
}) {
  const { t } = useTranslation();
  const palette = usePalette();
  const percent = (ratio: number | null) => (ratio === null ? '–' : `${Math.round(ratio * 100)} %`);
  const hours = Math.floor(stats.weekMinutes / 60);
  const minutes = stats.weekMinutes % 60;

  return (
    <>
      <Card>
        <View style={styles.hero}>
          <AppText style={[styles.bigNumber, { color: palette.text }]}>{stats.box.mature}</AppText>
          <AppText tone="secondary">{t('flashcards.stats.matureOf', { total: stats.box.total })}</AppText>
        </View>
        <BoxBar counts={stats.box} compact />
      </Card>

      {stats.levels.length > 0 ? (
        <Card title={t('flashcards.stats.levels')}>
          <LevelBars rows={stats.levels} />
        </Card>
      ) : null}

      <Card title={t('flashcards.stats.streakTitle')}>
        <View style={styles.tiles}>
          <Tile value={String(stats.streak.current)} label={t('flashcards.stats.streak')} />
          <Tile value={String(stats.streak.best)} label={t('flashcards.stats.best')} />
          <Tile
            value={
              hours > 0
                ? t('flashcards.stats.hoursMinutes', { hours, minutes })
                : t('flashcards.stats.minutes', { minutes })
            }
            label={t('flashcards.stats.weekTime')}
          />
        </View>
        <WeekStrip week={stats.week} locale={locale} />
        <AppText variant="label">{t('flashcards.stats.activity')}</AppText>
        <DayBars
          days={stats.activity}
          color={palette.primary}
          defaultIndex={stats.activity.length - 1}
          formatDate={formatDate}
          formatValue={(value) => String(value)}
          label={t('flashcards.stats.activity')}
        />
      </Card>

      <Card title={t('flashcards.stats.forecast')}>
        <DayBars
          days={stats.forecast}
          color={palette.primary}
          defaultIndex={0}
          formatDate={formatDate}
          formatValue={(value) => String(value)}
          label={t('flashcards.stats.forecast')}
        />
      </Card>

      <Card title={t('flashcards.stats.memory')}>
        <View style={styles.tiles}>
          <Tile
            value={percent(stats.retention.ratio)}
            label={t('flashcards.stats.retention', { count: stats.retention.reviews })}
          />
          <Tile value={percent(stats.retention.target)} label={t('flashcards.stats.target')} />
          <Tile value={percent(stats.test.ratio)} label={t('flashcards.stats.tests', { count: stats.test.answers })} />
        </View>
      </Card>
    </>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  const palette = usePalette();
  return (
    <View style={styles.tile}>
      <AppText style={[styles.tileValue, { color: palette.text }]}>{value}</AppText>
      <AppText variant="caption" tone="secondary" style={styles.tileLabel}>
        {label}
      </AppText>
    </View>
  );
}

/** Letzte 7 Tage: voll gruen mit Haken = geschafft, halb = gelernt, leer = nicht gelernt. */
function WeekStrip({ week, locale }: { week: WeekDay[]; locale: string }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const colors = useBoxColors();
  return (
    <View style={styles.week}>
      {week.map((day) => {
        const name = new Date(day.dayStart).toLocaleDateString(locale, { weekday: 'short' });
        const status = t(`flashcards.stats.day.${day.status}`);
        return (
          <View key={day.dayStart} style={styles.weekDay}>
            <ProgressRing
              size={30}
              stroke={4}
              ratio={day.status === 'full' ? 1 : day.status === 'partial' ? 0.5 : 0}
              color={day.status === 'full' ? colors.mature : palette.primary}
              trackColor={palette.border}
              label={`${name}: ${status}`}
            >
              {day.status === 'full' ? <AppText style={[styles.check, { color: colors.mature }]}>✓</AppText> : null}
            </ProgressRing>
            <AppText variant="caption" tone="secondary">
              {name}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.xs },
  bigNumber: { fontSize: 48, fontWeight: '700', lineHeight: 56 },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, alignItems: 'center', gap: 2 },
  tileValue: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  tileLabel: { textAlign: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 2 },
  check: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
});
