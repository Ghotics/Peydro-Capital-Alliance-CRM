/* Everything after login: loads who you are and the team, then shows the list or one lead. */
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { errorMessage, roleLabel } from './lib/labels';
import { useRoute } from './lib/router';
import type { TeamMember } from './lib/types';
import LeadsList, { emptyFilters, type Filters } from './pages/LeadsList';
import LeadDetail from './pages/LeadDetail';

interface Props {
  userId: string;
  email: string;
}

export default function Workspace({ userId, email }: Props) {
  const route = useRoute();
  /** undefined = loading, null = no access */
  const [me, setMe] = useState<TeamMember | null | undefined>(undefined);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  /* Kept here so the filters stay the same when you open a lead and come back. */
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  useEffect(() => {
    let alive = true;
    supabase
      .from('team_members')
      .select('id, name, role, areas, active, cal_link')
      .order('name')
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) {
          setError(errorMessage(err));
          return;
        }
        const list = (data ?? []) as TeamMember[];
        setTeam(list);
        setMe(list.find((m) => m.id === userId && m.active) ?? null);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const signOut = () => supabase.auth.signOut();

  if (error) {
    return (
      <div className="center-screen">
        <div className="card narrow">
          <p className="error">{error}</p>
          <button className="btn" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (me === undefined) return <div className="center-screen muted">Cargando…</div>;

  if (me === null) {
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h1>Sin acceso</h1>
          <p className="muted">
            La cuenta <strong>{email}</strong> todavía no tiene acceso al CRM. Pide a la dirección de PCA que te dé
            de alta.
          </p>
          <button className="btn" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand">
          <span className="brand-mark">PCA</span> CRM
        </a>
        <div className="topbar-user">
          <span>
            {me.name} <span className="muted">· {roleLabel(me.role)}</span>
          </span>
          <button className="btn ghost small" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="page">
        {route.name === 'lead' ? (
          <LeadDetail key={route.id} id={route.id} me={me} team={team} />
        ) : (
          <LeadsList me={me} team={team} filters={filters} setFilters={setFilters} />
        )}
      </main>
    </div>
  );
}
