/* Decides which screen to show:
     loading -> login -> (set a password, after an invite / reset email) -> CRM
   The CRM itself only opens for people with an active row in team_members. */
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { emailLink, missingConfig, supabase } from './lib/supabase';
import { go } from './lib/router';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import Workspace from './Workspace';

export default function App() {
  /** undefined = still checking, null = logged out */
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [mustSetPassword, setMustSetPassword] = useState(
    emailLink.type === 'invite' || emailLink.type === 'recovery',
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setMustSetPassword(true);
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (missingConfig) {
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h1>Falta la configuración</h1>
          <p className="muted">
            Copia el archivo <code>.env.example</code> como <code>.env</code> y vuelve a arrancar la app.
          </p>
        </div>
      </div>
    );
  }

  if (session === undefined) return <div className="center-screen muted">Cargando…</div>;

  if (!session) return <Login linkError={emailLink.error} />;

  if (mustSetPassword) {
    return (
      <SetPassword
        invited={emailLink.type === 'invite'}
        onDone={() => {
          setMustSetPassword(false);
          go('/');
        }}
      />
    );
  }

  return <Workspace userId={session.user.id} email={session.user.email ?? ''} />;
}
