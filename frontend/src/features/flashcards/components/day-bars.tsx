// Saeulen je Tag (eine Reihe, eine Farbe - der Titel nennt sie, keine Legende).
// Antippen einer Saeule zeigt Datum und Wert darueber; ohne Auswahl der hervorgehobene Tag (z. B. heute).
// Saeulen: oben 4 px gerundet, unten an der Grundlinie, 2 px Luecke. Achse: erstes, mittleres, letztes Datum.

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/app-text';
import { spacing, usePalette } from '@/shared/ui/theme';

import type { DayValue } from '../data/statistics';

type DayBarsProps = {
  days: DayValue[];
  color: string;
  /** Index, der ohne Auswahl angezeigt wird */
  defaultIndex: number;
  formatDate: (dayStart: number) => string;
  formatValue: (value: number) => string;
  /** Beschreibung fuer Bildschirmleser, z. B. "Gelernte Karten der letzten 30 Tage" */
  label: string;
  height?: number;
};

export function DayBars({ days, color, defaultIndex, formatDate, formatValue, label, height = 120 }: DayBarsProps) {
  const palette = usePalette();
  const [selected, setSelected] = useState<number | null>(null);
  const shown = days[selected ?? defaultIndex];
  const max = Math.max(1, ...days.map((d) => d.value));
  const axis = [0, Math.floor((days.length - 1) / 2), days.length - 1];

  return (
    <View style={styles.wrapper}>
      {shown ? (
        <AppText variant="caption" tone="secondary">
          {`${formatDate(shown.dayStart)}: ${formatValue(shown.value)}`}
        </AppText>
      ) : null}
      <View style={[styles.plot, { height, borderColor: palette.border }]} role="img" aria-label={label}>
        {days.map((day, index) => {
          const active = index === (selected ?? defaultIndex);
          return (
            <Pressable
              key={day.dayStart}
              style={styles.slot}
              onPress={() => setSelected(index === selected ? null : index)}
              aria-label={`${formatDate(day.dayStart)}: ${formatValue(day.value)}`}
            >
              {day.value > 0 ? (
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(2, (day.value / max) * (height - 4)),
                      backgroundColor: color,
                      opacity: active ? 1 : 0.75,
                    },
                  ]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {axis.map((index, position) => (
          <AppText
            key={position}
            variant="caption"
            tone="secondary"
            style={position === 0 ? styles.axisStart : position === 1 ? styles.axisMiddle : styles.axisEnd}
          >
            {days[index] ? formatDate(days[index].dayStart) : ''}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  plot: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1 },
  // Tippflaeche = ganze Spaltenhoehe, groesser als die Saeule
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1 },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row' },
  axisStart: { flex: 1, textAlign: 'left' },
  axisMiddle: { flex: 1, textAlign: 'center' },
  axisEnd: { flex: 1, textAlign: 'right' },
});
