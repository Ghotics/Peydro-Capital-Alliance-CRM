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
  return msg ? `Ha ocurrido un error: ${msg}` : 'Ha ocurrido un error.';
}
