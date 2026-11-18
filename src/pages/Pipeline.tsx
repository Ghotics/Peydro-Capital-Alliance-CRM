/* Pipeline board: one column per stage, in two rows so it never scrolls sideways:
   the stages still being worked on on top, the closed ones (last 30 days) below.
   Drag a card to another column to change its stage (on a phone, open the lead and change it there). */
import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { supabase } from '../lib/supabase';
import { OPEN_STAGES, STAGES, departmentLabel, errorMessage, formatDate, formatDayMonth } from '../lib/labels';
import { href } from '../lib/router';
import type { LeadRow, Stage, TeamMember } from '../lib/types';

interface Props {
  me: TeamMember;
  team: TeamMember[];
}

type Card = LeadRow & { updated_at: string };

const CLOSED_DAYS = 30;

/** Top row: Nuevo → Propuesta enviada. Bottom row: Ganado, Aún no está listo, Perdido. */
const OPEN_COLUMNS = STAGES.filter((s) => OPEN_STAGES.includes(s.value));
const CLOSED_COLUMNS = STAGES.filter((s) => !OPEN_STAGES.includes(s.value));

export default function Pipeline({ me, team }: Props) {
  const [leads, setLeads] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [department, setDepartment] = useState('');
  const [campaign, setCampaign] = useState('');
  const [owner, setOwner] = useState(me.role === 'owner' ? '' : 'me');
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('leads')
      .select(
        'id, created_at, updated_at, stage, form, area, department, first_name, last_name, email, phone, owner_id, campaign:campaigns(code, name)',
      )
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) setError(errorMessage(err));
        else setLeads((data ?? []) as unknown as Card[]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const teamName = useMemo(() => new Map(team.map((m) => [m.id, m.name])), [team]);
  const departments = useMemo(() => [...new Set((leads ?? []).map((l) => l.department ?? ''))].sort(), [leads]);
  const campaigns = useMemo(() => {
    const map = new Map<string, string>();
    (leads ?? []).forEach((l) => l.campaign && map.set(l.campaign.code, l.campaign.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [leads]);

  const since = Date.now() - CLOSED_DAYS * 86_400_000;
  const visible = (leads ?? []).filter((l) => {
    if (department && (l.department ?? '') !== department) return false;
    if (campaign && l.campaign?.code !== campaign) return false;
    if (owner === 'me' && l.owner_id !== me.id) return false;
    if (owner === 'none' && l.owner_id) return false;
    if (owner && !['me', 'none'].includes(owner) && l.owner_id !== owner) return false;
    if (!OPEN_STAGES.includes(l.stage) && new Date(l.updated_at).getTime() < since) return false;
    return true;
  });

  async function move(id: string, stage: Stage) {
    const lead = leads?.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    let reason: string | null = null;
    if (stage === 'lost' || stage === 'not_ready') {
      reason = window.prompt('Motivo (opcional):', '');
      if (reason === null) return; // cancelled
    }
    const before = leads!;
    setLeads(before.map((l) => (l.id === id ? { ...l, stage, updated_at: new Date().toISOString() } : l)));
    setError(null);
    const patch: Record<string, unknown> = { stage };
    if (reason) patch.lost_reason = reason.trim().slice(0, 300);
    const { data, error: err } = await supabase.from('leads').update(patch).eq('id', id).select('id').maybeSingle();
    if (err || !data) {
      setLeads(before);
      setError(errorMessage(err ?? { message: 'permission denied' }));
    }
  }

  const onDrop = (stage: Stage) => (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragging;
    setOver(null);
    setDragging(null);
    if (id) move(id, stage);
  };

  if (error && !leads) return <p className="error">{error}</p>;
  if (!leads) return <p className="muted">Cargando pipeline…</p>;

  const openCount = visible.filter((l) => OPEN_STAGES.includes(l.stage)).length;
  const closedCount = visible.length - openCount;

  const column = (s: (typeof STAGES)[number]) => {
    const cards = visible.filter((l) => l.stage === s.value);
    return (
      <div
        key={s.value}
        className={`board-col ${over === s.value ? 'drop-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (over !== s.value) setOver(s.value);
        }}
        onDragLeave={() => setOver((o) => (o === s.value ? null : o))}
        onDrop={onDrop(s.value)}
      >
        <div className="board-col-head">
          <span className={`badge stage-${s.value}`} title={s.label}>
            {s.label}
          </span>
          <span className="muted small">{cards.length}</span>
        </div>
        <div className="board-cards">
          {cards.map((l) => {
            const name = `${l.first_name} ${l.last_name}`;
            const dep = departmentLabel(l.department);
            const who = l.owner_id ? teamName.get(l.owner_id) ?? '—' : 'Sin asignar';
            return (
              <a
                key={l.id}
                href={href.lead(l.id)}
                className={`board-card ${dragging === l.id ? 'dragging' : ''}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', l.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDragging(l.id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
              >
                <strong className="clip" title={name}>
                  {name}
                </strong>
                <span className="small muted clamp-2" title={dep}>
                  {dep}
                </span>
                {l.campaign && (
                  <span className="small muted clip" title={l.campaign.name}>
                    {l.campaign.name}
                  </span>
                )}
                <span className="board-card-foot small">
                  <span className="clip" title={who}>
                    {who}
                  </span>
                  <span className="muted nowrap" title={formatDate(l.created_at)}>
                    {formatDayMonth(l.created_at)}
                  </span>
                </span>
              </a>
            );
          })}
          {cards.length === 0 && <div className="board-empty small muted">—</div>}
        </div>
      </div>
    );
  };

  return (
    <section className="stack">
      <div className="page-head">
        <div>
          <h1>Pipeline</h1>
          <span className="muted">Arrastra una tarjeta a otra columna para cambiar su etapa.</span>
        </div>
        <a href={href.leadNew} className="btn">
          + Nuevo lead
        </a>
      </div>

      <div className="filters filters-3">
        <select value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">Todos los departamentos</option>
          {departments.map((d) => (
            <option key={d || '-'} value={d}>
              {departmentLabel(d || null)}
            </option>
          ))}
        </select>
        <select value={campaign} onChange={(e) => setCampaign(e.target.value)}>
          <option value="">Todas las campañas</option>
          {campaigns.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <select value={owner} onChange={(e) => setOwner(e.target.value)}>
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
      </div>

      {error && <p className="error">{error}</p>}

      <div className="board-wrap">
        <div className="board-group">
          <div className="board-group-head">
            <h2>En curso</h2>
            <span className="muted small">{openCount}</span>
          </div>
          <div className="board">{OPEN_COLUMNS.map(column)}</div>
        </div>
        <div className="board-group">
          <div className="board-group-head">
            <h2>Cerrados</h2>
            <span className="muted small">
              últimos {CLOSED_DAYS} días · {closedCount}
            </span>
          </div>
          <div className="board closed">{CLOSED_COLUMNS.map(column)}</div>
        </div>
      </div>
    </section>
  );
}
