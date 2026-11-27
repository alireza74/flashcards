// Zahl mit - und + (Schrittweite waehlbar) oder direkt eintippen.
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/shared/ui/app-text';
import { radius, spacing, usePalette } from '@/shared/ui/theme';

type NumberStepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
  max: number;
  decreaseLabel: string;
  increaseLabel: string;
};

export function NumberStepper({ label, value, onChange, step, max, decreaseLabel, increaseLabel }: NumberStepperProps) {
  const palette = usePalette();
  const set = (next: number) => onChange(Math.min(max, Math.max(0, next)));
  const button = (text: string, a11y: string, next: number, disabled: boolean) => (
    <Pressable
      role="button"
      aria-label={a11y}
      disabled={disabled}
      onPress={() => set(next)}
      style={[styles.button, { borderColor: palette.border, opacity: disabled ? 0.4 : 1 }]}
    >
      <AppText variant="heading">{text}</AppText>
    </Pressable>
  );

  return (
    <View style={styles.row}>
      <AppText style={styles.label}>{label}</AppText>
      {button('−', decreaseLabel, value - step, value <= 0)}
      <TextInput
        aria-label={label}
        value={String(value)}
        onChangeText={(text) => set(Number(text.replace(/\D/g, '')) || 0)}
        keyboardType="number-pad"
        maxLength={String(max).length}
        style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
      />
      {button('+', increaseLabel, value + step, value >= max)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1 },
  button: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    width: 64,
    height: 40,
    borderWidth: 1,
    borderRadius: radius.md,
    textAlign: 'center',
    fontSize: 16,
  },
});
