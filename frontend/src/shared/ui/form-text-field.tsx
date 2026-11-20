// Verbindet TextField mit react-hook-form: Wert, Aenderung, Fehlermeldung.
// Fehlermeldungen aus den zod-Schemas sind i18n-Schluessel und werden hier uebersetzt.
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { TextField, type TextFieldProps } from './text-field';

type FormTextFieldProps<T extends FieldValues> = Omit<
  TextFieldProps,
  'value' | 'onChangeText' | 'onBlur' | 'error'
> & {
  control: Control<T>;
  name: Path<T>;
};

export function FormTextField<T extends FieldValues>({
  control,
  name,
  ...fieldProps
}: FormTextFieldProps<T>) {
  const { t } = useTranslation();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          value={field.value ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
          {...fieldProps}
        />
      )}
    />
  );
}
