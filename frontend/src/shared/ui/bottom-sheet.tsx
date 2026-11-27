// Blatt von unten (wie in Karten- und Foto-Apps): fuer Details und kurze Auswahlen, statt langer
// Formulare auf der Seite. Tipp auf den abgedunkelten Hintergrund oder das X schliesst es.
// centered = kleines Popup in der Bildmitte statt Blatt von unten (fuer kurze Fragen direkt am Plan).
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, usePalette } from '@/shared/ui/theme';

import { IconButton } from './header-buttons';

type BottomSheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode; // z. B. Speichern-Knopf, bleibt unten sichtbar
  centered?: boolean;
};

export function BottomSheet({ visible, title, onClose, children, footer, centered }: BottomSheetProps) {
  const { t } = useTranslation();
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Modal transparent visible={visible} animationType={centered ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.flex, centered && styles.centerBox]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={[styles.backdrop, centered && StyleSheet.absoluteFill]}
          onPress={onClose}
          aria-label={t('common.cancel')}
        />
        <View
          style={[
            centered ? styles.popup : styles.sheet,
            {
              backgroundColor: palette.background,
              borderColor: palette.border,
              paddingBottom: centered ? spacing.md : insets.bottom + spacing.sm,
            },
          ]}
        >
          <View style={styles.header}>
            <Text role="heading" style={[styles.title, { color: palette.text }]}>
              {title}
            </Text>
            <IconButton icon="close" label={t('common.cancel')} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  centerBox: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  popup: { width: '100%', maxWidth: 360, borderRadius: radius.md * 2, borderWidth: StyleSheet.hairlineWidth },
  sheet: {
    maxHeight: '80%',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingTop: spacing.sm,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '600' },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
