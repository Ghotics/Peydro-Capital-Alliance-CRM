/* Landing page: every campaign (QR code or link) with how many leads it brought in. */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FORM_SHORT, errorMessage, euros } from '../lib/labels';
import { href } from '../lib/router';
import type { Campaign, Stage, TeamMember } from '../lib/types';

interface Props {
  me: TeamMember;
}

export const CAMPAIGN_SELECT =
  'id, code, form, name, active, created_at, building_id, building:buildings(id, name, partner:partners(name))';

const OPEN: Stage[] = ['new', 'contacted', 'qualified', 'meeting_booked', 'proposal_sent'];

export interface CampaignStats {
  total: number;
  open: number;
  won: number;
  wonValue: number;
}

export function emptyStats(): CampaignStats {
  return { total: 0, open: 0, won: 0, wonValue: 0 };
}

export function addToStats(s: CampaignStats, stage: Stage, value: number | null): void {
  s.total += 1;
  if (OPEN.includes(stage)) s.open += 1;
  if (stage === 'won') {
    s.won += 1;
    s.wonValue += value ?? 0;
  }
}

/** One line of the campaign_lead_stats view (totals counted in the database). */
interface StatsRow {
  campaign_id: string;
  total: number;
  open: number;
  won: number;
  won_value: number | string;
}

/** One line of the campaign_scan_stats view (owners only). */
export interface ScanRow {
  campaign_id: string;
  total: number;
  last_7_days: number;
}

/** "12 %" — leads per scan. Empty when there are no scans yet. */
export function conversion(leads: number, scans: number): string {
  if (!scans) return '—';
  return `${Math.round((leads / scans) * 100)} %`;
}

export function buildingLabel(c: Pick<Campaign, 'building'>): string | null {
  if (!c.building) return null;
  return [c.building.partner?.name, `Edificio ${c.building.name}`].filter(Boolean).join(' · ');
}

export default function Campaigns({ me }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [leadStats, setLeadStats] = useState<StatsRow[]>([]);
  const [scanStats, setScanStats] = useState<ScanRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.from('campaigns').select(CAMPAIGN_SELECT).order('created_at', { ascending: false }),
      supabase.from('campaign_lead_stats').select('campaign_id, total, open, won, won_value'),
      /* Only owners can see scans; for specialists this simply comes back empty. */
      supabase.from('campaign_scan_stats').select('campaign_id, total, last_7_days'),
    ]).then(([c, l, s]) => {
      if (!alive) return;
      const err = c.error ?? l.error ?? s.error;
      if (err) {
        setError(errorMessage(err));
        return;
      }
      setCampaigns((c.data ?? []) as unknown as Campaign[]);
      setLeadStats((l.data ?? []) as StatsRow[]);
      setScanStats((s.data ?? []) as ScanRow[]);
    });
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(
    () =>
      new Map<string, CampaignStats>(
        leadStats.map((r) => [r.campaign_id, { total: r.total, open: r.open, won: r.won, wonValue: Number(r.won_value) }]),
      ),
    [leadStats],
  );
  const scans = useMemo(() => new Map(scanStats.map((r) => [r.campaign_id, r])), [scanStats]);
  const isOwner = me.role === 'owner';

  if (error) return <p className="error">{error}</p>;
  if (!campaigns) return <p className="muted">Cargando campañas…</p>;

  const active = campaigns.filter((c) => c.active);
  const inactive = campaigns.filter((c) => !c.active);
  const shown = showInactive ? campaigns : active;
  const totals = emptyStats();
  let totalScans = 0;
  active.forEach((c) => {
    totalScans += scans.get(c.id)?.total ?? 0;
    const s = stats.get(c.id);
    if (!s) return;
    totals.total += s.total;
    totals.open += s.open;
    totals.won += s.won;
    totals.wonValue += s.wonValue;
  });

  return (
    <section className="stack">
      <div className="page-head">
        <div>
          <h1>Campañas</h1>
          <span className="muted">Cada campaña tiene su QR o enlace. Los leads que llegan por él quedan unidos a ella.</span>
        </div>
        {me.role === 'owner' && (
          <a href={href.campaignNew} className="btn primary">
            + Nueva campaña
          </a>
        )}
      </div>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-value">{active.length}</span>
          <span className="kpi-label">Campañas activas</span>
        </div>
        {isOwner && (
          <div className="kpi">
            <span className="kpi-value">{totalScans}</span>
            <span className="kpi-label">Escaneos / visitas</span>
          </div>
        )}
        <div className="kpi">
          <span className="kpi-value">{totals.total}</span>
          <span className="kpi-label">Leads de campañas</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{totals.open}</span>
          <span className="kpi-label">En curso</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{totals.won}</span>
          <span className="kpi-label">Ganados · {euros.format(totals.wonValue)}</span>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="card empty stack">
          <p>Todavía no hay campañas.</p>
          {me.role === 'owner' && (
            <div>
              <a href={href.campaignNew} className="btn primary">
                Crear la primera
              </a>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="campaign-grid">
            {shown.map((c) => {
              const s = stats.get(c.id) ?? emptyStats();
              return (
                <a key={c.id} href={href.campaign(c.id)} className={`card campaign-card ${c.active ? '' : 'inactive'}`}>
                  <div className="campaign-card-head">
                    <span className={`type-tag type-${c.form}`}>{FORM_SHORT[c.form]}</span>
                    {!c.active && <span className="type-tag off">Desactivada</span>}
                  </div>
                  <h2>{c.name}</h2>
                  <div className="muted small">
                    {buildingLabel(c) ?? 'Sin edificio'} · <code>{c.code}</code>
                  </div>
                  <div className="campaign-stats">
                    {isOwner && (
                      <span>
                        <strong>{scans.get(c.id)?.total ?? 0}</strong> escaneos
                      </span>
                    )}
                    <span>
                      <strong>{s.total}</strong> leads
                    </span>
                    <span>
                      <strong>{s.open}</strong> en curso
                    </span>
                    <span>
                      <strong>{s.won}</strong> ganados
                    </span>
                    {isOwner && (
                      <span>
                        <strong>{conversion(s.total, scans.get(c.id)?.total ?? 0)}</strong> conversión
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
          {inactive.length > 0 && (
            <button className="link-btn small" onClick={() => setShowInactive(!showInactive)}>
              {showInactive ? 'Ocultar desactivadas' : `Mostrar desactivadas (${inactive.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
