import type { Translations } from './de';

// Englische Texte. Fehlt ein Schluessel aus de.ts, meldet TypeScript einen Fehler.
export const en: Translations = {
  common: {
    back: 'Back',
    loading: 'Loading ...',
  },
  validation: {
    required: 'Required',
    email: 'Please enter a valid email address',
    tooLong: 'Too long',
    passwordLength: 'At least 8 characters',
    passwordLetters: 'At least one letter',
    passwordDigits: 'At least one digit',
    passwordMismatch: 'The passwords do not match',
    code: 'Please enter the 6-digit code',
  },
  auth: {
    fields: {
      displayName: 'Display name',
      email: 'Email',
      password: 'Password',
      passwordConfirm: 'Repeat password',
      newPassword: 'New password',
      code: 'Code',
    },
    passwordHint: 'At least 8 characters, letters and digits',
    signIn: {
      title: 'Sign in',
      submit: 'Sign in',
      toSignUp: 'No account yet? Sign up',
      toForgotPassword: 'Forgot password?',
      enterCode: 'Enter code',
    },
    signUp: {
      title: 'Create account',
      submit: 'Sign up',
      toSignIn: 'Already registered? Sign in',
    },
    verifyCode: {
      titleSignUp: 'Confirm your email',
      titleRecovery: 'Enter code',
      intro: 'We sent a 6-digit code to {{email}}.',
      submit: 'Confirm',
      resend: 'Send code again',
      resent: 'A new code is on its way.',
      missingEmail: 'This step has expired. Please sign in or sign up again.',
    },
    forgotPassword: {
      title: 'Forgot password',
      intro: 'Enter your email address. If an account exists, we will send you a code.',
      submit: 'Request code',
    },
    newPassword: {
      title: 'New password',
      intro: 'Choose a new password for your account.',
      submit: 'Save password',
      skip: 'Later',
    },
    errors: {
      invalid_credentials: 'Email or password is incorrect.',
      email_not_confirmed: 'Your email address is not confirmed yet.',
      user_already_exists: 'An account with this email address already exists.',
      weak_password: 'The password is too weak.',
      otp_expired: 'The code is wrong or has expired.',
      same_password: 'The new password must differ from the old one.',
      over_email_send_rate_limit: 'Too many emails requested. Please try again later.',
      over_request_rate_limit: 'Too many attempts. Please wait a moment.',
      network: 'No connection to the server.',
      unknown: 'Something went wrong. Please try again.',
    },
  },
  home: {
    greeting: 'Hello, {{name}}',
    signedInAs: 'Signed in as {{email}}',
    organization: 'Organization: {{name}}',
    signOut: 'Sign out',
    loadError: 'Profile could not be loaded.',
  },
};
