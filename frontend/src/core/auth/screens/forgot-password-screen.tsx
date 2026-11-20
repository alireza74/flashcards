// Passwort vergessen: Code per Mail anfordern, danach weiter zur Code-Eingabe.
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { requestPasswordReset } from '@/core/auth/auth-api';
import { getAuthErrorKey } from '@/core/auth/auth-errors';
import { useAuth } from '@/core/auth/auth-provider';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/core/auth/schemas';
import { Button } from '@/shared/ui/button';
import { FormMessage } from '@/shared/ui/form-message';
import { FormTextField } from '@/shared/ui/form-text-field';
import { Screen } from '@/shared/ui/screen';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setPendingEmail } = useAuth();
  const [errorKey, setErrorKey] = useState<string>();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setErrorKey(undefined);
    try {
      await requestPasswordReset(values.email);
      setPendingEmail(values.email);
      router.push({ pathname: '/verify-code', params: { purpose: 'recovery' } });
    } catch (error) {
      setErrorKey(getAuthErrorKey(error));
    }
  });

  return (
    <Screen title={t('auth.forgotPassword.title')}>
      <FormMessage tone="info" text={t('auth.forgotPassword.intro')} />
      {errorKey ? <FormMessage tone="error" text={t(errorKey)} /> : null}

      <FormTextField
        control={control}
        name="email"
        label={t('auth.fields.email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        onSubmitEditing={() => onSubmit()}
      />

      <Button title={t('auth.forgotPassword.submit')} onPress={onSubmit} loading={isSubmitting} />
      <Button variant="link" title={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
