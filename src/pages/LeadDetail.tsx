/* One lead: contact details, where it came from, the pipeline fields and the notes. */
import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import {
  FORMS,
  INTERESTS,
  STAGES,
  departmentLabel,
  errorMessage,
  euros,
  formatDateTime,
  roleLabel,
  stageLabel,
} from '../lib/labels';
import { go, href } from '../lib/router';
import type { Lead, LeadEvent, Note, Stage, TeamMember } from '../lib/types';
import { notifyAssignee } from '../lib/actions';

interface Props {
  id: string;
  me: TeamMember;
  team: TeamMember[];
}

/** The fields the team can change on a lead. */
interface Editable {
  stage: Stage;
  owner_id: string;
  meeting_at: string;
  deal_value_eur: string;
  lost_reason: string;
}

const SHOW_VALUE: Stage[] = ['proposal_sent', 'won'];
const SHOW_REASON: Stage[] = ['lost', 'not_ready'];

/* <input type="datetime-local"> works with local time without a zone, e.g. "2026-11-20T10:30". */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLead(lead: Lead): Editable {
  return {
    stage: lead.stage,
    owner_id: lead.owner_id ?? '',
    meeting_at: toLocalInput(lead.meeting_at),
    deal_value_eur: lead.deal_value_eur == null ? '' : String(lead.deal_value_eur),
    lost_reason: lead.lost_reason ?? '',
  };
}

/** wa.me needs the number with country code and no "+". Spanish numbers without one get 34. */
function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const full = phone.startsWith('+') || digits.length > 9 ? digits : `34${digits}`;
  return `https://wa.me/${full}`;
}

export default function LeadDetail({ id, me, team }: Props) {
  const [lead, setLead] = useState<Lead | null | undefined>(undefined);
  const [form, setForm] = useState<Editable | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

  const isOwner = me.role === 'owner';
  const teamName = useMemo(() => new Map(team.map((m) => [m.id, m.name])), [team]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase
        .from('leads')
        .select('*, campaign:campaigns(code, name, form), building:buildings(name, partner:partners(name))')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('lead_notes').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('lead_events').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ]).then(([leadRes, notesRes, eventsRes]) => {
      if (!alive) return;
      if (leadRes.error) {
        setError(errorMessage(leadRes.error));
        return;
      }
      const row = leadRes.data as unknown as Lead | null;
      setLead(row);
      if (row) setForm(fromLead(row));
      if (notesRes.error) setError(errorMessage(notesRes.error));
      else setNotes((notesRes.data ?? []) as Note[]);
      /* The history is optional: if it can't load, the page still works. */
      if (!eventsRes.error) setEvents((eventsRes.data ?? []) as LeadEvent[]);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  /* Who the lead can be assigned to: owners, and active specialists of the lead's department. */
  const assignable = useMemo(() => {
    if (!lead) return [];
    return team.filter(
      (m) =>
        (m.active && (m.role === 'owner' || (lead.department != null && m.areas.includes(lead.department)))) ||
        m.id === lead.owner_id,
    );
  }, [team, lead]);

  if (error && lead === undefined) return <p className="error">{error}</p>;
  if (lead === undefined || (lead && !form)) return <p className="muted">Cargando…</p>;
  if (lead === null || !form) {
    return (
      <div className="card narrow stack">
        <h1>Lead no encontrado</h1>
        <p className="muted">No existe o no tienes acceso a él.</p>
        <a href={href.leads} className="btn">
          Volver a leads
        </a>
      </div>
    );
  }

  const changed = JSON.stringify(form) !== JSON.stringify(fromLead(lead));
  const setField = (patch: Partial<Editable>) => {
    setForm({ ...form, ...patch });
    setSaved(false);
  };

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!form || !lead) return;
    const value = form.deal_value_eur.trim().replace(',', '.');
    if (value && (Number.isNaN(Number(value)) || Number(value) < 0)) {
      setError('El valor debe ser un número positivo.');
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('leads')
      .update({
        stage: form.stage,
        owner_id: form.owner_id || null,
        meeting_at: form.meeting_at ? new Date(form.meeting_at).toISOString() : null,
        deal_value_eur: value ? Number(value) : null,
        lost_reason: form.lost_reason.trim() || null,
      })
      .eq('id', lead.id)
      .select('*, campaign:campaigns(code, name, form), building:buildings(name, partner:partners(name))')
      .maybeSingle();
    setSaving(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    if (!data) {
      /* Saved, but the lead is no longer yours to see (e.g. you assigned it to someone else outside your department). */
      go(href.leads);
      return;
    }
    const updated = data as unknown as Lead;
    /* Someone new is in charge: tell them by email (if emails are set up). */
    if (updated.owner_id && updated.owner_id !== lead.owner_id && updated.owner_id !== me.id) {
      notifyAssignee(updated.id);
    }
    setLead(updated);
    setForm(fromLead(updated));
    setSaved(true);
    const { data: fresh } = await supabase
      .from('lead_events')
      .select('*')
      .eq('lead_id', updated.id)
      .order('created_at', { ascending: false });
    if (fresh) setEvents(fresh as LeadEvent[]);
  }

  /** One history line in words. */
  function eventText(ev: LeadEvent): string {
    const person = (id: string | null) => (id ? teamName.get(id) ?? 'otra persona' : 'nadie');
    switch (ev.kind) {
      case 'created':
        return ev.detail === 'web'
          ? `Llegó desde la web${ev.to_value ? ` y se asignó a ${person(ev.to_value)}` : ' (sin asignar)'}`
          : `Creado en el CRM${ev.to_value ? `, responsable: ${person(ev.to_value)}` : ''}`;
      case 'stage':
        return `Etapa: ${ev.from_value ? stageLabel(ev.from_value as Stage) : '—'} → ${stageLabel(ev.to_value as Stage)}`;
      case 'owner':
        return `Responsable: ${person(ev.from_value)} → ${person(ev.to_value)}`;
      case 'meeting':
        return ev.to_value ? `Reunión: ${formatDateTime(ev.to_value)}` : 'Reunión quitada';
      case 'booking':
        return ev.detail ?? 'Cal.com';
      default:
        return ev.kind;
    }
  }

  async function onAddNote(e: FormEvent) {
    e.preventDefault();
    const body = noteText.trim();
    if (!body) return;
    setNoteBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('lead_notes')
      .insert({ lead_id: id, author_id: me.id, body })
      .select('*')
      .single();
    setNoteBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    setNotes([data as Note, ...notes]);
    setNoteText('');
  }

  async function onDeleteNote(note: Note) {
    if (!window.confirm('¿Borrar esta nota?')) return;
    const { error: err } = await supabase.from('lead_notes').delete().eq('id', note.id);
    if (err) setError(errorMessage(err));
    else setNotes(notes.filter((n) => n.id !== note.id));
  }

  async function onDeleteLead() {
    if (!lead) return;
    if (!window.confirm(`¿Eliminar el lead de ${lead.first_name} ${lead.last_name}? No se puede deshacer.`)) return;
    const { error: err } = await supabase.from('leads').delete().eq('id', lead.id);
    if (err) setError(errorMessage(err));
    else go(href.leads);
  }

  const utm = Object.entries(lead.utm ?? {});

  return (
    <section className="stack">
      <a href={href.leads} className="back">
        ← Volver a leads
      </a>

      <div className="page-head">
        <div>
          <h1>
            {lead.first_name} {lead.last_name}
          </h1>
          <span className="muted">
            {departmentLabel(lead.department)} · recibido {formatDateTime(lead.created_at)}
          </span>
        </div>
        <div className="contact-actions">
          <a className="btn small" href={`mailto:${lead.email}`}>
            Email
          </a>
          <a className="btn small" href={`tel:${lead.phone}`}>
            Llamar
          </a>
          <a className="btn small" href={whatsappHref(lead.phone)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="detail-grid">
        <div className="stack">
          <form className="card stack" onSubmit={onSave}>
            <h2>Seguimiento</h2>
            <div className="two-cols">
              <label className="field">
                <span>Etapa</span>
                <select value={form.stage} onChange={(e) => setField({ stage: e.target.value as Stage })}>
                  {STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Responsable</span>
                <select value={form.owner_id} onChange={(e) => setField({ owner_id: e.target.value })}>
                  <option value="">Sin asignar</option>
                  {assignable.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.role === 'owner' ? ` · ${roleLabel(m.role)}` : ''}
                      {m.active ? '' : ' · inactivo'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Reunión</span>
                <input
                  type="datetime-local"
                  value={form.meeting_at}
                  onChange={(e) => setField({ meeting_at: e.target.value })}
                />
              </label>
              {(SHOW_VALUE.includes(form.stage) || form.deal_value_eur) && (
                <label className="field">
                  <span>Valor (€)</span>
                  <input
                    inputMode="decimal"
                    value={form.deal_value_eur}
                    onChange={(e) => setField({ deal_value_eur: e.target.value })}
                    placeholder="0"
                  />
                </label>
              )}
            </div>
            {(SHOW_REASON.includes(form.stage) || form.lost_reason) && (
              <label className="field">
                <span>Motivo</span>
                <input
                  value={form.lost_reason}
                  onChange={(e) => setField({ lost_reason: e.target.value })}
                  placeholder="Por qué no sigue adelante"
                  maxLength={300}
                />
              </label>
            )}
            <div className="row">
              <button className="btn primary" disabled={!changed || saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              {saved && !changed && <span className="success">Guardado</span>}
            </div>
          </form>

          <div className="card stack">
            <h2>Notas</h2>
            <form onSubmit={onAddNote} className="stack">
              <textarea
                rows={3}
                maxLength={4000}
                placeholder="Llamada, email, lo que se habló…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <div>
                <button className="btn" disabled={noteBusy || !noteText.trim()}>
                  {noteBusy ? 'Guardando…' : 'Añadir nota'}
                </button>
              </div>
            </form>
            {notes.length === 0 ? (
              <p className="muted small">Todavía no hay notas.</p>
            ) : (
              <ul className="notes">
                {notes.map((n) => (
                  <li key={n.id}>
                    <div className="note-head">
                      <strong>{teamName.get(n.author_id) ?? '—'}</strong>
                      <span className="muted small">{formatDateTime(n.created_at)}</span>
                      {(n.author_id === me.id || isOwner) && (
                        <button className="link-btn small" onClick={() => onDeleteNote(n)}>
                          Borrar
                        </button>
                      )}
                    </div>
                    <p className="note-body">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {events.length > 0 && (
            <div className="card stack">
              <h2>Historial</h2>
              <ul className="timeline">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <span>{eventText(ev)}</span>
                    <span className="muted small">
                      {formatDateTime(ev.created_at)} · {ev.actor_id ? teamName.get(ev.actor_id) ?? '—' : 'Automático'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card stack">
            <h2>Contacto</h2>
            <dl className="facts">
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${lead.email}`}>{lead.email}</a>
              </dd>
              <dt>Teléfono</dt>
              <dd>
                <a href={`tel:${lead.phone}`}>{lead.phone}</a>
              </dd>
              {lead.unit && (
                <>
                  <dt>Oficina / unidad</dt>
                  <dd>{lead.unit}</dd>
                </>
              )}
            </dl>
            {lead.message && (
              <>
                <h3>Mensaje</h3>
                <p className="message">{lead.message}</p>
              </>
            )}
          </div>

          <div className="card stack">
            <h2>Origen</h2>
            <dl className="facts">
              <dt>Formulario</dt>
              <dd>{FORMS[lead.form] ?? lead.form}</dd>
              <dt>Departamento</dt>
              <dd>{departmentLabel(lead.department)}</dd>
              <dt>Campaña</dt>
              <dd>
                {lead.campaign ? (
                  <>
                    {lead.campaign.name} <span className="muted">({lead.campaign.code})</span>
                  </>
                ) : (
                  '—'
                )}
              </dd>
              {lead.building && (
                <>
                  <dt>Edificio</dt>
                  <dd>
                    {lead.building.partner?.name ? `${lead.building.partner.name} · ` : ''}
                    {lead.building.name}
                  </dd>
                </>
              )}
              {lead.interests.length > 0 && (
                <>
                  <dt>Intereses</dt>
                  <dd>{lead.interests.map((i) => INTERESTS[i] ?? i).join(', ')}</dd>
                </>
              )}
              {lead.page && (
                <>
                  <dt>Página</dt>
                  <dd className="break">{lead.page}</dd>
                </>
              )}
              {utm.map(([k, v]) => (
                <Fragment key={k}>
                  <dt>{k}</dt>
                  <dd className="break">{v}</dd>
                </Fragment>
              ))}
              <dt>Privacidad aceptada</dt>
              <dd>{formatDateTime(lead.privacy_accepted_at)}</dd>
              <dt>Última modificación</dt>
              <dd>{formatDateTime(lead.updated_at)}</dd>
              {lead.deal_value_eur != null && (
                <>
                  <dt>Valor</dt>
                  <dd>{euros.format(lead.deal_value_eur)}</dd>
                </>
              )}
            </dl>
          </div>

          {isOwner && (
            <div>
              <button className="btn danger small" onClick={onDeleteLead}>
                Eliminar lead
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
