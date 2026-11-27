// Ring fuer den Tagesfortschritt: Anteil erledigt, in der Mitte Zahl oder Haken.
// Farbe ist nicht das einzige Signal: Text in der Mitte und aria-label sagen dasselbe.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { usePalette } from '@/shared/ui/theme';

type ProgressRingProps = {
  /** 0..1 */
  ratio: number;
  color: string;
  size?: number;
  stroke?: number;
  label: string;
  children?: ReactNode;
};

export function ProgressRing({ ratio, color, size = 168, stroke = 14, label, children }: ProgressRingProps) {
  const palette = usePalette();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(1, Math.max(0, ratio)) * circumference;

  return (
    <View role="img" aria-label={label} style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={palette.surface} strokeWidth={stroke} fill="none" />
        {filled > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            // oben beginnen, im Uhrzeigersinn
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.center}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
