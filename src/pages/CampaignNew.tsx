/* Create a campaign (owners only). The code becomes part of the QR / link and can't change later. */
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { FORM_HELP, FORM_SHORT, errorMessage } from '../lib/labels';
import { go, href } from '../lib/router';
import { CODE_PATTERN, campaignUrl, slugify } from '../lib/site';
import type { Building, FormKind, TeamMember } from '../lib/types';
import { buildingLabel } from './Campaigns';

interface Props {
  me: TeamMember;
  /** Type already picked when coming from a campaigns tab. */
  initialForm?: FormKind;
}

const TYPES: FormKind[] = ['business_office', 'quick', 'giza'];

export default function CampaignNew({ me, initialForm }: Props) {
  const [name, setName] = useState('');
  const [form, setForm] = useState<FormKind>(initialForm ?? 'business_office');
  /** Back / cancel return to the tab you came from. */
  const back = initialForm ? href.campaignTab(initialForm) : href.campaigns;
  const [buildingId, setBuildingId] = useState('');
  const [code, setCode] = useState('');
  /** Once the person edits the code by hand, stop filling it in from the name. */
  const [codeTouched, setCodeTouched] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('buildings')
      .select('id, name, partner:partners(name)')
      .order('name')
      .then(({ data }) => setBuildings((data ?? []) as unknown as Building[]));
  }, []);

  if (me.role !== 'owner') {
    return (
      <div className="card narrow stack">
        <h1>Nueva campaña</h1>
        <p className="muted">Solo la dirección puede crear campañas.</p>
        <a href={back} className="btn">
          Volver a campañas
        </a>
      </div>
    );
  }

  const finalCode = codeTouched ? code : slugify(name);
  const codeOk = CODE_PATTERN.test(finalCode);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Ponle un nombre a la campaña.');
      return;
    }
    if (!codeOk) {
      setError('El código solo puede tener letras minúsculas sin acentos, números, - y _ (máximo 40).');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('campaigns')
      .insert({
        name: name.trim(),
        form,
        code: finalCode,
        building_id: form === 'business_office' && buildingId ? buildingId : null,
      })
      .select('id')
      .single();
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    go(href.campaign((data as { id: string }).id));
  }

  return (
    <section className="stack">
      <a href={back} className="back">
        ← Volver a campañas
      </a>
      <h1>Nueva campaña</h1>

      <form className="card stack form-narrow" onSubmit={onSubmit}>
        <label className="field">
          <span>Nombre</span>
          <input
            value={name}
            maxLength={120}
            placeholder="Ej.: Renta 92 · Edificio 14 · Portal"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>

        <fieldset className="field">
          <span>Tipo</span>
          <div className="type-options">
            {TYPES.map((t) => (
              <label key={t} className={`type-option ${form === t ? 'selected' : ''}`}>
                <input type="radio" name="form" value={t} checked={form === t} onChange={() => setForm(t)} />
                <strong>{FORM_SHORT[t]}</strong>
                <span className="muted small">{FORM_HELP[t]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {form === 'business_office' && (
          <label className="field">
            <span>Edificio</span>
            <select value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
              <option value="">Sin edificio</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {buildingLabel({ building: b })}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>Código (va en el QR / enlace, no se podrá cambiar)</span>
          <input
            value={finalCode}
            maxLength={40}
            placeholder="se rellena con el nombre"
            onChange={(e) => {
              setCodeTouched(true);
              setCode(e.target.value.toLowerCase());
            }}
          />
          {finalCode && !codeOk && (
            <span className="error small">Solo letras minúsculas sin acentos, números, - y _</span>
          )}
        </label>

        {finalCode && codeOk && (
          <div className="preview small">
            <span className="muted">El QR abrirá: </span>
            <span className="break">{campaignUrl({ code: finalCode, form })}</span>
          </div>
        )}

        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn primary" disabled={busy}>
            {busy ? 'Creando…' : 'Crear campaña'}
          </button>
          <a href={back} className="btn ghost">
            Cancelar
          </a>
        </div>
      </form>
    </section>
  );
}
