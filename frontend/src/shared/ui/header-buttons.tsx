// Knoepfe fuer Kopfzeilen: Icon-Knopf, Zurueck (links) und das Menue "..." fuer seltene Aktionen (rechts).
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { radius, spacing, usePalette } from '@/shared/ui/theme';

import { Icon, type IconName } from './icons';

type IconButtonProps = { icon: IconName; label: string; onPress: () => void; active?: boolean };

// 44 x 44 Tippflaeche (Mindestgroesse nach Apple/Google), Icon in der Mitte
export function IconButton({ icon, label, onPress, active = false }: IconButtonProps) {
  const palette = usePalette();
  return (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        active && { backgroundColor: palette.infoSurface },
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} color={active ? palette.primary : palette.text} />
    </Pressable>
  );
}

// Zurueck zur vorigen Seite; ohne Verlauf (z. B. Seite direkt geoeffnet) zur Startseite
export function BackButton() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <IconButton
      icon="back"
      label={t('common.back')}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}

export type MenuItem = {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  // gesetzt = erst nach zweitem Tipp ausfuehren (Text wechselt auf die Rueckfrage)
  confirmLabel?: string;
};

export function MoreMenu({ items }: { items: MenuItem[] }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setArmed(null);
  };

  return (
    <>
      <IconButton icon="more" label={t('common.more')} onPress={() => setOpen(true)} />
      <Modal transparent visible={open} animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} aria-label={t('common.cancel')}>
          <View style={[styles.menu, { backgroundColor: palette.background, borderColor: palette.border }]}>
            {items.map((item) => {
              const isArmed = armed === item.key;
              return (
                <Pressable
                  key={item.key}
                  role="menuitem"
                  onPress={() => {
                    if (item.confirmLabel && !isArmed) {
                      setArmed(item.key);
                      return;
                    }
                    close();
                    item.onPress();
                  }}
                  style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: palette.surface }]}
                >
                  <Text style={[styles.menuText, { color: item.destructive ? palette.danger : palette.text }]}>
                    {isArmed ? item.confirmLabel : item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  menu: {
    position: 'absolute',
    top: 56,
    right: spacing.md,
    minWidth: 200,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
  },
  menuItem: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  menuText: { fontSize: 15 },
});
