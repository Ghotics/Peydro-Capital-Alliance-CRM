/* Cal.com webhooks: checking they really come from Cal.com, and reading the booking. No network here. */

export type BookingEvent = 'created' | 'rescheduled' | 'cancelled' | 'other';

export interface Booking {
  event: BookingEvent;
  /** The lead id the website put in the booking link (metadata[leadId]). */
  leadId: string | null;
  /** First attendee's email, used when there is no lead id. */
  email: string | null;
  startTime: string | null;
  title: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cal.com signs each webhook: header x-cal-signature-256 = HMAC-SHA256(secret, raw body), in hex. */
export async function verifyCalSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const given = signature.trim().toLowerCase();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

export function readBooking(body: unknown): Booking {
  const b = (body ?? {}) as { triggerEvent?: string; payload?: Record<string, unknown> };
  const p = b.payload ?? {};
  const event: BookingEvent =
    b.triggerEvent === 'BOOKING_CREATED'
      ? 'created'
      : b.triggerEvent === 'BOOKING_RESCHEDULED'
        ? 'rescheduled'
        : b.triggerEvent === 'BOOKING_CANCELLED'
          ? 'cancelled'
          : 'other';
  const metadata = (p.metadata ?? {}) as Record<string, unknown>;
  const leadId = typeof metadata.leadId === 'string' && UUID.test(metadata.leadId) ? metadata.leadId : null;
  const attendees = Array.isArray(p.attendees) ? (p.attendees as { email?: unknown }[]) : [];
  const email = typeof attendees[0]?.email === 'string' ? (attendees[0].email as string).trim().toLowerCase() : null;
  const startTime = typeof p.startTime === 'string' && !Number.isNaN(Date.parse(p.startTime)) ? p.startTime : null;
  const title = typeof p.title === 'string' ? p.title.slice(0, 200) : null;
  return { event, leadId, email, startTime, title };
}
