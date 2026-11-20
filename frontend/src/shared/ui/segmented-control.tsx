// Auswahl aus wenigen Optionen nebeneinander (z. B. Sprache).
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { radius, spacing, usePalette } from './theme';

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) {
  const palette = usePalette();

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <View role="radiogroup" aria-label={label} style={[styles.row, { borderColor: palette.border }]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              aria-disabled={disabled}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[styles.segment, selected && { backgroundColor: palette.primary }]}
            >
              <AppText style={{ color: selected ? palette.onPrimary : palette.text }}>{option.label}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
});
