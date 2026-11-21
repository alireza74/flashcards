// Deutsche Texte. Schluessel englisch, Werte deutsch.
// Jeder Schluessel muss auch in en.ts und fa.ts existieren (TypeScript prueft das).
export const de = {
  common: {
    back: 'Zurück',
    loading: 'Wird geladen ...',
    retry: 'Erneut versuchen',
    save: 'Speichern',
    saved: 'Gespeichert.',
    cancel: 'Abbrechen',
    error: 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
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
      legalHint: 'Mit der Registrierung gilt unsere Datenschutzerklärung.',
    },
    verifyCode: {
      titleSignUp: 'E-Mail bestätigen',
      titleRecovery: 'Code eingeben',
      intro: 'Wir haben einen 6-stelligen Code an {{email}} gesendet.',
      submit: 'Bestätigen',
      resend: 'Code erneut senden',
      resent: 'Ein neuer Code ist unterwegs.',
      missingEmail: 'Dieser Schritt ist abgelaufen. Bitte melde dich erneut an oder registriere dich.',
      backToSignIn: 'Zurück zur Anmeldung',
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
    changePassword: {
      title: 'Passwort ändern',
      done: 'Dein Passwort wurde geändert.',
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
    toProfile: 'Profil und Einstellungen',
  },
  profile: {
    title: 'Profil',
    sectionProfile: 'Persönliche Angaben',
    email: 'E-Mail: {{email}}',
    sectionLanguage: 'Sprache',
    language: 'Sprache der App',
    restartHint: 'Die App startet neu, um die Leserichtung umzustellen.',
    sectionSecurity: 'Sicherheit',
    changePassword: 'Passwort ändern',
    sectionPrivacy: 'Datenschutz',
    sectionLegal: 'Rechtliches',
  },
  privacy: {
    consents: {
      title: 'Einwilligungen',
      intro: 'Freiwillig und jederzeit widerrufbar. Ohne Einwilligung bleibt die App voll nutzbar.',
      analytics: 'Nutzungsstatistik (anonymisiert)',
      crash_reports: 'Fehlerprotokoll auf dem Gerät speichern',
      push: 'Push-Benachrichtigungen',
      personalization: 'Personalisierte Inhalte',
    },
    export: {
      title: 'Meine Daten',
      intro: 'Lade alle zu deinem Konto gespeicherten Daten als JSON-Datei herunter.',
      button: 'Daten exportieren',
      done: 'Export erstellt.',
    },
    deletion: {
      title: 'Konto löschen',
      intro:
        'Dein Konto wird sofort deaktiviert und nach 30 Tagen endgültig gelöscht. Bis dahin kannst du die Löschung abbrechen, indem du dich wieder anmeldest.',
      button: 'Konto löschen',
      confirm: 'Wirklich löschen? Tippe zur Bestätigung erneut.',
      confirmButton: 'Ja, Konto löschen',
      scheduled: 'Dein Konto ist zur Löschung vorgemerkt und wird am {{date}} gelöscht.',
      cancel: 'Löschung abbrechen',
      cancelled: 'Die Löschung wurde abgebrochen.',
      lastOwner:
        'Du bist einziger Eigentümer einer Organisation mit weiteren Mitgliedern. Übertrage zuerst die Eigentümerrolle.',
    },
  },
  legal: {
    privacyTitle: 'Datenschutzerklärung',
    imprintTitle: 'Impressum',
    draftNotice: 'Entwurf - vor Veröffentlichung juristisch prüfen lassen.',
    privacyBody:
      'Verantwortlich: [Name, Anschrift, E-Mail]. Wir verarbeiten nur die Daten, die für dein Konto nötig sind: E-Mail-Adresse und Anzeigename. Die Daten liegen auf Servern in der EU (Frankfurt). Freiwillige Verarbeitungen (z. B. Absturzberichte) erfolgen nur mit deiner Einwilligung, die du jederzeit in den Einstellungen widerrufen kannst. Du kannst deine Daten jederzeit exportieren und dein Konto löschen. Rechtsgrundlagen, Empfänger, Speicherdauer und deine Rechte: [ergänzen]. Fehlerprotokoll: Nur wenn du zustimmst, speichert die App ein technisches Protokoll (Fehler, App-Version, Gerätetyp, letzte Schritte in der App - ohne deine Eingaben) auf deinem Gerät, höchstens 7 Tage. Es verlässt dein Gerät nur, wenn du es selbst teilst.',
    imprintBody: 'Angaben gemäß § 5 DDG: [Name, Anschrift, Kontakt]. [ergänzen]',
  },
  monitoring: {
    title: 'Etwas ist schiefgelaufen',
    body: 'Diese Ansicht konnte nicht angezeigt werden. Bitte versuche es erneut.',
    errorId: 'Fehler-ID: {{id}} - teile bei Rückfragen das Fehlerprotokoll (Profil, Datenschutz) und nenne diese ID.',
    share: {
      title: 'Fehlerprotokoll',
      intro: 'Hilft bei der Fehlersuche: technische Schritte und Fehler, ohne deine Eingaben. Du entscheidest, an wen du es schickst.',
      button: 'Protokoll teilen',
      done: 'Protokoll erstellt.',
    },
  },
  update: {
    title: 'Update erforderlich',
    body: 'Diese Version der App wird nicht mehr unterstützt. Bitte installiere die neueste Version.',
  },
} as const;

type DeepStringify<T> = { [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]> };

export type Translations = DeepStringify<typeof de>;
