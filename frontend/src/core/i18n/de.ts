// Deutsche Texte. Schluessel englisch, Werte deutsch.
// Jeder Schluessel muss auch in en.ts existieren (TypeScript prueft das).
export const de = {
  common: {
    back: 'Zurück',
    loading: 'Wird geladen ...',
  },
  validation: {
    required: 'Pflichtfeld',
    email: 'Bitte eine gültige E-Mail-Adresse eingeben',
    tooLong: 'Zu lang',
    passwordLength: 'Mindestens 8 Zeichen',
    passwordLetters: 'Mindestens ein Buchstabe',
    passwordDigits: 'Mindestens eine Ziffer',
    passwordMismatch: 'Die Passwörter stimmen nicht überein',
    code: 'Bitte den 6-stelligen Code eingeben',
  },
  auth: {
    fields: {
      displayName: 'Anzeigename',
      email: 'E-Mail',
      password: 'Passwort',
      passwordConfirm: 'Passwort wiederholen',
      newPassword: 'Neues Passwort',
      code: 'Code',
    },
    passwordHint: 'Mindestens 8 Zeichen, Buchstaben und Ziffern',
    signIn: {
      title: 'Anmelden',
      submit: 'Anmelden',
      toSignUp: 'Noch kein Konto? Registrieren',
      toForgotPassword: 'Passwort vergessen?',
      enterCode: 'Code eingeben',
    },
    signUp: {
      title: 'Konto erstellen',
      submit: 'Registrieren',
      toSignIn: 'Schon registriert? Anmelden',
    },
    verifyCode: {
      titleSignUp: 'E-Mail bestätigen',
      titleRecovery: 'Code eingeben',
      intro: 'Wir haben einen 6-stelligen Code an {{email}} gesendet.',
      submit: 'Bestätigen',
      resend: 'Code erneut senden',
      resent: 'Ein neuer Code ist unterwegs.',
      missingEmail: 'Dieser Schritt ist abgelaufen. Bitte melde dich erneut an oder registriere dich.',
    },
    forgotPassword: {
      title: 'Passwort vergessen',
      intro: 'Gib deine E-Mail-Adresse ein. Falls ein Konto existiert, senden wir dir einen Code.',
      submit: 'Code anfordern',
    },
    newPassword: {
      title: 'Neues Passwort',
      intro: 'Vergib jetzt ein neues Passwort für dein Konto.',
      submit: 'Passwort speichern',
      skip: 'Später',
    },
    errors: {
      invalid_credentials: 'E-Mail oder Passwort ist falsch.',
      email_not_confirmed: 'Deine E-Mail-Adresse ist noch nicht bestätigt.',
      user_already_exists: 'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
      weak_password: 'Das Passwort ist zu schwach.',
      otp_expired: 'Der Code ist falsch oder abgelaufen.',
      same_password: 'Das neue Passwort muss sich vom alten unterscheiden.',
      over_email_send_rate_limit: 'Zu viele E-Mails angefordert. Bitte später erneut versuchen.',
      over_request_rate_limit: 'Zu viele Versuche. Bitte kurz warten.',
      network: 'Keine Verbindung zum Server.',
      unknown: 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
    },
  },
  home: {
    greeting: 'Hallo, {{name}}',
    signedInAs: 'Angemeldet als {{email}}',
    organization: 'Organisation: {{name}}',
    signOut: 'Abmelden',
    loadError: 'Profil konnte nicht geladen werden.',
  },
} as const;

type DeepStringify<T> = { [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]> };

export type Translations = DeepStringify<typeof de>;
