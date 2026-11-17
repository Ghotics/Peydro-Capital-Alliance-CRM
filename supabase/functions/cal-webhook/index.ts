/* cal-webhook: Cal.com tells us about bookings, and the lead is updated by itself.
     Booking created / rescheduled -> meeting date saved; stage "Reunión agendada" (if it was still earlier).
     Booking cancelled              -> meeting date removed; stage back to "Contactado" (if it was "Reunión agendada").
   The lead is found by the id the website puts in the booking link (metadata[leadId]),
   or else by the attendee's email (most recent lead with that email, last 60 days).
   Needs: CAL_WEBHOOK_SECRET (the same "secret" typed in Cal.com → Settings → Developer → Webhooks).
   Webhook address: https://<project>.supabase.co/functions/v1/cal-webhook */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { readBooking, verifyCalSignature } from '../_shared/cal.ts';
import { env } from '../_shared/env.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EARLY_STAGES = ['new', 'contacted', 'qualified'];
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const secret = env('CAL_WEBHOOK_SECRET');
  if (!secret) return json(503, { error: 'not_configured' });

  const raw = await req.text();
  if (!(await verifyCalSignature(raw, req.headers.get('x-cal-signature-256'), secret))) {
    return json(401, { error: 'signature' });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'json' });
  }
  const booking = readBooking(body);
  if (booking.event === 'other') return json(200, { ignored: true });

  try {
    let lead: { id: string; stage: string } | null = null;
    if (booking.leadId) {
      const { data } = await db.from('leads').select('id, stage').eq('id', booking.leadId).maybeSingle();
      lead = data;
    }
    if (!lead && booking.email) {
      const { data } = await db
        .from('leads')
        .select('id, stage')
        .eq('email', booking.email)
        .gte('created_at', new Date(Date.now() - 60 * 86_400_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      lead = data;
    }
    if (!lead) return json(200, { matched: false });

    if (booking.event === 'cancelled') {
      await db
        .from('leads')
        .update({ meeting_at: null, ...(lead.stage === 'meeting_booked' ? { stage: 'contacted' } : {}) })
        .eq('id', lead.id);
    } else {
      await db
        .from('leads')
        .update({
          meeting_at: booking.startTime,
          ...(EARLY_STAGES.includes(lead.stage) ? { stage: 'meeting_booked' } : {}),
        })
        .eq('id', lead.id);
    }

    const what = { created: 'Reserva creada', rescheduled: 'Reserva cambiada', cancelled: 'Reserva cancelada' }[
      booking.event
    ];
    await db.from('lead_events').insert({
      lead_id: lead.id,
      kind: 'booking',
      to_value: booking.startTime,
      detail: `${what} en Cal.com${booking.title ? `: ${booking.title}` : ''}`,
    });
    return json(200, { matched: true, leadId: lead.id });
  } catch (error) {
    console.error('cal-webhook failed', error);
    return json(500, { error: 'server' });
  }
});
