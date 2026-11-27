// Anmelden mit E-Mail und Passwort.
// Nach Erfolg muss die Seite nichts tun: Die neue Sitzung schaltet im Wurzel-Layout
// automatisch auf die Startseite um (Stack.Protected).
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { resendCode, signIn } from '@/core/auth/auth-api';
import { getAuthErrorCode, getAuthErrorKey } from '@/core/auth/auth-errors';
import { useAuth } from '@/core/auth/auth-provider';
import { signInSchema, type SignInValues } from '@/core/auth/schemas';
import { Button } from '@/shared/ui/button';
import { FormMessage } from '@/shared/ui/form-message';
import { FormTextField } from '@/shared/ui/form-text-field';
import { Screen } from '@/shared/ui/screen';

export function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setPendingEmail } = useAuth();
  const [errorKey, setErrorKey] = useState<string>();
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setErrorKey(undefined);
    setNeedsConfirmation(false);
    try {
      await signIn(values.email, values.password);
    } catch (error) {
      setErrorKey(getAuthErrorKey(error));
      setNeedsConfirmation(getAuthErrorCode(error) === 'email_not_confirmed');
    }
  });

  const goToCodeEntry = async () => {
    const email = getValues('email').trim();
    // neuen Code schicken; Fehler hier ignorieren, die Code-Seite bietet "erneut senden"
    await resendCode(email, 'signup').catch(() => undefined);
    setPendingEmail(email);
    router.push({ pathname: '/verify-code', params: { purpose: 'signup' } });
  };

  return (
    <Screen title={t('auth.signIn.title')}>
      {errorKey ? <FormMessage tone="error" text={t(errorKey)} /> : null}
      {needsConfirmation ? (
        <Button variant="secondary" title={t('auth.signIn.enterCode')} onPress={goToCodeEntry} />
      ) : null}

      <FormTextField
        control={control}
        name="email"
        testID="sign-in-email"
        label={t('auth.fields.email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <FormTextField
        control={control}
        name="password"
        testID="sign-in-password"
        label={t('auth.fields.password')}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => onSubmit()}
      />

      <Button testID="sign-in-submit" title={t('auth.signIn.submit')} onPress={onSubmit} loading={isSubmitting} />
      <Button
        variant="link"
        title={t('auth.signIn.toForgotPassword')}
        onPress={() => router.push('/forgot-password')}
      />
      <Button variant="link" title={t('auth.signIn.toSignUp')} onPress={() => router.push('/sign-up')} />
    </Screen>
  );
}
