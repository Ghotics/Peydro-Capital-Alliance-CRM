/* Numbers. Everything is counted in the database and follows the access rules:
   owners see the whole company (and QR scans), specialists see their own departments. */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { departmentLabel, errorMessage, euros } from '../lib/labels';
import type { TeamMember } from '../lib/types';
import { conversion } from './Campaigns';

interface Props {
  me: TeamMember;
}

interface WeekRow {
  week: string;
  department: string | null;
  total: number;
  won: number;
}
interface ResponseRow {
  department: string | null;
  leads: number;
  touched: number;
  avg_hours: number | string | null;
  median_hours: number | string | null;
}
interface CampaignRow {
  id: string;
  name: string;
  active: boolean;
}
interface CampaignLeadRow {
  campaign_id: string;
  total: number;
  won: number;
  won_value: number | string;
}
interface ScanRow {
  campaign_id: string;
  total: number;
}

const WEEKS = 12;

/** Monday of the week, as "YYYY-MM-DD" (same as the database's week start, Madrid time). */
function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function hours(value: number | string | null): string {
  if (value === null || value === undefined) return '—';
  const h = Number(value);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${h.toFixed(1).replace('.', ',')} h`;
  return `${(h / 24).toFixed(1).replace('.', ',')} días`;
}

const shortDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function Analytics({ me }: Props) {
  const [weeks, setWeeks] = useState<WeekRow[] | null>(null);
  const [response, setResponse] = useState<ResponseRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignLeads, setCampaignLeads] = useState<CampaignLeadRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const isOwner = me.role === 'owner';

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.from('lead_weekly_stats').select('week, department, total, won'),
      supabase.from('response_time_stats').select('department, leads, touched, avg_hours, median_hours'),
      supabase.from('campaigns').select('id, name, active').order('name'),
      supabase.from('campaign_lead_stats').select('campaign_id, total, won, won_value'),
      supabase.from('campaign_scan_stats').select('campaign_id, total'),
    ]).then(([w, r, c, cl, s]) => {
      if (!alive) return;
      const err = w.error ?? r.error ?? c.error ?? cl.error ?? s.error;
      if (err) {
        setError(errorMessage(err));
        return;
      }
      setWeeks((w.data ?? []) as WeekRow[]);
      setResponse((r.data ?? []) as ResponseRow[]);
      setCampaigns((c.data ?? []) as CampaignRow[]);
      setCampaignLeads((cl.data ?? []) as CampaignLeadRow[]);
      setScans((s.data ?? []) as ScanRow[]);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* Last 12 weeks, missing weeks as 0. */
  const series = useMemo(() => {
    const byWeek = new Map<string, number>();
    (weeks ?? []).forEach((r) => byWeek.set(r.week, (byWeek.get(r.week) ?? 0) + r.total));
    const out: { week: string; total: number }[] = [];
    const now = new Date();
    for (let i = WEEKS - 1; i >= 0; i--) {
      const key = mondayOf(new Date(now.getTime() - i * 7 * 86_400_000));
      out.push({ week: key, total: byWeek.get(key) ?? 0 });
    }
    return out;
  }, [weeks]);

  const byDepartment = useMemo(() => {
    const map = new Map<string, { total: number; won: number }>();
    (weeks ?? []).forEach((r) => {
      const key = r.department ?? '';
      const row = map.get(key) ?? { total: 0, won: 0 };
      row.total += r.total;
      row.won += r.won;
      map.set(key, row);
    });
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [weeks]);

  if (error) return <p className="error">{error}</p>;
  if (!weeks) return <p className="muted">Cargando números…</p>;

  const total = byDepartment.reduce((n, [, r]) => n + r.total, 0);
  const won = byDepartment.reduce((n, [, r]) => n + r.won, 0);
  const last4 = series.slice(-4).reduce((n, w) => n + w.total, 0);
  const touched = response.reduce((n, r) => n + r.touched, 0);
  const avgAll = touched
    ? response.reduce((n, r) => n + Number(r.avg_hours ?? 0) * r.touched, 0) / touched
    : null;
  const max = Math.max(1, ...series.map((w) => w.total));
  const responseFor = new Map(response.map((r) => [r.department ?? '', r]));
  const leadsFor = new Map(campaignLeads.map((r) => [r.campaign_id, r]));
  const scansFor = new Map(scans.map((r) => [r.campaign_id, r.total]));

  return (
    <section className="stack">
      <div className="page-head">
        <div>
          <h1>Analítica</h1>
          <span className="muted">
            {isOwner ? 'Toda la empresa.' : 'Solo tus departamentos y los leads asignados a ti.'}
          </span>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-value">{last4}</span>
          <span className="kpi-label">Leads · últimas 4 semanas</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{total}</span>
          <span className="kpi-label">Leads en total</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{total ? `${Math.round((won / total) * 100)} %` : '—'}</span>
          <span className="kpi-label">Ganados · {won}</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{hours(avgAll)}</span>
          <span className="kpi-label">Primera respuesta (media, 90 días)</span>
        </div>
      </div>

      <div className="card stack">
        <div className="row space-between">
          <h2>Leads por semana</h2>
          <button className="link-btn small" onClick={() => setShowTable(!showTable)}>
            {showTable ? 'Ver gráfico' : 'Ver como tabla'}
          </button>
        </div>
        {showTable ? (
          <table className="leads compact">
            <thead>
              <tr>
                <th>Semana del</th>
                <th>Leads</th>
              </tr>
            </thead>
            <tbody>
              {series.map((w) => (
                <tr key={w.week}>
                  <td>{shortDate.format(new Date(w.week))}</td>
                  <td>{w.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="week-chart" role="img" aria-label={`Leads por semana, últimas ${WEEKS} semanas`}>
            <div className="week-bars">
              {series.map((w, i) => (
                <div
                  key={w.week}
                  className={`week-bar ${hover === i ? 'hover' : ''}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {hover === i && (
                    <div
                      className={`chart-tip ${i >= WEEKS - 2 ? 'to-left' : ''}`}
                      style={{ bottom: `calc(${(w.total / max) * 100}% + 8px)` }}
                    >
                      <span>
                        <strong>{w.total}</strong> {w.total === 1 ? 'lead' : 'leads'}
                      </span>
                      <span className="muted">semana del {shortDate.format(new Date(w.week))}</span>
                    </div>
                  )}
                  <span className="week-fill" style={{ height: `${(w.total / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="week-axis">
              {series.map((w, i) => (
                <span key={w.week}>{i % 2 === WEEKS % 2 ? '' : shortDate.format(new Date(w.week))}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card stack">
        <h2>Por departamento</h2>
        {byDepartment.length === 0 ? (
          <p className="muted small">Todavía no hay leads.</p>
        ) : (
          <div className="table-wrap">
            <table className="leads compact">
              <thead>
                <tr>
                  <th>Departamento</th>
                  <th>Leads</th>
                  <th>Ganados</th>
                  <th>Primera respuesta (media)</th>
                  <th>Primera respuesta (mediana)</th>
                  <th>Sin tocar (90 días)</th>
                </tr>
              </thead>
              <tbody>
                {byDepartment.map(([dep, r]) => {
                  const rt = responseFor.get(dep);
                  return (
                    <tr key={dep || '-'}>
                      <td>{departmentLabel(dep || null)}</td>
                      <td>{r.total}</td>
                      <td>{r.won}</td>
                      <td>{hours(rt?.avg_hours ?? null)}</td>
                      <td>{hours(rt?.median_hours ?? null)}</td>
                      <td>{rt ? rt.leads - rt.touched : 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">
          "Primera respuesta" = tiempo desde que llega el lead hasta el primer cambio o nota de una persona del equipo.
        </p>
      </div>

      <div className="card stack">
        <h2>Campañas</h2>
        <div className="table-wrap">
          <table className="leads compact">
            <thead>
              <tr>
                <th>Campaña</th>
                {isOwner && <th>Escaneos</th>}
                <th>Leads</th>
                {isOwner && <th>Conversión</th>}
                <th>Ganados</th>
                <th>Valor ganado</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const l = leadsFor.get(c.id);
                const s = scansFor.get(c.id) ?? 0;
                return (
                  <tr key={c.id} className={c.active ? '' : 'muted'}>
                    <td>{c.name}</td>
                    {isOwner && <td>{s}</td>}
                    <td>{l?.total ?? 0}</td>
                    {isOwner && <td>{conversion(l?.total ?? 0, s)}</td>}
                    <td>{l?.won ?? 0}</td>
                    <td>{euros.format(Number(l?.won_value ?? 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
