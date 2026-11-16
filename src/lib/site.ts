/* Where the public website lives, and the address each campaign's QR code / link opens.
   Set VITE_WEBSITE_URL (in .env and in the deploy workflow) when the website moves to its own domain.
   Printed QR codes keep the address they were made with, so print them only once the final domain is set. */
import type { Campaign, FormKind } from './types';

export const WEBSITE_URL = (
  (import.meta.env.VITE_WEBSITE_URL as string | undefined) || 'https://ghotics.github.io/Peydro-Capital-Alliance'
).replace(/\/+$/, '');

/** The page of the website each form lives on. */
const FORM_PATH: Record<FormKind, string> = {
  giza: '/giza/',
  business_office: '/asesoramiento/',
  quick: '/contacto-rapido/',
};

export function campaignUrl(c: Pick<Campaign, 'code' | 'form'>): string {
  return `${WEBSITE_URL}${FORM_PATH[c.form]}?c=${encodeURIComponent(c.code)}`;
}

/** Codes allowed by the database: lower-case letters, numbers, - and _ (max 40). */
export const CODE_PATTERN = /^[a-z0-9_-]{1,40}$/;

/** "Renta 92 · Edificio 14" -> "renta-92-edificio-14" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}
