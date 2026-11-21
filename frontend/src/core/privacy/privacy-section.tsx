// Abschnitte "Datenschutz" und "Rechtliches" auf der Profilseite.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { signOut } from '@/core/auth/auth-api';
import { useAuth } from '@/core/auth/auth-provider';
import { shareLog } from '@/core/monitoring/log-file';
import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FormMessage } from '@/shared/ui/form-message';
import { spacing, usePalette } from '@/shared/ui/theme';

import {
  consentPurposes,
  exportMyData,
  isLastOwnerError,
  useConsents,
  useRequestDeletion,
  useSetConsent,
} from './privacy-api';

export function PrivacySection() {
  const { t } = useTranslation();
  const router = useRouter();
  const palette = usePalette();
  const { session } = useAuth();
  const userId = session?.user.id;

  const consents = useConsents(userId);
  const setConsent = useSetConsent(userId);
  const requestDeletion = useRequestDeletion(userId);

  const [message, setMessage] = useState<{ tone: 'info' | 'error'; key: string }>();
  const [isExporting, setIsExporting] = useState(false);
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const [isSharingLog, setIsSharingLog] = useState(false);

  const onShareLog = async () => {
    setMessage(undefined);
    setIsSharingLog(true);
    try {
      await shareLog();
      setMessage({ tone: 'info', key: 'monitoring.share.done' });
    } catch {
      setMessage({ tone: 'error', key: 'common.error' });
    } finally {
      setIsSharingLog(false);
    }
  };

  const onExport = async () => {
    setMessage(undefined);
    setIsExporting(true);
    try {
      await exportMyData();
      setMessage({ tone: 'info', key: 'privacy.export.done' });
    } catch {
      setMessage({ tone: 'error', key: 'common.error' });
    } finally {
      setIsExporting(false);
    }
  };

  const onDelete = async () => {
    setMessage(undefined);
    // Zweistufig: erster Druck fragt nach, zweiter loescht.
    if (!confirmDeletion) {
      setConfirmDeletion(true);
      return;
    }
    try {
      await requestDeletion.mutateAsync();
      // Konto ist deaktiviert; Abmelden fuehrt zur Anmeldeseite.
      await signOut().catch(() => undefined);
    } catch (error) {
      setConfirmDeletion(false);
      setMessage({ tone: 'error', key: isLastOwnerError(error) ? 'privacy.deletion.lastOwner' : 'common.error' });
    }
  };

  return (
    <>
      <Card title={t('profile.sectionPrivacy')}>
        {message ? <FormMessage tone={message.tone} text={t(message.key)} /> : null}

        <AppText variant="label">{t('privacy.consents.title')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('privacy.consents.intro')}
        </AppText>
        {consentPurposes.map((purpose) => (
          <View key={purpose} style={styles.row}>
            <AppText style={styles.rowLabel}>{t(`privacy.consents.${purpose}`)}</AppText>
            <Switch
              aria-label={t(`privacy.consents.${purpose}`)}
              value={consents.data?.[purpose] === true}
              disabled={consents.isPending || setConsent.isPending}
              trackColor={{ true: palette.primary, false: palette.border }}
              onValueChange={(granted) =>
                setConsent.mutate(
                  { purpose, granted },
                  { onError: () => setMessage({ tone: 'error', key: 'common.error' }) },
                )
              }
            />
          </View>
        ))}

        <AppText variant="label">{t('monitoring.share.title')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('monitoring.share.intro')}
        </AppText>
        <Button
          variant="secondary"
          title={t('monitoring.share.button')}
          onPress={onShareLog}
          loading={isSharingLog}
        />

        <AppText variant="label">{t('privacy.export.title')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('privacy.export.intro')}
        </AppText>
        <Button variant="secondary" title={t('privacy.export.button')} onPress={onExport} loading={isExporting} />

        <AppText variant="label">{t('privacy.deletion.title')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('privacy.deletion.intro')}
        </AppText>
        {confirmDeletion ? <FormMessage tone="error" text={t('privacy.deletion.confirm')} /> : null}
        <Button
          variant="secondary"
          title={t(confirmDeletion ? 'privacy.deletion.confirmButton' : 'privacy.deletion.button')}
          onPress={onDelete}
          loading={requestDeletion.isPending}
        />
        {confirmDeletion ? (
          <Button variant="link" title={t('common.cancel')} onPress={() => setConfirmDeletion(false)} />
        ) : null}
      </Card>

      <Card title={t('profile.sectionLegal')}>
        <Button variant="link" title={t('legal.privacyTitle')} onPress={() => router.push('/privacy-policy')} />
        <Button variant="link" title={t('legal.imprintTitle')} onPress={() => router.push('/imprint')} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: { flex: 1 },
});
