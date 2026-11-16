/* One campaign: its QR code (download / copy link), its results, and (owners) edit it. */
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { FORM_SHORT, STAGES, errorMessage, euros, formatDate } from '../lib/labels';
import { go, href } from '../lib/router';
import { qrPng, qrSvg, download } from '../lib/qr';
import { WEBSITE_URL, campaignUrl } from '../lib/site';
import type { Building, Campaign, Stage, TeamMember } from '../lib/types';
import { CAMPAIGN_SELECT, addToStats, buildingLabel, conversion, emptyStats, type ScanRow } from './Campaigns';

interface Props {
  id: string;
  me: TeamMember;
  onShowLeads: (code: string) => void;
}

interface Editable {
  name: string;
  building_id: string;
  active: boolean;
}

const fromCampaign = (c: Campaign): Editable => ({ name: c.name, building_id: c.building_id ?? '', active: c.active });

export default function CampaignDetail({ id, me, onShowLeads }: Props) {
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [leads, setLeads] = useState<{ stage: Stage; deal_value_eur: number | null }[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [scans, setScans] = useState<ScanRow | null>(null);
  const [png, setPng] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [form, setForm] = useState<Editable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOwner = me.role === 'owner';

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.from('campaigns').select(CAMPAIGN_SELECT).eq('id', id).maybeSingle(),
      supabase.from('leads').select('stage, deal_value_eur').eq('campaign_id', id),
      supabase.from('buildings').select('id, name, partner:partners(name)').order('name'),
      supabase.from('campaign_scan_stats').select('campaign_id, total, last_7_days').eq('campaign_id', id).maybeSingle(),
    ]).then(([c, l, b, s]) => {
      if (!alive) return;
      const err = c.error ?? l.error ?? b.error ?? s.error;
      if (err) {
        setError(errorMessage(err));
        return;
      }
      const row = c.data as unknown as Campaign | null;
      setCampaign(row);
      if (row) setForm(fromCampaign(row));
      setLeads((l.data ?? []) as typeof leads);
      setBuildings((b.data ?? []) as unknown as Building[]);
      setScans((s.data as ScanRow | null) ?? null);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const url = campaign ? campaignUrl(campaign) : null;

  useEffect(() => {
    if (!url) return;
    let alive = true;
    Promise.all([qrPng(url), qrSvg(url)])
      .then(([p, s]) => {
        if (!alive) return;
        setPng(p);
        setSvg(s);
      })
      .catch(() => alive && setError('No se ha podido crear el código QR.'));
    return () => {
      alive = false;
    };
  }, [url]);

  if (error && campaign === undefined) return <p className="error">{error}</p>;
  if (campaign === undefined) return <p className="muted">Cargando…</p>;
  if (campaign === null || !form || !url) {
    return (
      <div className="card narrow stack">
        <h1>Campaña no encontrada</h1>
        <a href={href.campaigns} className="btn">
          Volver a campañas
        </a>
      </div>
    );
  }

  const stats = emptyStats();
  const byStage = new Map<Stage, number>();
  leads.forEach((l) => {
    addToStats(stats, l.stage, l.deal_value_eur);
    byStage.set(l.stage, (byStage.get(l.stage) ?? 0) + 1);
  });
  const changed = JSON.stringify(form) !== JSON.stringify(fromCampaign(campaign));
  const provisional = /github\.io/.test(WEBSITE_URL);
  const edit = (patch: Partial<Editable>) => {
    setForm({ ...form, ...patch });
    setSaved(false);
  };

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url!);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se ha podido copiar. Selecciona el enlace y cópialo a mano.');
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!form || !campaign) return;
    if (!form.name.trim()) {
      setError('La campaña necesita un nombre.');
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('campaigns')
      .update({ name: form.name.trim(), building_id: form.building_id || null, active: form.active })
      .eq('id', campaign.id)
      .select(CAMPAIGN_SELECT)
      .maybeSingle();
    setSaving(false);
    if (err || !data) {
      setError(errorMessage(err ?? { message: 'permission denied' }));
      return;
    }
    const updated = data as unknown as Campaign;
    setCampaign(updated);
    setForm(fromCampaign(updated));
    setSaved(true);
  }

  async function onDelete() {
    if (!campaign) return;
    if (!window.confirm(`¿Borrar la campaña "${campaign.name}"? Su QR dejará de estar unido a nada.`)) return;
    const { error: err } = await supabase.from('campaigns').delete().eq('id', campaign.id);
    if (err) setError(errorMessage(err));
    else go(href.campaigns);
  }

  return (
    <section className="stack">
      <a href={href.campaigns} className="back">
        ← Volver a campañas
      </a>

      <div className="page-head">
        <div>
          <div className="row">
            <span className={`type-tag type-${campaign.form}`}>{FORM_SHORT[campaign.form]}</span>
            {!campaign.active && <span className="type-tag off">Desactivada</span>}
          </div>
          <h1>{campaign.name}</h1>
          <span className="muted">
            {buildingLabel(campaign) ?? 'Sin edificio'} · código <code>{campaign.code}</code> · creada{' '}
            {formatDate(campaign.created_at)}
          </span>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="detail-grid even">
        <div className="card stack qr-card">
          <h2>Código QR</h2>
          <div className="qr-box">{png ? <img src={png} alt={`Código QR de ${campaign.name}`} /> : <span className="muted">Creando…</span>}</div>
          <div className="qr-url">
            <a href={url} target="_blank" rel="noreferrer" className="break">
              {url}
            </a>
          </div>
          <div className="row">
            <button className="btn primary small" disabled={!png} onClick={() => png && download(`qr-${campaign.code}.png`, png)}>
              Descargar PNG
            </button>
            <button
              className="btn small"
              disabled={!svg}
              onClick={() => svg && download(`qr-${campaign.code}.svg`, new Blob([svg], { type: 'image/svg+xml' }))}
            >
              Descargar SVG
            </button>
            <button className="btn small" onClick={copyLink}>
              {copied ? 'Copiado ✓' : 'Copiar enlace'}
            </button>
          </div>
          <p className="muted small">
            PNG para compartir o imprimir en pequeño. SVG para la imprenta (no pierde calidad a ningún tamaño).
          </p>
          {provisional && (
            <p className="warning small">
              La web todavía está en una dirección provisional (github.io). Espera al dominio definitivo antes de imprimir
              este QR: cuando cambie la dirección, habrá que descargarlo de nuevo.
            </p>
          )}
        </div>

        <div className="stack">
          <div className="card stack">
            <div className="row space-between">
              <h2>Resultados</h2>
              <button className="btn small" onClick={() => onShowLeads(campaign.code)} disabled={stats.total === 0}>
                Ver sus leads
              </button>
            </div>
            <div className="kpis small-kpis">
              {isOwner && (
                <div className="kpi">
                  <span className="kpi-value">{scans?.total ?? 0}</span>
                  <span className="kpi-label">Escaneos · {scans?.last_7_days ?? 0} esta semana</span>
                </div>
              )}
              <div className="kpi">
                <span className="kpi-value">{stats.total}</span>
                <span className="kpi-label">Leads</span>
              </div>
              {isOwner && (
                <div className="kpi">
                  <span className="kpi-value">{conversion(stats.total, scans?.total ?? 0)}</span>
                  <span className="kpi-label">Conversión</span>
                </div>
              )}
              <div className="kpi">
                <span className="kpi-value">{stats.open}</span>
                <span className="kpi-label">En curso</span>
              </div>
              <div className="kpi">
                <span className="kpi-value">{stats.won}</span>
                <span className="kpi-label">Ganados</span>
              </div>
              <div className="kpi">
                <span className="kpi-value">{euros.format(stats.wonValue)}</span>
                <span className="kpi-label">Valor ganado</span>
              </div>
            </div>
            {stats.total > 0 && (
              <ul className="stage-bars">
                {STAGES.filter((s) => byStage.get(s.value)).map((s) => (
                  <li key={s.value}>
                    <span className={`badge stage-${s.value}`}>{s.label}</span>
                    <span className="bar">
                      <span style={{ width: `${((byStage.get(s.value) ?? 0) / stats.total) * 100}%` }} />
                    </span>
                    <strong>{byStage.get(s.value)}</strong>
                  </li>
                ))}
              </ul>
            )}
            {!isOwner && <p className="muted small">Solo cuentan los leads que tú puedes ver.</p>}
          </div>

          {isOwner && (
            <form className="card stack" onSubmit={onSave}>
              <h2>Editar</h2>
              <label className="field">
                <span>Nombre</span>
                <input value={form.name} maxLength={120} onChange={(e) => edit({ name: e.target.value })} />
              </label>
              <label className="field">
                <span>Edificio</span>
                <select value={form.building_id} onChange={(e) => edit({ building_id: e.target.value })}>
                  <option value="">Sin edificio</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {buildingLabel({ building: b })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => edit({ active: e.target.checked })}
                />
                <span>Activa</span>
              </label>
              <p className="muted small">
                El código (<code>{campaign.code}</code>) no se puede cambiar, porque ya puede estar impreso en un QR.
              </p>
              <div className="row">
                <button className="btn primary" disabled={!changed || saving}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                {saved && !changed && <span className="success">Guardado</span>}
                {stats.total === 0 && (
                  <button type="button" className="btn danger small push-right" onClick={onDelete}>
                    Borrar campaña
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
