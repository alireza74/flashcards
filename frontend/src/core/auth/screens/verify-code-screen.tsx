// 6-stelligen Code aus der E-Mail eingeben.
// purpose = signup   -> Registrierung bestaetigen, danach angemeldet
// purpose = recovery -> Passwort vergessen; danach angemeldet und weiter zu "Neues Passwort"
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { resendCode, verifyCode, type CodePurpose } from '@/core/auth/auth-api';
import { getAuthErrorKey } from '@/core/auth/auth-errors';
import { useAuth } from '@/core/auth/auth-provider';
import { codeSchema, type CodeValues } from '@/core/auth/schemas';
import { Button } from '@/shared/ui/button';
import { FormMessage } from '@/shared/ui/form-message';
import { FormTextField } from '@/shared/ui/form-text-field';
import { Screen } from '@/shared/ui/screen';

export function VerifyCodeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setPasswordRecovery, pendingEmail } = useAuth();
  // Nur der Zweck steht in der URL; die E-Mail kommt aus dem App-Zustand.
  const params = useLocalSearchParams<{ purpose?: string }>();
  const email = pendingEmail ?? '';
  const purpose: CodePurpose = params.purpose === 'recovery' ? 'recovery' : 'signup';

  const [errorKey, setErrorKey] = useState<string>();
  const [infoKey, setInfoKey] = useState<string>();
  const [isResending, setIsResending] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setErrorKey(undefined);
    setInfoKey(undefined);
    // Vor dem Bestaetigen setzen: Sobald die Sitzung da ist, entscheidet das Layout,
    // ob "Neues Passwort" oder die Startseite erscheint.
    if (purpose === 'recovery') setPasswordRecovery(true);
    try {
      await verifyCode(email, values.code, purpose);
    } catch (error) {
      if (purpose === 'recovery') setPasswordRecovery(false);
      setErrorKey(getAuthErrorKey(error));
    }
  });

  const onResend = async () => {
    setErrorKey(undefined);
    setInfoKey(undefined);
    setIsResending(true);
    try {
      await resendCode(email, purpose);
      setInfoKey('auth.verifyCode.resent');
    } catch (error) {
      setErrorKey(getAuthErrorKey(error));
    } finally {
      setIsResending(false);
    }
  };

  // z. B. Seite im Browser neu geladen: E-Mail ist nicht mehr bekannt -> neu beginnen
  if (!email) {
    return (
      <Screen title={t('auth.verifyCode.titleSignUp')}>
        <FormMessage tone="info" text={t('auth.verifyCode.missingEmail')} />
        <Button title={t('auth.signIn.title')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t(purpose === 'recovery' ? 'auth.verifyCode.titleRecovery' : 'auth.verifyCode.titleSignUp')}
    >
      <FormMessage tone="info" text={t('auth.verifyCode.intro', { email })} />
      {errorKey ? <FormMessage tone="error" text={t(errorKey)} /> : null}
      {infoKey ? <FormMessage tone="info" text={t(infoKey)} /> : null}

      <FormTextField
        control={control}
        name="code"
        label={t('auth.fields.code')}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        onSubmitEditing={() => onSubmit()}
      />

      <Button title={t('auth.verifyCode.submit')} onPress={onSubmit} loading={isSubmitting} />
      <Button
        variant="link"
        title={t('auth.verifyCode.resend')}
        onPress={onResend}
        loading={isResending}
      />
    </Screen>
  );
}
