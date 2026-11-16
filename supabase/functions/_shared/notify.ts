/* Who hears about a lead, and how. Used by website-intake (new lead) and crm-actions (lead assigned in the CRM).
     - Lead with a person in charge -> email to that person.
     - Lead without one (e.g. Consulta general, quick form) -> email to NOTIFY_UNASSIGNED_EMAILS and/or WhatsApp.
     - New lead from the website -> confirmation email to the visitor (unless SEND_VISITOR_CONFIRMATION=false).
   Every channel is skipped while its keys are missing. Nothing here can make saving a lead fail. */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, type SendResult } from './email.ts';
import { crmUrl, env, envList } from './env.ts';
import { departmentName, languageOfPage } from './labels.ts';
import { assignedMail, unassignedMail, visitorMail, whatsappValues, type LeadSummary } from './templates.ts';
import { sendWhatsApp } from './whatsapp.ts';

interface Options {
  /** 'new' = just arrived from the website; 'assigned' = someone was put in charge in the CRM. */
  reason: 'new' | 'assigned';
  /** Don't email this person (whoever made the change in the CRM). */
  skipUserId?: string;
}

export interface NotifyResult {
  assignee: SendResult;
  unassigned: SendResult;
  whatsapp: SendResult;
  visitor: SendResult;
}

export async function notifyLead(db: SupabaseClient, leadId: string, options: Options): Promise<NotifyResult> {
  const result: NotifyResult = { assignee: 'skipped', unassigned: 'skipped', whatsapp: 'skipped', visitor: 'skipped' };

  const { data: lead, error } = await db
    .from('leads')
    .select('id, first_name, last_name, email, phone, message, department, page, owner_id, campaign:campaigns(name)')
    .eq('id', leadId)
    .maybeSingle();
  if (error || !lead) {
    console.error('notify: lead not found', leadId, error);
    return result;
  }

  const summary: LeadSummary = {
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone,
    message: lead.message,
    departmentLabel: departmentName(lead.department),
    campaignName: (lead.campaign as { name?: string } | null)?.name ?? null,
  };
  const link = `${crmUrl()}#/lead/${lead.id}`;

  if (lead.owner_id && lead.owner_id !== options.skipUserId) {
    const { data: member } = await db.from('team_members').select('active').eq('id', lead.owner_id).maybeSingle();
    if (member?.active) {
      const { data: user } = await db.auth.admin.getUserById(lead.owner_id);
      const to = user?.user?.email;
      if (to) result.assignee = await sendEmail([to], assignedMail(summary, link, options.reason === 'new'));
    }
  }

  if (!lead.owner_id && options.reason === 'new') {
    result.unassigned = await sendEmail(envList('NOTIFY_UNASSIGNED_EMAILS'), unassignedMail(summary, link));
    if (envList('WHATSAPP_DEPARTMENTS', 'consulta,quick').includes(lead.department ?? '')) {
      result.whatsapp = await sendWhatsApp(whatsappValues(summary, link));
    }
  }

  if (options.reason === 'new' && env('SEND_VISITOR_CONFIRMATION') !== 'false') {
    const lang = languageOfPage(lead.page);
    result.visitor = await sendEmail(
      [lead.email],
      visitorMail(lead.first_name, departmentName(lead.department, lang), lang),
    );
  }

  console.log('notify', leadId, result);
  return result;
}
