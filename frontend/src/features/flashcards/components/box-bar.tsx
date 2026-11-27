// Kartei-Box als Balken: vier Faecher Neu / Lernen / Jung / Gefestigt, Breite nach Anteil.
// Farbe ist nie das einzige Signal - jede Farbe steht mit Name und Zahl in der Legende.

import { useTranslation } from 'react-i18next';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { AppText } from '@/shared/ui/app-text';
import { radius, spacing, usePalette } from '@/shared/ui/theme';

import type { BoxCounts } from '../data/stats';

const BOX_COLORS = {
  light: {
    new: '#B9BBC6',
    learning: '#F2A33A',
    young: '#8BD4A0',
    mature: '#2E9E6B',
  },
  dark: {
    new: '#5A5C66',
    learning: '#D9892A',
    young: '#4E9B68',
    mature: '#3FBF86',
  },
} as const;

const COMPARTMENTS = ['new', 'learning', 'young', 'mature'] as const;

export function BoxBar({ counts }: { counts: BoxCounts }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const colors = BOX_COLORS[useColorScheme() === 'dark' ? 'dark' : 'light'];

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{t('flashcards.box.title')}</AppText>
      <AppText tone="secondary">
        {t('flashcards.box.learned', {
          mature: counts.mature,
          total: counts.total,
        })}
      </AppText>
      <View
        style={[styles.bar, { backgroundColor: palette.surface }]}
        role="img"
        aria-label={COMPARTMENTS.map((key) => `${t(`flashcards.box.${key}`)} ${counts[key]}`).join(', ')}
      >
        {counts.total > 0
          ? COMPARTMENTS.map((key) =>
              counts[key] > 0 ? <View key={key} style={{ flex: counts[key], backgroundColor: colors[key] }} /> : null,
            )
          : null}
      </View>
      <View style={styles.legend}>
        {COMPARTMENTS.map((key) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors[key] }]} />
            <AppText variant="caption">{`${t(`flashcards.box.${key}`)} ${counts[key]}`}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  bar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
