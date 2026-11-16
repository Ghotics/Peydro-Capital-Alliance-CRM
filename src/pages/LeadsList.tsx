/* The leads list. The database only sends the leads this person may see,
   so the filters below only narrow that down further. */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { STAGES, departmentLabel, errorMessage, formatDateTime, normalize, stageLabel } from '../lib/labels';
import { leadHref } from '../lib/router';
import type { LeadRow, Stage, TeamMember } from '../lib/types';

export interface Filters {
  search: string;
  stage: Stage | '';
  department: string;
  campaign: string;
  /** '' = everyone, 'me', 'none' (no one assigned) or a team member id */
  owner: string;
}

export const emptyFilters: Filters = { search: '', stage: '', department: '', campaign: '', owner: '' };

/** The list loads at most this many leads (newest first). Enough for a long time; raise it if needed. */
const LIMIT = 1000;

interface Props {
  me: TeamMember;
  team: TeamMember[];
  filters: Filters;
  setFilters: (f: Filters) => void;
}

export default function LeadsList({ me, team, filters, setFilters }: Props) {
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('leads')
      .select(
        'id, created_at, stage, form, area, department, first_name, last_name, email, phone, owner_id, campaign:campaigns(code, name)',
      )
      .order('created_at', { ascending: false })
      .limit(LIMIT)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) setError(errorMessage(err));
        else setLeads((data ?? []) as unknown as LeadRow[]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const teamName = useMemo(() => new Map(team.map((m) => [m.id, m.name])), [team]);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  /* Options come from the leads this person can see, so nobody sees departments or campaigns that aren't theirs. */
  const departments = useMemo(
    () => [...new Set((leads ?? []).map((l) => l.department ?? ''))].sort((a, b) =>
      departmentLabel(a || null).localeCompare(departmentLabel(b || null), 'es'),
    ),
    [leads],
  );
  const campaigns = useMemo(() => {
    const map = new Map<string, string>();
    (leads ?? []).forEach((l) => l.campaign && map.set(l.campaign.code, l.campaign.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [leads]);

  /* Every filter except the stage: used for the stage counters. */
  const beforeStage = useMemo(() => {
    const words = normalize(filters.search.trim()).split(/\s+/).filter(Boolean);
    return (leads ?? []).filter((l) => {
      if (filters.department && (l.department ?? '') !== (filters.department === '-' ? '' : filters.department))
        return false;
      if (filters.campaign === '-' && l.campaign) return false;
      if (filters.campaign && filters.campaign !== '-' && l.campaign?.code !== filters.campaign) return false;
      if (filters.owner === 'me' && l.owner_id !== me.id) return false;
      if (filters.owner === 'none' && l.owner_id) return false;
      if (filters.owner && !['me', 'none'].includes(filters.owner) && l.owner_id !== filters.owner) return false;
      if (words.length) {
        const haystack = normalize(`${l.first_name} ${l.last_name} ${l.email} ${l.phone}`);
        if (!words.every((w) => haystack.includes(w))) return false;
      }
      return true;
    });
  }, [leads, filters, me.id]);

  const visible = filters.stage ? beforeStage.filter((l) => l.stage === filters.stage) : beforeStage;
  const countByStage = useMemo(() => {
    const counts = new Map<Stage, number>();
    beforeStage.forEach((l) => counts.set(l.stage, (counts.get(l.stage) ?? 0) + 1));
    return counts;
  }, [beforeStage]);

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(emptyFilters);

  if (error) return <p className="error">{error}</p>;
  if (!leads) return <p className="muted">Cargando leads…</p>;

  return (
    <section className="stack">
      <div className="page-head">
        <h1>Leads</h1>
        <span className="muted">
          {visible.length} de {leads.length}
        </span>
      </div>

      <div className="stage-chips">
        <button className={`chip ${filters.stage === '' ? 'active' : ''}`} onClick={() => set({ stage: '' })}>
          Todos <span className="chip-count">{beforeStage.length}</span>
        </button>
        {STAGES.map((s) => (
          <button
            key={s.value}
            className={`chip stage-${s.value} ${filters.stage === s.value ? 'active' : ''}`}
            onClick={() => set({ stage: filters.stage === s.value ? '' : s.value })}
          >
            {s.label} <span className="chip-count">{countByStage.get(s.value) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Buscar nombre, email o teléfono"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
        />
        <select value={filters.department} onChange={(e) => set({ department: e.target.value })}>
          <option value="">Todos los departamentos</option>
          {departments.map((d) => (
            <option key={d || '-'} value={d || '-'}>
              {departmentLabel(d || null)}
            </option>
          ))}
        </select>
        <select value={filters.campaign} onChange={(e) => set({ campaign: e.target.value })}>
          <option value="">Todas las campañas</option>
          <option value="-">Sin campaña</option>
          {campaigns.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <select value={filters.owner} onChange={(e) => set({ owner: e.target.value })}>
          <option value="">Todos los responsables</option>
          <option value="me">Asignados a mí</option>
          <option value="none">Sin asignar</option>
          {team
            .filter((m) => m.active && m.id !== me.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
        {hasFilters && (
          <button className="btn ghost small" onClick={() => setFilters(emptyFilters)}>
            Quitar filtros
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="card empty">
          {leads.length === 0 ? 'Todavía no hay leads.' : 'Ningún lead coincide con estos filtros.'}
        </div>
      ) : (
        <div className="table-wrap card">
          <table className="leads">
            <thead>
              <tr>
                <th>Recibido</th>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Departamento</th>
                <th>Campaña</th>
                <th>Etapa</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id}>
                  <td className="nowrap muted">{formatDateTime(l.created_at)}</td>
                  <td>
                    <a href={leadHref(l.id)} className="lead-link">
                      {l.first_name} {l.last_name}
                    </a>
                  </td>
                  <td className="small">
                    <div>{l.email}</div>
                    <div className="muted">{l.phone}</div>
                  </td>
                  <td>{departmentLabel(l.department)}</td>
                  <td>{l.campaign?.name ?? <span className="muted">—</span>}</td>
                  <td>
                    <span className={`badge stage-${l.stage}`}>{stageLabel(l.stage)}</span>
                  </td>
                  <td>
                    {l.owner_id ? teamName.get(l.owner_id) ?? '—' : <span className="muted">Sin asignar</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {leads.length === LIMIT && (
        <p className="muted small">Se muestran los {LIMIT} leads más recientes.</p>
      )}
    </section>
  );
}
