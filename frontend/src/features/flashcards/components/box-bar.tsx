// Kartei-Box als Balken: vier Faecher Neu / Lernen / Jung / Gefestigt, Breite nach Anteil.
// Farbe ist nie das einzige Signal - jede Farbe steht mit Name und Zahl in der Legende.

import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

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

/** Farben der Kartei-Box-Faecher fuer das aktuelle Farbschema (gruen = gefestigt, auch fuer "geschafft"). */
export function useBoxColors() {
  return BOX_COLORS[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

type BoxBarProps = {
  counts: BoxCounts;
  /** Tippen auf ein Fach der Legende (z. B. Karten dieses Fachs zeigen) */
  onSelect?: (box: (typeof COMPARTMENTS)[number]) => void;
};

export function BoxBar({ counts, onSelect }: BoxBarProps) {
  const { t } = useTranslation();
  const palette = usePalette();
  const colors = useBoxColors();

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
          <Pressable
            key={key}
            role={onSelect ? 'button' : undefined}
            disabled={!onSelect || counts[key] === 0}
            onPress={() => onSelect?.(key)}
            style={[styles.legendItem, onSelect && counts[key] > 0 ? { borderColor: palette.border } : null]}
          >
            <View style={[styles.dot, { backgroundColor: colors[key] }]} />
            <AppText variant="caption">{`${t(`flashcards.box.${key}`)} ${counts[key]}`}</AppText>
          </Pressable>
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
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.md,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
