/* Every Spanish text that depends on a value from the database.
   Change a name here and the whole CRM picks it up. */
import type { FormKind, Stage, TeamMember } from './types';

export const STAGES: { value: Stage; label: string }[] = [
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'qualified', label: 'Cualificado' },
  { value: 'meeting_booked', label: 'Reunión agendada' },
  { value: 'proposal_sent', label: 'Propuesta enviada' },
  { value: 'won', label: 'Ganado' },
  { value: 'not_ready', label: 'Aún no está listo' },
  { value: 'lost', label: 'Perdido' },
];

export function stageLabel(stage: Stage): string {
  return STAGES.find((s) => s.value === stage)?.label ?? stage;
}

/** Same names as on the website (src/data/forms.ts there). */
export const DEPARTMENTS: Record<string, string> = {
  giza: 'Giza',
  'planificacion-financiera': 'Protección y Planificación Financiera',
  tecnologia: 'Tecnología y Automatización',
  telecomunicaciones: 'Telecomunicaciones y Energía',
  marketing: 'Marketing y Captación Digital',
  consulta: 'Consulta general',
  quick: 'Formulario rápido',
};

export function departmentLabel(dep: string | null): string {
  if (!dep) return 'Sin departamento';
  return DEPARTMENTS[dep] ?? dep;
}

export const FORMS: Record<FormKind, string> = {
  giza: 'Giza (web)',
  business_office: 'Business Office (QR)',
  quick: 'Formulario rápido (enlace)',
};

/** Short names for the campaign type picker and lists. */
export const FORM_SHORT: Record<FormKind, string> = {
  business_office: 'Business Office',
  giza: 'Giza',
  quick: 'Formulario rápido',
};

/** What each campaign type is for, shown when creating one. */
export const FORM_HELP: Record<FormKind, string> = {
  business_office: 'QR en edificios: abre la página de asesoramiento, donde eligen departamento.',
  giza: 'Abre el formulario Giza de la web.',
  quick: 'Enlaces en anuncios o redes: abre el formulario corto.',
};

/** Department choices for a lead typed in by hand: which form + area it counts as. */
export const LEAD_KINDS: { department: string; form: FormKind; area: string | null }[] = [
  { department: 'giza', form: 'giza', area: null },
  { department: 'planificacion-financiera', form: 'business_office', area: 'planificacion-financiera' },
  { department: 'tecnologia', form: 'business_office', area: 'tecnologia' },
  { department: 'telecomunicaciones', form: 'business_office', area: 'telecomunicaciones' },
  { department: 'marketing', form: 'business_office', area: 'marketing' },
  { department: 'consulta', form: 'business_office', area: 'consulta' },
  { department: 'quick', form: 'quick', area: null },
];

/** "Abiertos": stages where the lead is still being worked on. */
export const OPEN_STAGES: Stage[] = ['new', 'contacted', 'qualified', 'meeting_booked', 'proposal_sent'];

export const INTERESTS: Record<string, string> = {
  seguros: 'Seguros',
  ahorro_inversion: 'Ahorro e inversión',
  hipotecas: 'Hipotecas',
};

export function roleLabel(role: TeamMember['role']): string {
  return role === 'owner' ? 'Dirección' : 'Especialista';
}

const dateTime = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});
const dateOnly = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'Europe/Madrid' });

export function formatDateTime(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : '—';
}

export function formatDate(iso: string | null): string {
  return iso ? dateOnly.format(new Date(iso)) : '—';
}

export const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

/** Lower case, no accents: so "jose" finds "José". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Turns Supabase / network errors into a short Spanish message. */
export function errorMessage(error: { message?: string } | null | undefined): string {
  const msg = error?.message ?? '';
  if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/row-level security|permission denied/i.test(msg)) return 'No tienes permiso para hacer este cambio.';
  if (/failed to fetch|network/i.test(msg)) return 'No hay conexión. Revisa internet y vuelve a intentarlo.';
  if (/password should be at least/i.test(msg)) return 'La contraseña es demasiado corta.';
  if (/same.*password|different from the old/i.test(msg)) return 'La nueva contraseña debe ser distinta de la anterior.';
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera unos minutos.';
  if (/Debe quedar al menos/.test(msg)) return 'Debe quedar al menos una persona de dirección activa.';
  if (/campaigns_code_key|duplicate key.*code/i.test(msg)) return 'Ya existe una campaña con ese código. Elige otro.';
  if (/buildings_partner_name_key/i.test(msg)) return 'Ese edificio ya existe para este socio.';
  if (/leads_campaign_id_fkey/i.test(msg)) return 'No se puede borrar: tiene leads. Desactívala en su lugar.';
  if (/leads_building_id_fkey|campaigns_building_id_fkey/i.test(msg))
    return 'No se puede borrar: hay leads o campañas en este edificio.';
  if (/buildings_partner_id_fkey/i.test(msg)) return 'No se puede borrar: este socio todavía tiene edificios.';
  if (/already been registered|already registered|email_exists/i.test(msg)) return 'Ya existe una cuenta con ese email.';
  if (/violates foreign key/i.test(msg)) return 'No se puede borrar: otros datos dependen de esto.';
  return msg ? `Ha ocurrido un error: ${msg}` : 'Ha ocurrido un error.';
}
