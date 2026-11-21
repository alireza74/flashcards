// Haelt die aktuelle Sitzung fuer die ganze App bereit (React Context).
//
// Ablauf:
// 1. Beim Start: gespeicherte Sitzung laden (getSession) -> isLoading bis dahin true.
// 2. Danach meldet Supabase jede Aenderung (Anmelden, Abmelden, Token erneuert)
//    ueber onAuthStateChange; wir uebernehmen die neue Sitzung.
// 3. Beim Abmelden wird der Daten-Cache geleert, damit kein Nutzer Daten des vorigen sieht.
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { addBreadcrumb, clearBreadcrumbs } from '@/core/monitoring/breadcrumbs';
import { supabase } from '@/core/supabase/client';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  // true zwischen "Passwort-Code bestaetigt" und "neues Passwort gespeichert"
  isPasswordRecovery: boolean;
  setPasswordRecovery: (value: boolean) => void;
  // E-Mail fuer die Code-Seite. Bewusst nicht als URL-Parameter, damit sie im Web
  // nicht im Browser-Verlauf landet.
  pendingEmail: string | undefined;
  setPendingEmail: (email: string | undefined) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setPasswordRecovery] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string>();

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setIsLoading(false));

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_OUT') {
        // Schritte des vorigen Nutzers nie in Berichte des naechsten uebernehmen
        clearBreadcrumbs();
      }
      addBreadcrumb('auth', event);
      if (newSession) {
        setPendingEmail(undefined);
      }
      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
        queryClient.clear();
      }
    });

    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isPasswordRecovery,
        setPasswordRecovery,
        pendingEmail,
        setPendingEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth muss innerhalb von <AuthProvider> verwendet werden');
  }
  return context;
}
