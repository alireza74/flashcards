// Registrieren. Danach schickt Supabase einen 6-stelligen Code per Mail;
// die Code-Seite schliesst die Registrierung ab.
// Im Hintergrund legt der Datenbank-Trigger (0004_signup.sql) Profil und
// persoenliche Organisation an.
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { signUp } from '@/core/auth/auth-api';
import { getAuthErrorKey } from '@/core/auth/auth-errors';
import { useAuth } from '@/core/auth/auth-provider';
import { signUpSchema, type SignUpValues } from '@/core/auth/schemas';
import { Button } from '@/shared/ui/button';
import { FormMessage } from '@/shared/ui/form-message';
import { FormTextField } from '@/shared/ui/form-text-field';
import { Screen } from '@/shared/ui/screen';

export function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setPendingEmail } = useAuth();
  const [errorKey, setErrorKey] = useState<string>();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '', passwordConfirm: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setErrorKey(undefined);
    try {
      const { needsConfirmation } = await signUp(values);
      if (needsConfirmation) {
        setPendingEmail(values.email);
        router.push({ pathname: '/verify-code', params: { purpose: 'signup' } });
      }
    } catch (error) {
      setErrorKey(getAuthErrorKey(error));
    }
  });

  return (
    <Screen title={t('auth.signUp.title')}>
      {errorKey ? <FormMessage tone="error" text={t(errorKey)} /> : null}

      <FormTextField
        control={control}
        name="displayName"
        label={t('auth.fields.displayName')}
        autoComplete="name"
        textContentType="name"
      />
      <FormTextField
        control={control}
        name="email"
        label={t('auth.fields.email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <FormTextField
        control={control}
        name="password"
        label={t('auth.fields.password')}
        hint={t('auth.passwordHint')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <FormTextField
        control={control}
        name="passwordConfirm"
        label={t('auth.fields.passwordConfirm')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => onSubmit()}
      />

      <Button title={t('auth.signUp.submit')} onPress={onSubmit} loading={isSubmitting} />
      <Button variant="link" title={t('auth.signUp.toSignIn')} onPress={() => router.back()} />
    </Screen>
  );
}
