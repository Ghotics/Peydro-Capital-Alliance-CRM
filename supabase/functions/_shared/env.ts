/* Settings ("secrets") of the server functions, set in Supabase → Edge Functions → Secrets.
   Every feature that needs a key checks for it and quietly does nothing while it's missing,
   so the system works before the keys are added. The full list is in the CRM README, "Keys and settings". */

/** A secret's value, or undefined when it's missing or empty. Safe to call outside Deno (tests). */
export function env(name: string): string | undefined {
  const deno = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno;
  const value = deno?.env.get(name)?.trim();
  return value ? value : undefined;
}

/** A comma-separated secret as a list: "a, b" -> ["a", "b"]. */
export function envList(name: string, fallback = ''): string[] {
  return (env(name) ?? fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Where the CRM lives, for links in emails. Ends with "/". */
export function crmUrl(): string {
  const url = env('CRM_URL') ?? 'https://crm.peydrocapitalalliance.com/';
  return url.endsWith('/') ? url : `${url}/`;
}

/** Website and CRM addresses allowed to call the functions from a browser (no "/" at the end). */
export function allowedOrigins(): string[] {
  return envList(
    'ALLOWED_ORIGINS',
    'https://www.peydrocapitalalliance.com,https://peydrocapitalalliance.com,https://crm.peydrocapitalalliance.com',
  ).map((o) => o.replace(/\/+$/, ''));
}

/** Runs a job after the answer has been sent, so the visitor never waits for emails. */
export function inBackground(job: Promise<unknown>): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  const safe = job.catch((error) => console.error('background job failed', error));
  if (runtime?.waitUntil) runtime.waitUntil(safe);
}
