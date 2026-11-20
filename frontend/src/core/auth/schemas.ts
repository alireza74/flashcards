// Eingaberegeln der Anmeldeformulare (zod).
// Fehlermeldungen sind i18n-Schluessel; uebersetzt wird im Formularfeld.
// Die Passwortregel entspricht der Server-Einstellung in backend/supabase/config.toml
// (minimum_password_length = 8, password_requirements = "letters_digits").
import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .pipe(z.email('validation.email'));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'validation.passwordLength')
  .regex(/[A-Za-z]/, 'validation.passwordLetters')
  .regex(/[0-9]/, 'validation.passwordDigits');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'validation.required'),
});

export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(1, 'validation.required').max(100, 'validation.tooLong'),
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: 'validation.passwordMismatch',
    path: ['passwordConfirm'],
  });

export const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'validation.code'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: 'validation.passwordMismatch',
    path: ['passwordConfirm'],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type CodeValues = z.infer<typeof codeSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
