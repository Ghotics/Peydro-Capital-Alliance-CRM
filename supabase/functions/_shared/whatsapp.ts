/* WhatsApp Business (Meta Cloud API) message to PCA's own number, for leads without a person in charge.
   Needs: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID (the sending business number's id), WHATSAPP_TO (number that
   receives the alerts, e.g. 34600000000) and WHATSAPP_TEMPLATE (an approved message template with 4 values:
   department, name, phone, CRM link). Optional: WHATSAPP_TEMPLATE_LANG (default "es"), WHATSAPP_API_VERSION.
   Meta only lets a business start a conversation with an approved template, which is why a template is needed. */
import { env } from './env.ts';
import type { SendResult } from './email.ts';

export function whatsappReady(): boolean {
  return Boolean(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID') && env('WHATSAPP_TO') && env('WHATSAPP_TEMPLATE'));
}

export async function sendWhatsApp(values: string[]): Promise<SendResult> {
  if (!whatsappReady()) return 'skipped';
  const version = env('WHATSAPP_API_VERSION') ?? 'v21.0';
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: env('WHATSAPP_TO')!.replace(/\D/g, ''),
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
      console.error('WhatsApp not sent', response.status, await response.text().catch(() => ''));
      return 'failed';
    }
    return 'sent';
  } catch (error) {
    console.error('WhatsApp not sent', error);
    return 'failed';
  }
}
