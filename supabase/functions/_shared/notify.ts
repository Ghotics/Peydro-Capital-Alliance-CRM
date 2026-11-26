/* Who hears about a lead, and how. Used by website-intake (new lead) and crm-actions (lead assigned in the CRM).
     - New lead from the website:
         · the specialist in charge (if any) -> "assigned to you" email;
         · EVERY active owner, plus NOTIFY_EXTRA_EMAILS -> email for every lead, saying who it went to
           (an owner who is also the one in charge gets only the "assigned to you" email);
         · no one in charge (Consulta general, quick form) -> also WhatsApp;
         · the team's Telegram group -> a short alert for every lead from the forms in TELEGRAM_FORMS
           (default: Business Office);
         · the visitor -> confirmation email (unless SEND_VISITOR_CONFIRMATION=false).
     - Lead reassigned in the CRM -> email to the new person in charge only.
   Every channel is skipped while its keys are missing. Nothing here can make saving a lead fail. */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, type SendResult } from './email.ts';
import { crmUrl, env, envList } from './env.ts';
import { departmentName, formName, languageOfPage } from './labels.ts';
import { sendTelegram, telegramForms } from './telegram.ts';
import { assignedMail, ownerMail, telegramMessage, visitorMail, whatsappValues, type LeadSummary } from './templates.ts';
import { sendWhatsApp } from './whatsapp.ts';

interface Options {
  /** 'new' = just arrived from the website; 'assigned' = someone was put in charge in the CRM. */
  reason: 'new' | 'assigned';
  /** Don't email this person (whoever made the change in the CRM). */
  skipUserId?: string;
}

export interface NotifyResult {
  assignee: SendResult;
  owners: SendResult;
  whatsapp: SendResult;
  telegram: SendResult;
  visitor: SendResult;
}

export async function notifyLead(db: SupabaseClient, leadId: string, options: Options): Promise<NotifyResult> {
  const result: NotifyResult = {
    assignee: 'skipped',
    owners: 'skipped',
    whatsapp: 'skipped',
    telegram: 'skipped',
    visitor: 'skipped',
  };

  const { data: lead, error } = await db
    .from('leads')
    .select('id, form, first_name, last_name, email, phone, message, department, page, owner_id, campaign:campaigns(name)')
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

  /* The person in charge, if they're active. */
  let assigneeName: string | null = null;
  let assigneeEmail: string | null = null;
  if (lead.owner_id) {
    const { data: member } = await db.from('team_members').select('name, active').eq('id', lead.owner_id).maybeSingle();
    if (member?.active) {
      assigneeName = member.name;
      const { data: user } = await db.auth.admin.getUserById(lead.owner_id);
      assigneeEmail = user?.user?.email?.toLowerCase() ?? null;
    }
  }
  if (assigneeEmail && lead.owner_id !== options.skipUserId) {
    result.assignee = await sendEmail([assigneeEmail], assignedMail(summary, link, options.reason === 'new'));
  }

  if (options.reason === 'new') {
    /* Owners hear about every new lead. */
    const recipients = new Set([...(await ownerEmails(db)), ...envList('NOTIFY_EXTRA_EMAILS').map((e) => e.toLowerCase())]);
    if (assigneeEmail) recipients.delete(assigneeEmail);
    result.owners = await sendEmail([...recipients], ownerMail(summary, link, assigneeName));

    if (!lead.owner_id && envList('WHATSAPP_DEPARTMENTS', 'consulta,quick').includes(lead.department ?? '')) {
      result.whatsapp = await sendWhatsApp(whatsappValues(summary, link));
    }

    /* The team's Telegram group: every new lead from the chosen forms, assigned or not. */
    if (telegramForms().includes(lead.form ?? '')) {
      result.telegram = await sendTelegram(telegramMessage(summary, formName(lead.form), assigneeName, link));
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

/** Email addresses of every active owner. */
async function ownerEmails(db: SupabaseClient): Promise<string[]> {
  const { data: owners, error } = await db.from('team_members').select('id').eq('role', 'owner').eq('active', true);
  if (error) {
    console.error('notify: owners not found', error);
    return [];
  }
  const emails: string[] = [];
  for (const owner of owners ?? []) {
    const { data } = await db.auth.admin.getUserById(owner.id);
    if (data?.user?.email) emails.push(data.user.email.toLowerCase());
  }
  return emails;
}
