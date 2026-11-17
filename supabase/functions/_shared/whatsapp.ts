/* WhatsApp Business (Meta Cloud API) message to PCA's own number, for leads without a person in charge.
   Needs: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID (the sending business number's id), WHATSAPP_TO (number(s) that
   receive the alerts, e.g. 34600000000 or 34600000000,34611111111) and WHATSAPP_TEMPLATE (an approved message template with 4 values:
   department, name, phone, CRM link). Optional: WHATSAPP_TEMPLATE_LANG (default "es"), WHATSAPP_API_VERSION.
   Meta only lets a business start a conversation with an approved template, which is why a template is needed.
   Step-by-step setup: docs/whatsapp-setup.md in the CRM repo. */
import { env, envList } from './env.ts';
import type { SendResult } from './email.ts';

export function whatsappReady(): boolean {
  return Boolean(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID') && env('WHATSAPP_TO') && env('WHATSAPP_TEMPLATE'));
}

/** Alert numbers: digits only, so "+34 600 00 00 00" also works. */
export function whatsappRecipients(raw = envList('WHATSAPP_TO')): string[] {
  return [...new Set(raw.map((n) => n.replace(/\D/g, '')).filter((n) => n.length >= 8))];
}

export async function sendWhatsApp(values: string[]): Promise<SendResult> {
  if (!whatsappReady()) return 'skipped';
  const to = whatsappRecipients();
  if (to.length === 0) return 'skipped';
  const results = await Promise.all(to.map((number) => sendOne(number, values)));
  return results.every((r) => r === 'sent') ? 'sent' : 'failed';
}

async function sendOne(to: string, values: string[]): Promise<SendResult> {
  const version = env('WHATSAPP_API_VERSION') ?? 'v21.0';
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: env('WHATSAPP_TEMPLATE'),
          language: { code: env('WHATSAPP_TEMPLATE_LANG') ?? 'es' },
          components: [
            { type: 'body', parameters: values.map((text) => ({ type: 'text', text: text.slice(0, 200) })) },
          ],
        },
      }),
    });
    if (!response.ok) {
      console.error('WhatsApp not sent', to.slice(-3), response.status, await response.text().catch(() => ''));
      return 'failed';
    }
    return 'sent';
  } catch (error) {
    console.error('WhatsApp not sent', to.slice(-3), error);
    return 'failed';
  }
}
