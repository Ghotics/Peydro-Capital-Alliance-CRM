/* Type in a lead that didn't come through the website (a phone call, someone at the office…).
   Leave "Responsable" on automatic and it goes to the department's person, like website leads. */
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { LEAD_KINDS, departmentLabel, errorMessage } from '../lib/labels';
import { go, href } from '../lib/router';
import { notifyAssignee } from '../lib/actions';
import type { TeamMember } from '../lib/types';

interface Props {
  me: TeamMember;
  team: TeamMember[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9]{9,15}$/;

export default function LeadNew({ me, team }: Props) {
  const isOwner = me.role === 'owner';
  /* Specialists add leads for their own departments. */
  const kinds = isOwner ? LEAD_KINDS : LEAD_KINDS.filter((k) => me.areas.includes(k.department));

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState(kinds[0]?.department ?? '');
  const [campaignId, setCampaignId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('campaigns')
      .select('id, name')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setCampaigns((data ?? []) as { id: string; name: string }[]));
  }, []);

  if (kinds.length === 0) {
    return (
      <div className="card narrow stack">
        <h1>Nuevo lead</h1>
        <p className="muted">No tienes ningún departamento asignado. Pide a la dirección que te lo asigne.</p>
        <a href={href.leads} className="btn">
          Volver a leads
        </a>
      </div>
    );
  }

  const assignable = team.filter(
    (m) => m.active && (m.role === 'owner' || m.areas.includes(department)),
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanPhone = phone.replace(/[\s().-]/g, '');
    const problems: string[] = [];
    if (!firstName.trim()) problems.push('nombre');
    if (!lastName.trim()) problems.push('apellidos');
    if (!EMAIL.test(email.trim())) problems.push('email');
    if (!PHONE.test(cleanPhone)) problems.push('teléfono (9 a 15 cifras, con + opcional)');
    if (!consent) problems.push('consentimiento de privacidad');
    if (problems.length) {
      setError(`Revisa: ${problems.join(', ')}.`);
      return;
    }
    const kind = LEAD_KINDS.find((k) => k.department === department)!;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('leads')
      .insert({
        form: kind.form,
        area: kind.area,
        first_name: firstName.trim().slice(0, 80),
        last_name: lastName.trim().slice(0, 120),
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        message: message.trim().slice(0, 2000) || null,
        campaign_id: campaignId || null,
        owner_id: ownerId || null, // empty: the database picks the department's person
        privacy_accepted_at: new Date().toISOString(),
        utm: { origen: 'crm' },
      })
      .select('id, owner_id')
      .single();
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    const saved = data as { id: string; owner_id: string | null };
    if (saved.owner_id && saved.owner_id !== me.id) notifyAssignee(saved.id);
    go(href.lead(saved.id));
  }

  return (
    <section className="stack">
      <a href={href.leads} className="back">
        ← Volver a leads
      </a>
      <h1>Nuevo lead</h1>
      <p className="muted">Para contactos que llegan por teléfono, en persona o por otro canal.</p>

      <form className="card stack form-narrow" onSubmit={onSubmit}>
        <div className="two-cols">
          <label className="field">
            <span>Nombre</span>
            <input value={firstName} maxLength={80} onChange={(e) => setFirstName(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Apellidos</span>
            <input value={lastName} maxLength={120} onChange={(e) => setLastName(e.target.value)} />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} maxLength={160} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Teléfono</span>
            <input type="tel" value={phone} placeholder="+34 600 000 000" onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="field">
            <span>Departamento</span>
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setOwnerId('');
              }}
            >
              {kinds.map((k) => (
                <option key={k.department} value={k.department}>
                  {departmentLabel(k.department)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Responsable</span>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Automático (según el departamento)</option>
              {assignable.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Campaña (opcional)</span>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Sin campaña</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Mensaje o notas (opcional)</span>
          <textarea rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>La persona ha aceptado que PCA guarde sus datos para contactarla (política de privacidad).</span>
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Crear lead'}
          </button>
          <a href={href.leads} className="btn ghost">
            Cancelar
          </a>
        </div>
      </form>
    </section>
  );
}
