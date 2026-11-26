/* Telegram message to the team's group for every new lead from the website (Business Office by default).
   Needs: TELEGRAM_BOT_TOKEN (from @BotFather) and TELEGRAM_CHAT_ID (the group's id, a negative number such as
   -1001234567890). Optional: TELEGRAM_FORMS, which forms send an alert (default "business_office";
   "business_office,giza,quick" = every form). Without the two keys nothing is sent.
   Step-by-step setup: docs/telegram-setup.md in the CRM repo. */
import { env, envList } from './env.ts';
import type { SendResult } from './email.ts';
import type { TelegramMessage } from './templates.ts';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface TelegramSettings {
  token?: string;
  chatId?: string;
}

function settings(): TelegramSettings {
  return { token: env('TELEGRAM_BOT_TOKEN'), chatId: env('TELEGRAM_CHAT_ID') };
}

/** Forms whose new leads go to the group. */
export function telegramForms(raw = envList('TELEGRAM_FORMS', 'business_office')): string[] {
  return raw.map((f) => f.toLowerCase());
}

export async function sendTelegram(
  message: TelegramMessage,
  { token, chatId } = settings(),
  fetcher: Fetch = fetch,
): Promise<SendResult> {
  if (!token || !chatId) return 'skipped';
  try {
    /* The URL holds the token, so it is never written to the logs. */
    const response = await fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message.html,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: { inline_keyboard: [[{ text: 'Abrir en el CRM', url: message.link }]] },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error('Telegram not sent', response.status, await response.text().catch(() => ''));
      return 'failed';
    }
    return 'sent';
  } catch (error) {
    /* Deno's network errors quote the URL, so the token is blanked out before logging. */
    console.error('Telegram not sent', String(error).replaceAll(token, '***'));
    return 'failed';
  }
}
