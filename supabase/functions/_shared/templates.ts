/* The texts of every email. Plain functions (no network), so they can be tested on their own.
   Team emails are in Spanish (the CRM is Spanish only); the visitor gets Spanish or English like the page they used. */

export interface LeadSummary {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  message: string | null;
  departmentLabel: string;
  campaignName: string | null;
}

export interface Mail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const wrap = (body: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#221c12;max-width:560px">${body}` +
  `<p style="color:#6a5e4b;font-size:12px;margin-top:28px">Peydro Capital Alliance</p></div>`;

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${escapeHtml(href)}" style="background:#9a7636;color:#fdfaf3;padding:10px 18px;` +
  `border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;

function leadLines(lead: LeadSummary): { html: string; text: string } {
  const rows: [string, string][] = [
    ['Nombre', `${lead.first_name} ${lead.last_name}`],
    ['Departamento', lead.departmentLabel],
    ['Email', lead.email],
    ['Teléfono', lead.phone],
  ];
  if (lead.campaignName) rows.push(['Campaña', lead.campaignName]);
  const html =
    '<table style="border-collapse:collapse">' +
    rows
      .map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#6a5e4b">${k}</td><td>${escapeHtml(v)}</td></tr>`)
      .join('') +
    '</table>' +
    (lead.message
      ? `<p style="background:#f4eee2;padding:10px 12px;border-radius:8px;white-space:pre-wrap">${escapeHtml(lead.message)}</p>`
      : '');
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + (lead.message ? `\n\n${lead.message}` : '');
  return { html, text };
}

/** To the specialist a lead was assigned to (new from the website, or reassigned in the CRM). */
export function assignedMail(lead: LeadSummary, link: string, isNew: boolean): Mail {
  const subject = isNew
    ? `Nuevo lead: ${lead.first_name} ${lead.last_name} · ${lead.departmentLabel}`
    : `Te han asignado un lead: ${lead.first_name} ${lead.last_name}`;
  const intro = isNew ? 'Ha llegado un lead nuevo y está asignado a ti.' : 'Te han asignado este lead en el CRM.';
  const lines = leadLines(lead);
  return {
    subject,
    html: wrap(`<p>${intro}</p>${lines.html}${button(link, 'Abrir en el CRM')}`),
    text: `${intro}\n\n${lines.text}\n\nAbrir en el CRM: ${link}`,
  };
}

/** To the owners' list, for leads nobody is in charge of (Consulta general, quick form). */
export function unassignedMail(lead: LeadSummary, link: string): Mail {
  const lines = leadLines(lead);
  return {
    subject: `Lead sin asignar: ${lead.first_name} ${lead.last_name} · ${lead.departmentLabel}`,
    html: wrap(`<p>Ha llegado un lead que no tiene responsable.</p>${lines.html}${button(link, 'Abrir en el CRM')}`),
    text: `Ha llegado un lead que no tiene responsable.\n\n${lines.text}\n\nAbrir en el CRM: ${link}`,
  };
}

/** To the visitor, right after sending a form. */
export function visitorMail(firstName: string, departmentLabel: string, lang: 'es' | 'en'): Mail {
  if (lang === 'en') {
    const body =
      `Hello ${firstName},\n\nThank you for contacting Peydro Capital Alliance. We have received your request ` +
      `(${departmentLabel}) and a member of the team will get back to you shortly by phone or email.\n\n` +
      `If you need to add anything, simply reply to this email.`;
    return {
      subject: 'We have received your request · Peydro Capital Alliance',
      html: wrap(body.split('\n\n').map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')),
      text: body,
    };
  }
  const body =
    `Hola ${firstName}:\n\nGracias por contactar con Peydro Capital Alliance. Hemos recibido tu solicitud ` +
    `(${departmentLabel}) y una persona del equipo te contactará pronto por teléfono o por correo.\n\n` +
    `Si quieres añadir algo, responde a este correo.`;
  return {
    subject: 'Hemos recibido tu solicitud · Peydro Capital Alliance',
    html: wrap(body.split('\n\n').map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')),
    text: body,
  };
}

/** WhatsApp template values, in order: {{1}} department, {{2}} name, {{3}} phone, {{4}} CRM link. */
export function whatsappValues(lead: LeadSummary, link: string): string[] {
  return [lead.departmentLabel, `${lead.first_name} ${lead.last_name}`, lead.phone, link];
}
