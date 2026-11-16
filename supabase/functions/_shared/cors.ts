/* Browser permission headers (CORS): only the website and the CRM may call the functions. */
import { allowedOrigins } from './env.ts';

export type Headers = Record<string, string>;

export function originOf(req: Request): string | null {
  return req.headers.get('origin')?.replace(/\/+$/, '') ?? null;
}

export function isAllowed(origin: string | null): boolean {
  return origin !== null && allowedOrigins().includes(origin);
}

export function corsHeaders(origin: string | null): Headers {
  const headers: Headers = { Vary: 'Origin' };
  if (isAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin!;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

export function reply(status: number, data: unknown, headers: Headers): Response {
  if (data === null) return new Response(null, { status, headers });
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
