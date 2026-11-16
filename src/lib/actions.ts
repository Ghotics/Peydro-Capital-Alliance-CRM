/* Calls to the crm-actions server function (things that need the server key: logins, emails).
   If the function isn't deployed yet, the call fails and the page shows the message. */
import { supabase } from './supabase';

export async function crmAction<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`crm-actions/${path}`, { body });
  if (error) {
    let message = error.message;
    try {
      const detail = await (error as { context?: Response }).context?.json();
      if (detail?.message) message = detail.message;
      else if (detail?.error) message = detail.error;
    } catch {
      /* keep the first message */
    }
    throw new Error(message);
  }
  return data as T;
}

/** Tell the person now in charge of a lead (email). Never blocks or fails the page. */
export function notifyAssignee(leadId: string): void {
  crmAction('notify', { leadId }).catch(() => undefined);
}
