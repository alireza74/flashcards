// Profil und Einstellungen: Anzeigename, Sprache, Passwort, Datenschutz
// (Einwilligungen, Export, Konto loeschen), Rechtliches, Abmelden.
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { UpdateSection } from '@/core/app-version/update-section';
import { signOut } from '@/core/auth/auth-api';
import { useAuth } from '@/core/auth/auth-provider';
import i18n, { languageNames, supportedLanguages, type Language } from '@/core/i18n';
import { changeLanguage, isRtlLanguage } from '@/core/i18n/language';
import { appMeta } from '@/core/monitoring/log-file';
import { PrivacySection } from '@/core/privacy/privacy-section';
import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FormMessage } from '@/shared/ui/form-message';
import { FormTextField } from '@/shared/ui/form-text-field';
import { BackButton } from '@/shared/ui/header-buttons';
import { Screen } from '@/shared/ui/screen';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { ErrorState, LoadingState } from '@/shared/ui/states';

import { FeedbackSection } from './feedback-section';
import { useProfile, useUpdateProfile } from './use-profile';

const displayNameSchema = z.object({
  displayName: z.string().trim().min(1, 'validation.required').max(100, 'validation.tooLong'),
});
type DisplayNameValues = z.infer<typeof displayNameSchema>;

export function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const profile = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);
  const [messageKey, setMessageKey] = useState<{ tone: 'info' | 'error'; key: string }>();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<DisplayNameValues>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { displayName: '' },
  });

  // Formular fuellen, sobald das Profil geladen ist
  const loadedName = profile.data?.display_name ?? '';
  useEffect(() => {
    reset({ displayName: loadedName });
  }, [loadedName, reset]);

  const onSaveName = handleSubmit(async (values) => {
    setMessageKey(undefined);
    try {
      await updateProfile.mutateAsync({ display_name: values.displayName });
      setMessageKey({ tone: 'info', key: 'common.saved' });
    } catch {
      setMessageKey({ tone: 'error', key: 'common.error' });
    }
  });

  const onChangeLanguage = async (language: Language) => {
    setMessageKey(undefined);
    try {
      // zuerst im Profil speichern, damit die Wahl nach einem Neustart (RTL) erhalten bleibt
      await updateProfile.mutateAsync({ locale: language });
      if (isRtlLanguage(language) !== isRtlLanguage(i18n.language as Language)) {
        setMessageKey({ tone: 'info', key: 'profile.restartHint' });
      }
      await changeLanguage(language);
    } catch {
      setMessageKey({ tone: 'error', key: 'common.error' });
    }
  };

  if (profile.isPending) {
    return (
      <Screen headerLeft={<BackButton />} title={t('profile.title')}>
        <LoadingState />
      </Screen>
    );
  }

  if (profile.isError) {
    return (
      <Screen headerLeft={<BackButton />} title={t('profile.title')}>
        <ErrorState message={t('home.loadError')} onRetry={() => profile.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen headerLeft={<BackButton />} title={t('profile.title')}>
      {messageKey ? <FormMessage tone={messageKey.tone} text={t(messageKey.key)} /> : null}

      <Card title={t('profile.sectionProfile')}>
        <AppText tone="secondary">{t('profile.email', { email: session?.user.email ?? '' })}</AppText>
        <FormTextField
          control={control}
          name="displayName"
          label={t('auth.fields.displayName')}
          autoComplete="name"
          onSubmitEditing={() => onSaveName()}
        />
        <Button title={t('common.save')} onPress={onSaveName} loading={isSubmitting} />
      </Card>

      <Card title={t('profile.sectionLanguage')}>
        <SegmentedControl
          label={t('profile.language')}
          options={supportedLanguages.map((value) => ({ value, label: languageNames[value] }))}
          value={i18n.language as Language}
          onChange={onChangeLanguage}
          disabled={updateProfile.isPending}
        />
      </Card>

      <Card title={t('profile.sectionSecurity')}>
        <Button
          variant="secondary"
          title={t('profile.changePassword')}
          onPress={() => router.push('/change-password')}
        />
      </Card>

      <PrivacySection />

      <FeedbackSection />

      <UpdateSection />

      <Button
        testID="sign-out"
        variant="secondary"
        title={t('home.signOut')}
        onPress={() => signOut().catch(() => undefined)}
      />

      {/* Welcher Stand laeuft? Hilft beim Testen und bei Rueckfragen */}
      <AppText variant="caption" tone="secondary" selectable style={{ textAlign: 'center' }}>
        {versionLabel(t)}
      </AppText>
    </Screen>
  );
}

// "Version 0.1.0 · Update 5b9c2281 (preview)" bzw. "... · eingebaut", im Web "... · Web"
function versionLabel(t: TFunction): string {
  const meta = appMeta();
  const version = meta.appVersion ?? '-';
  if (Platform.OS === 'web') {
    return t('profile.versionWeb', { version });
  }
  if (Updates.isEmbeddedLaunch || !meta.updateId) {
    return t('profile.versionEmbedded', { version, channel: meta.channel ?? '-' });
  }
  return t('profile.versionUpdate', { version, update: meta.updateId.slice(0, 8), channel: meta.channel ?? '-' });
}
