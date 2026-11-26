/* Department names, the same as on the website and in the CRM. */

export const DEPARTMENTS: Record<string, { es: string; en: string }> = {
  giza: { es: 'Giza · Planificación financiera', en: 'Giza · Financial planning' },
  'planificacion-financiera': { es: 'Protección y Planificación Financiera', en: 'Protection and Financial Planning' },
  tecnologia: { es: 'Tecnología y Automatización', en: 'Technology and Automation' },
  telecomunicaciones: { es: 'Telecomunicaciones y Energía', en: 'Telecommunications and Energy' },
  marketing: { es: 'Marketing y Captación Digital', en: 'Marketing and Digital Acquisition' },
  consulta: { es: 'Consulta general', en: 'General enquiry' },
  quick: { es: 'Formulario rápido', en: 'Quick contact form' },
};

export function departmentName(dep: string | null, lang: 'es' | 'en' = 'es'): string {
  if (!dep) return lang === 'es' ? 'Sin departamento' : 'PCA';
  return DEPARTMENTS[dep]?.[lang] ?? dep;
}

/** Form names, the same as the CRM's campaign tabs. */
export const FORM_NAMES: Record<string, string> = {
  business_office: 'Business Office',
  giza: 'Giza',
  quick: 'Formulario rápido',
};

export function formName(form: string | null): string {
  if (!form) return 'Formulario';
  return FORM_NAMES[form] ?? form;
}

/** The website's English pages live under /en/ (after the base path). */
export function languageOfPage(page: string | null): 'es' | 'en' {
  return page && /(^|\/)en(\/|$)/.test(page) ? 'en' : 'es';
}
