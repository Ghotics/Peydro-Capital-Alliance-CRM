/* Team (owners only): who uses the CRM, their departments, logins; and partners + buildings.
   Department changes are what the automatic assignment uses for new leads.
   Creating logins and passwords goes through the crm-actions server function. */
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { DEPARTMENTS, errorMessage, roleLabel } from '../lib/labels';
import { crmAction } from '../lib/actions';
import type { Building, Partner, TeamMember } from '../lib/types';

interface Props {
  me: TeamMember;
  team: TeamMember[];
  onChanged: () => void;
}

const AREA_KEYS = Object.keys(DEPARTMENTS);

/** One-time password box with a copy button. */
function Secret({ label, value, onClose }: { label: string; value: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="secret-box stack">
      <p>{label}</p>
      <div className="row">
        <code className="secret">{value}</code>
        <button
          type="button"
          className="btn small"
          onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}
        >
          {copied ? 'Copiada ✓' : 'Copiar'}
        </button>
        <button type="button" className="btn ghost small" onClick={onClose}>
          Hecho
        </button>
      </div>
      <p className="muted small">
        Solo se muestra ahora. Pásala por un canal privado; la persona podrá cambiarla con "¿Has olvidado la
        contraseña?" cuando el email esté activado.
      </p>
    </div>
  );
}

function MemberRow({
  member,
  email,
  isMe,
  onSaved,
}: {
  member: TeamMember;
  email: string | undefined;
  isMe: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role);
  const [areas, setAreas] = useState<string[]>(member.areas);
  const [active, setActive] = useState(member.active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState<string | null>(null);

  const changed =
    name.trim() !== member.name ||
    role !== member.role ||
    active !== member.active ||
    JSON.stringify([...areas].sort()) !== JSON.stringify([...member.areas].sort());

  async function save() {
    if (!name.trim()) {
      setError('Pon un nombre.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from('team_members')
      .update({ name: name.trim().slice(0, 60), role, areas, active })
      .eq('id', member.id);
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    setSaved(true);
    onSaved();
  }

  async function newPassword() {
    if (!window.confirm(`¿Dar a ${member.name} una contraseña temporal nueva? La actual dejará de funcionar.`)) return;
    setError(null);
    try {
      const result = await crmAction<{ tempPassword: string }>('team/password', { id: member.id });
      setPassword(result.tempPassword);
    } catch (e) {
      setError(errorMessage(e as Error));
    }
  }

  return (
    <div className={`card stack member ${active ? '' : 'inactive'}`}>
      <div className="member-head">
        <input className="member-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <span className="muted small">{email ?? ''}</span>
        {isMe && <span className="type-tag">Tú</span>}
      </div>
      <div className="row">
        <label className="field inline">
          <span>Rol</span>
          <select value={role} onChange={(e) => setRole(e.target.value as TeamMember['role'])}>
            <option value="specialist">{roleLabel('specialist')}</option>
            <option value="owner">{roleLabel('owner')}</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Activo (puede entrar y recibe leads)</span>
        </label>
      </div>
      <div className="area-picks">
        {AREA_KEYS.map((key) => (
          <label key={key} className={`area-pick ${areas.includes(key) ? 'on' : ''}`}>
            <input
              type="checkbox"
              checked={areas.includes(key)}
              onChange={(e) => setAreas(e.target.checked ? [...areas, key] : areas.filter((a) => a !== key))}
            />
            {DEPARTMENTS[key]}
          </label>
        ))}
      </div>
      {error && <p className="error small">{error}</p>}
      {password && <Secret label={`Contraseña temporal de ${member.name}:`} value={password} onClose={() => setPassword(null)} />}
      <div className="row">
        <button className="btn primary small" disabled={!changed || busy} onClick={save}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
        {saved && !changed && <span className="success small">Guardado</span>}
        {!isMe && (
          <button className="btn ghost small push-right" onClick={newPassword}>
            Nueva contraseña temporal
          </button>
        )}
      </div>
    </div>
  );
}

function AddMember({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMember['role']>('specialist');
  const [areas, setAreas] = useState<string[]>([]);
  const [invite, setInvite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Pon un nombre y un email válido.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await crmAction<{ id: string; tempPassword?: string }>('team/create', {
        name: name.trim(),
        email: email.trim(),
        role,
        areas,
        invite,
      });
      setDone(invite ? `Invitación enviada a ${email.trim()}.` : `Cuenta creada para ${name.trim()}.`);
      setPassword(result.tempPassword ?? null);
      setName('');
      setEmail('');
      setAreas([]);
      onAdded();
    } catch (err) {
      setError(errorMessage(err as Error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <h2>Añadir persona</h2>
      <div className="two-cols">
        <label className="field">
          <span>Nombre en el CRM</span>
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Email para entrar</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Rol</span>
          <select value={role} onChange={(e) => setRole(e.target.value as TeamMember['role'])}>
            <option value="specialist">{roleLabel('specialist')}</option>
            <option value="owner">{roleLabel('owner')}</option>
          </select>
        </label>
      </div>
      <div className="area-picks">
        {AREA_KEYS.map((key) => (
          <label key={key} className={`area-pick ${areas.includes(key) ? 'on' : ''}`}>
            <input
              type="checkbox"
              checked={areas.includes(key)}
              onChange={(e) => setAreas(e.target.checked ? [...areas, key] : areas.filter((a) => a !== key))}
            />
            {DEPARTMENTS[key]}
          </label>
        ))}
      </div>
      <fieldset className="field">
        <span>Cómo entra</span>
        <label className="check">
          <input type="radio" name="how" checked={!invite} onChange={() => setInvite(false)} />
          <span>Contraseña temporal (se muestra aquí una vez)</span>
        </label>
        <label className="check">
          <input type="radio" name="how" checked={invite} onChange={() => setInvite(true)} />
          <span>Invitación por email (solo cuando el email de Supabase esté configurado)</span>
        </label>
      </fieldset>
      {error && <p className="error">{error}</p>}
      {done && <p className="success">{done}</p>}
      {password && <Secret label="Contraseña temporal:" value={password} onClose={() => setPassword(null)} />}
      <div>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Creando…' : 'Añadir'}
        </button>
      </div>
    </form>
  );
}

function PartnersAndBuildings() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [buildings, setBuildings] = useState<(Building & { partner_id: string })[]>([]);
  const [newPartner, setNewPartner] = useState('');
  const [newBuilding, setNewBuilding] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    Promise.all([
      supabase.from('partners').select('id, name').order('name'),
      supabase.from('buildings').select('id, name, partner_id').order('name'),
    ]).then(([p, b]) => {
      setPartners((p.data ?? []) as Partner[]);
      setBuildings((b.data ?? []) as (Building & { partner_id: string })[]);
    });
  }, [version]);

  const run = async (job: PromiseLike<{ error: { message: string } | null }>) => {
    setError(null);
    const { error: err } = await job;
    if (err) setError(errorMessage(err));
    else setVersion((v) => v + 1);
  };

  return (
    <div className="card stack">
      <h2>Socios y edificios</h2>
      <p className="muted small">Los edificios aparecen al crear campañas y se unen a los leads que eligen ese edificio.</p>
      {partners.map((p) => (
        <div key={p.id} className="partner">
          <div className="row">
            <strong>{p.name}</strong>
            {!buildings.some((b) => b.partner_id === p.id) && (
              <button
                className="link-btn small"
                onClick={() => window.confirm(`¿Borrar "${p.name}"?`) && run(supabase.from('partners').delete().eq('id', p.id))}
              >
                Borrar
              </button>
            )}
          </div>
          <div className="row">
            {buildings
              .filter((b) => b.partner_id === p.id)
              .map((b) => (
                <span key={b.id} className="chip">
                  Edificio {b.name}
                  <button
                    className="chip-x"
                    title="Borrar edificio"
                    onClick={() =>
                      window.confirm(`¿Borrar el edificio ${b.name}?`) && run(supabase.from('buildings').delete().eq('id', b.id))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const name = (newBuilding[p.id] ?? '').trim();
                if (!name) return;
                run(supabase.from('buildings').insert({ partner_id: p.id, name: name.slice(0, 40) })).then(() =>
                  setNewBuilding({ ...newBuilding, [p.id]: '' }),
                );
              }}
            >
              <input
                className="small-input"
                placeholder="Nuevo edificio"
                value={newBuilding[p.id] ?? ''}
                onChange={(e) => setNewBuilding({ ...newBuilding, [p.id]: e.target.value })}
              />
              <button className="btn small">Añadir</button>
            </form>
          </div>
        </div>
      ))}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newPartner.trim()) return;
          run(supabase.from('partners').insert({ name: newPartner.trim().slice(0, 29) })).then(() => setNewPartner(''));
        }}
      >
        <input
          className="small-input"
          placeholder="Nuevo socio (p. ej. Renta 92)"
          maxLength={29}
          value={newPartner}
          onChange={(e) => setNewPartner(e.target.value)}
        />
        <button className="btn small">Añadir socio</button>
      </form>
      {error && <p className="error small">{error}</p>}
    </div>
  );
}

export default function Team({ me, team, onChanged }: Props) {
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [emailsError, setEmailsError] = useState(false);

  useEffect(() => {
    if (me.role !== 'owner') return;
    crmAction<{ emails: Record<string, string> }>('team/emails', {})
      .then((r) => setEmails(r.emails))
      .catch(() => setEmailsError(true));
  }, [me.role, team.length]);

  if (me.role !== 'owner') {
    return (
      <div className="card narrow stack">
        <h1>Equipo</h1>
        <p className="muted">Solo la dirección puede gestionar el equipo.</p>
      </div>
    );
  }

  const sorted = [...team].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'es'));

  return (
    <section className="stack">
      <div className="page-head">
        <div>
          <h1>Equipo</h1>
          <span className="muted">
            Los departamentos de cada persona deciden a quién se asignan los leads nuevos automáticamente.
          </span>
        </div>
      </div>
      {emailsError && (
        <p className="warning small">
          No se han podido cargar los emails ni crear cuentas: falta publicar la función "crm-actions" en Supabase.
        </p>
      )}
      <div className="detail-grid even">
        <div className="stack">
          {sorted.map((m) => (
            <MemberRow key={`${m.id}-${m.name}-${m.role}-${m.active}-${m.areas.join()}`} member={m} email={emails[m.id]} isMe={m.id === me.id} onSaved={onChanged} />
          ))}
        </div>
        <div className="stack">
          <AddMember onAdded={onChanged} />
          <PartnersAndBuildings />
        </div>
      </div>
    </section>
  );
}
