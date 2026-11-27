// Auswahl als umbrechende Kacheln (fuer viele Optionen auf schmalen Bildschirmen).
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/app-text';
import { radius, spacing, usePalette } from '@/shared/ui/theme';

type ChipSelectProps<T extends string> = {
  label?: string;
  options: { value: T; label: string; color?: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
};

export function ChipSelect<T extends string>({ label, options, value, onChange }: ChipSelectProps<T>) {
  const palette = usePalette();

  return (
    <View style={styles.wrapper}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <View role="radiogroup" aria-label={label} style={styles.chips}>
        {options.map((option) => {
          const selected = option.value === value;
          const accent = option.color ?? palette.primary;
          return (
            <Pressable
              key={option.value}
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              aria-disabled={option.disabled}
              disabled={option.disabled}
              onPress={() => onChange(option.value)}
              style={[
                styles.chip,
                option.disabled && styles.disabled,
                { borderColor: selected ? accent : palette.border },
                selected && { backgroundColor: accent },
              ]}
            >
              <AppText variant="caption" style={{ color: selected ? palette.onPrimary : palette.text }}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  disabled: { opacity: 0.45 },
  chip: { borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
});
