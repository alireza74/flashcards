// Neues Passwort vergeben - in zwei Situationen:
//   mode = recovery: nach "Passwort vergessen"; der Nutzer ist durch den Code bereits angemeldet
//   mode = change:   aus dem Profil heraus ("Passwort aendern")
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { updatePassword } from '@/core/auth/auth-api';
import { getAuthErrorKey } from '@/core/auth/auth-errors';
import { useAuth } from '@/core/auth/auth-provider';
import { newPasswordSchema, type NewPasswordValues } from '@/core/auth/schemas';
import { Button } from '@/shared/ui/button';
import { FormMessage } from '@/shared/ui/form-message';
import { FormTextField } from '@/shared/ui/form-text-field';
import { Screen } from '@/shared/ui/screen';

type NewPasswordScreenProps = {
  mode?: 'recovery' | 'change';
};

export function NewPasswordScreen({ mode = 'recovery' }: NewPasswordScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { setPasswordRecovery } = useAuth();
  const [errorKey, setErrorKey] = useState<string>();
  const [done, setDone] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', passwordConfirm: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setErrorKey(undefined);
    setDone(false);
    try {
      await updatePassword(values.password);
      if (mode === 'recovery') {
        // schaltet im Layout auf die Startseite um
        setPasswordRecovery(false);
      } else {
        setDone(true);
        reset();
      }
    } catch (error) {
      setErrorKey(getAuthErrorKey(error));
    }
  });

  const isChange = mode === 'change';

  return (
    <Screen title={t(isChange ? 'auth.changePassword.title' : 'auth.newPassword.title')}>
      {!isChange ? <FormMessage tone="info" text={t('auth.newPassword.intro')} /> : null}
      {done ? <FormMessage tone="info" text={t('auth.changePassword.done')} /> : null}
      {errorKey ? <FormMessage tone="error" text={t(errorKey)} /> : null}

      <FormTextField
        control={control}
        name="password"
        label={t('auth.fields.newPassword')}
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

      <Button title={t('auth.newPassword.submit')} onPress={onSubmit} loading={isSubmitting} />
      {isChange ? (
        <Button variant="link" title={t('common.back')} onPress={() => router.back()} />
      ) : (
        <Button variant="link" title={t('auth.newPassword.skip')} onPress={() => setPasswordRecovery(false)} />
      )}
    </Screen>
  );
}
