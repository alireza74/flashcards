// Balken je Niveau, unterteilt in die Kartei-Box-Faecher (gleiche Farben und Legende wie die Kartei-Box).
// Laenge = Anteil der Karten des Niveaus am groessten Niveau; rechts "gefestigt von gesamt" als Text.

import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/app-text';
import { radius, spacing, usePalette } from '@/shared/ui/theme';

import type { LevelRow } from '../data/statistics';
import { useBoxColors } from './box-bar';

const COMPARTMENTS = ['mature', 'young', 'learning', 'new'] as const;

export function LevelBars({ rows }: { rows: LevelRow[] }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const colors = useBoxColors();
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <View style={styles.wrapper}>
      {rows.map((row) => {
        const name = row.level ?? t('flashcards.note.noLevel');
        const text = t('flashcards.stats.levelValue', { mature: row.mature, total: row.total });
        return (
          <View key={row.level ?? 'none'} style={styles.row} role="img" aria-label={`${name}: ${text}`}>
            <AppText variant="label" style={styles.name}>
              {name}
            </AppText>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${(row.total / max) * 100}%`, backgroundColor: palette.surface }]}>
                {COMPARTMENTS.map((key) =>
                  row[key] > 0 ? <View key={key} style={{ flex: row[key], backgroundColor: colors[key] }} /> : null,
                )}
              </View>
            </View>
            <AppText variant="caption" tone="secondary" style={styles.value}>
              {text}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { width: 40 },
  track: { flex: 1 },
  // 2 px Luecke zwischen den Faechern, Enden 4 px gerundet
  bar: { flexDirection: 'row', height: 14, borderRadius: radius.sm, overflow: 'hidden', gap: 2 },
  value: { width: 92, textAlign: 'right' },
});
