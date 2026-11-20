// Alle Aufrufe an Supabase Auth an einer Stelle. Jede Funktion wirft bei Fehler;
// die Seiten fangen den Fehler und zeigen ihn ueber getAuthErrorKey an.
import { supabase } from '@/core/supabase/client';

// signup = E-Mail nach Registrierung bestaetigen, recovery = Passwort zuruecksetzen
export type CodePurpose = 'signup' | 'recovery';

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(input: {
  displayName: string;
  email: string;
  password: string;
}): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    // landet in auth.users.raw_user_meta_data; der Trigger (0004_signup.sql) liest display_name
    options: { data: { display_name: input.displayName } },
  });
  if (error) throw error;
  // Mit E-Mail-Bestaetigung gibt es erst nach dem Code eine Sitzung.
  return { needsConfirmation: data.session === null };
}

export async function verifyCode(email: string, code: string, purpose: CodePurpose): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    // geprueft gegen das lokale Supabase: Registrierung = 'email', Passwort = 'recovery'
    type: purpose === 'signup' ? 'email' : 'recovery',
  });
  if (error) throw error;
}

export async function resendCode(email: string, purpose: CodePurpose): Promise<void> {
  if (purpose === 'signup') {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  } else {
    await requestPasswordReset(email);
  }
}

// Meldet keinen Fehler, wenn es die E-Mail nicht gibt (verhindert das Ausforschen von Konten).
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
