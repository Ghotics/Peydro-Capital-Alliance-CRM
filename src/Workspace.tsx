/* Everything after login: loads who you are and the team, then shows the list or one lead. */
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { errorMessage, roleLabel } from './lib/labels';
import { go, href, useRoute } from './lib/router';
import { navFor } from './nav';
import type { TeamMember } from './lib/types';
import LeadsList, { emptyFilters, type Filters } from './pages/LeadsList';
import LeadDetail from './pages/LeadDetail';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import CampaignNew from './pages/CampaignNew';

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

  /** From a campaign page: open the leads list showing only that campaign's leads. */
  const showCampaignLeads = (code: string) => {
    setFilters({ ...emptyFilters, campaign: code });
    go(href.leads);
  };

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
      <aside className="sidebar">
        <a href={href.campaigns} className="brand">
          <span className="brand-mark">PCA</span> CRM
        </a>
        <nav className="side-nav">
          {navFor(me).map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`side-link ${item.routes.includes(route.name) ? 'active' : ''}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="side-user">
          <div>
            <div className="side-user-name">{me.name}</div>
            <div className="muted small">{roleLabel(me.role)}</div>
          </div>
          <button className="btn ghost small" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="page">
        {route.name === 'lead' && <LeadDetail key={route.id} id={route.id} me={me} team={team} />}
        {route.name === 'leads' && <LeadsList me={me} team={team} filters={filters} setFilters={setFilters} />}
        {route.name === 'campaigns' && <Campaigns me={me} />}
        {route.name === 'campaign-new' && <CampaignNew me={me} />}
        {route.name === 'campaign' && (
          <CampaignDetail key={route.id} id={route.id} me={me} onShowLeads={showCampaignLeads} />
        )}
      </main>
    </div>
  );
}
