/* Log in with email + password, or ask for a reset-password email.
   There is no "create account": people are invited by the PCA owners (see README). */
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/labels';

interface Props {
  /** Message from an invite / reset link that didn't work (usually expired). */
  linkError: string | null;
}

export default function Login({ linkError }: Props) {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError ? 'El enlace del email no es válido o ha caducado. Pide uno nuevo.' : null,
  );
  const [info, setInfo] = useState<string | null>(null);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(errorMessage(err));
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      /* Back to the CRM's own address, also when it lives in a folder (GitHub Pages). */
      redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href,
    });
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    setInfo('Si el email tiene cuenta, te llegará un enlace para crear una contraseña nueva.');
  }

  return (
    <div className="center-screen">
      <div className="card narrow">
        <div className="brand big">
          <span className="brand-mark">PCA</span> CRM
        </div>

        {mode === 'login' ? (
          <form onSubmit={onLogin} className="stack">
            <h1>Entrar</h1>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn primary" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setMode('reset');
                setError(null);
              }}
            >
              ¿Has olvidado la contraseña?
            </button>
          </form>
        ) : (
          <form onSubmit={onReset} className="stack">
            <h1>Recuperar contraseña</h1>
            <p className="muted">Te enviaremos un enlace para crear una contraseña nueva.</p>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {error && <p className="error">{error}</p>}
            {info && <p className="success">{info}</p>}
            <button className="btn primary" disabled={busy || !!info}>
              {busy ? 'Enviando…' : 'Enviar enlace'}
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setMode('login');
                setError(null);
                setInfo(null);
              }}
            >
              Volver a entrar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
