/* "Are you human?" check for the website forms (Cloudflare Turnstile).
   The website sends a one-time token with each form; here we ask Cloudflare if it's genuine.
   Only enforced while the TURNSTILE_SECRET_KEY secret is set, so nothing breaks before it's added.
   Turn it on in this order: site key on the website first, then this secret. */
import { env } from './env.ts';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type HumanCheckResult = 'off' | 'passed' | 'failed';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Checks the token. 'off' = no secret set (check disabled). Fails closed if Cloudflare can't be reached. */
export async function checkHuman(
  token: unknown,
  ip: string,
  secret = env('TURNSTILE_SECRET_KEY'),
  fetcher: Fetch = fetch,
): Promise<HumanCheckResult> {
  if (!secret) return 'off';
  if (typeof token !== 'string' || !token || token.length > 2048) return 'failed';

  const form = new URLSearchParams({ secret, response: token });
  if (ip && ip !== 'unknown') form.set('remoteip', ip);
  try {
    const res = await fetcher(VERIFY_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      console.error('Turnstile answered', res.status);
      return 'failed';
    }
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (!data.success) console.warn('Turnstile refused', data['error-codes']);
    return data.success ? 'passed' : 'failed';
  } catch (error) {
    console.error('Turnstile could not be reached', error);
    return 'failed';
  }
}
