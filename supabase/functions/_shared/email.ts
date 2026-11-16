/* Sending emails through Resend (resend.com).
   Needs: RESEND_API_KEY and EMAIL_FROM (e.g. "PCA <avisos@peydrocapitalalliance.com>", on a domain verified in Resend).
   Optional: EMAIL_REPLY_TO (where the visitor's replies go). Without the key, nothing is sent. */
import { env } from './env.ts';
import type { Mail } from './templates.ts';

export type SendResult = 'sent' | 'skipped' | 'failed';

export async function sendEmail(to: string[], mail: Mail, replyTo?: string): Promise<SendResult> {
  const key = env('RESEND_API_KEY');
  const from = env('EMAIL_FROM');
  if (!key || !from || to.length === 0) return 'skipped';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        reply_to: replyTo ?? env('EMAIL_REPLY_TO'),
      }),
    });
    if (!response.ok) {
      console.error('email not sent', response.status, await response.text().catch(() => ''));
      return 'failed';
    }
    return 'sent';
  } catch (error) {
    console.error('email not sent', error);
    return 'failed';
  }
}
