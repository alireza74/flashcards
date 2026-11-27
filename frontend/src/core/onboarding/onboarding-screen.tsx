// Einfuehrung beim ersten Start: wenige Seiten, danach nie wieder (Merker auf dem Geraet).
// Ein Klon passt nur die Texte an (i18n: onboarding.pages.<name>) bzw. die Liste in config/onboarding.ts;
// leere Liste = keine Einfuehrung.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { onboardingPages } from '@/config/onboarding';
import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';
import { spacing, usePalette } from '@/shared/ui/theme';

type OnboardingScreenProps = {
  onDone: () => void;
};

export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const palette = usePalette();
  const [index, setIndex] = useState(0);

  const page = onboardingPages[index]!;
  const isLast = index === onboardingPages.length - 1;

  const footer = (
    <>
      <Button
        title={t(isLast ? 'onboarding.start' : 'onboarding.next')}
        onPress={() => (isLast ? onDone() : setIndex(index + 1))}
      />
      {!isLast ? (
        <Button testID="onboarding-skip" variant="link" title={t('onboarding.skip')} onPress={onDone} />
      ) : null}
    </>
  );

  return (
    <Screen title={t(`onboarding.pages.${page}.title`)} footer={footer}>
      <AppText>{t(`onboarding.pages.${page}.text`)}</AppText>
      {/* Punkte: auf welcher Seite bin ich? */}
      <View
        style={styles.dots}
        role="progressbar"
        aria-label={t('onboarding.progress', { current: index + 1, total: onboardingPages.length })}
      >
        {onboardingPages.map((name, i) => (
          <View
            key={name}
            style={[styles.dot, { backgroundColor: i === index ? palette.primary : palette.border }]}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
