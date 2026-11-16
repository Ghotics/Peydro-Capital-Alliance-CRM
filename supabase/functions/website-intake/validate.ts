/* Checks what the website forms send. Same rules as the database, so a bad lead is stopped here
   with a clear answer instead of a database error. No outside imports: easy to test on its own. */

export type FormKind = 'giza' | 'business_office' | 'quick';

export const FORMS: FormKind[] = ['giza', 'business_office', 'quick'];
export const AREAS = ['planificacion-financiera', 'tecnologia', 'telecomunicaciones', 'marketing', 'consulta'];
export const INTERESTS = ['seguros', 'ahorro_inversion', 'hipotecas'];
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

export const CODE_PATTERN = /^[a-z0-9_-]{1,40}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9]{9,15}$/;

/** A lead ready to save (column names of public.leads, plus the two things to look up). */
export interface CleanLead {
  form: FormKind;
  area: string | null;
  interests: string[];
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  unit: string | null;
  message: string | null;
  utm: Record<string, string>;
  page: string | null;
  /** Campaign code from ?c=… (looked up in the function). */
  campaign: string | null;
  /** Building the visitor picked, e.g. "14" (looked up in the function). */
  building: string | null;
}

export type CheckResult = { ok: true; lead: CleanLead } | { ok: false; fields: string[] };

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const optional = (v: unknown, max: number): string | null => {
  const t = text(v);
  return t ? t.slice(0, max) : null;
};

export function checkLead(body: unknown): CheckResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, fields: ['body'] };
  const b = body as Record<string, unknown>;
  const bad: string[] = [];

  const form = text(b.form) as FormKind;
  if (!FORMS.includes(form)) bad.push('form');

  let area: string | null = optional(b.area, 40);
  if (form === 'business_office') {
    if (!area || !AREAS.includes(area)) bad.push('area');
  } else {
    area = null;
  }

  const first_name = text(b.first_name);
  if (first_name.length < 1 || first_name.length > 80) bad.push('first_name');
  const last_name = text(b.last_name);
  if (last_name.length < 1 || last_name.length > 120) bad.push('last_name');

  const email = text(b.email).toLowerCase();
  if (email.length > 160 || !EMAIL_PATTERN.test(email)) bad.push('email');

  const phone = text(b.phone).replace(/[\s().-]/g, '');
  if (!PHONE_PATTERN.test(phone)) bad.push('phone');

  const unit = optional(b.unit, 20);
  const message = optional(b.message, 2000);
  if (text(b.message).length > 2000) bad.push('message');

  if (b.privacy_accepted !== true) bad.push('privacy_accepted');

  const interests = Array.isArray(b.interests)
    ? [...new Set(b.interests.filter((i): i is string => typeof i === 'string' && INTERESTS.includes(i)))]
    : [];

  const utm: Record<string, string> = {};
  if (b.utm && typeof b.utm === 'object' && !Array.isArray(b.utm)) {
    for (const key of UTM_KEYS) {
      const value = optional((b.utm as Record<string, unknown>)[key], 100);
      if (value) utm[key] = value;
    }
  }

  const code = text(b.campaign).toLowerCase();
  const campaign = CODE_PATTERN.test(code) ? code : null;
  const building = optional(b.building, 40);
  const page = optional(b.page, 300);

  if (bad.length) return { ok: false, fields: bad };
  return {
    ok: true,
    lead: { form, area, interests, first_name, last_name, email, phone, unit, message, utm, page, campaign, building },
  };
}

export function checkScan(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const code = text((body as Record<string, unknown>).campaign).toLowerCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/* ---- Simple per-visitor speed limit (kept in memory, so it's "best effort", not exact). ---- */
const hits = new Map<string, number[]>();

/** True when this visitor (IP) has made more than `max` requests of this kind in the last `minutes`. */
export function tooMany(key: string, max: number, minutes: number, now = Date.now()): boolean {
  const since = now - minutes * 60_000;
  const recent = (hits.get(key) ?? []).filter((t) => t > since);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // never grow without limit
  return recent.length > max;
}
