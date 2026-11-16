/* Shown after clicking the link in an invite or reset-password email. */
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/labels';

interface Props {
  invited: boolean;
  onDone: () => void;
}

const MIN_LENGTH = 8;

export default function SetPassword({ invited, onDone }: Props) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== repeat) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    onDone();
  }

  return (
    <div className="center-screen">
      <div className="card narrow">
        <div className="brand big">
          <span className="brand-mark">PCA</span> CRM
        </div>
        <form onSubmit={onSubmit} className="stack">
          <h1>{invited ? 'Crea tu contraseña' : 'Nueva contraseña'}</h1>
          {invited && <p className="muted">Bienvenido/a. Elige la contraseña con la que entrarás al CRM.</p>}
          <label className="field">
            <span>Contraseña (mínimo {MIN_LENGTH} caracteres)</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Repite la contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
