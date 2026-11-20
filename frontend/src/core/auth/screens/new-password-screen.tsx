// Neues Passwort nach "Passwort vergessen". Der Nutzer ist durch den Code bereits angemeldet.
import { zodResolver } from '@hookform/resolvers/zod';
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

export function NewPasswordScreen() {
  const { t } = useTranslation();
  const { setPasswordRecovery } = useAuth();
  const [errorKey, setErrorKey] = useState<string>();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', passwordConfirm: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setErrorKey(undefined);
    try {
      await updatePassword(values.password);
      // schaltet im Layout auf die Startseite um
      setPasswordRecovery(false);
    } catch (error) {
      setErrorKey(getAuthErrorKey(error));
    }
  });

  return (
    <Screen title={t('auth.newPassword.title')}>
      <FormMessage tone="info" text={t('auth.newPassword.intro')} />
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
      <Button variant="link" title={t('auth.newPassword.skip')} onPress={() => setPasswordRecovery(false)} />
    </Screen>
  );
}
