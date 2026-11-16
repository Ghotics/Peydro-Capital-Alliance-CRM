/* website-intake: the only door from the public website into the database.
     POST …/functions/v1/website-intake/lead   a form was sent      -> { leadId }
     POST …/functions/v1/website-intake/scan   someone arrived with ?c=<code> (QR / link) -> 204
   It runs with the server key, so it can write even though the tables are closed to the public.
   It only answers the website's own address (ALLOWED_ORIGINS).
   After saving a lead it sends the notifications (../_shared/notify.ts) in the background. */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, isAllowed, originOf, reply, type Headers } from '../_shared/cors.ts';
import { inBackground } from '../_shared/env.ts';
import { notifyLead } from '../_shared/notify.ts';
import { checkLead, checkScan, tooMany } from './validate.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAX_BODY = 20_000;
/** The same person sending the same form again within this time gets the same lead back (double clicks, retries). */
const DUPLICATE_MINUTES = 5;

async function saveLead(body: unknown, ip: string, headers: Headers): Promise<Response> {
  if (tooMany(`lead:${ip}`, 10, 10)) return reply(429, { error: 'too_many' }, headers);

  const result = checkLead(body);
  if (!result.ok) return reply(400, { error: 'invalid', fields: result.fields }, headers);
  const lead = result.lead;

  /* Same person + same form (+ department) a moment ago: hand back that lead instead of a copy. */
  let dupQuery = db
    .from('leads')
    .select('id')
    .eq('email', lead.email)
    .eq('form', lead.form)
    .gte('created_at', new Date(Date.now() - DUPLICATE_MINUTES * 60_000).toISOString());
  dupQuery = lead.area ? dupQuery.eq('area', lead.area) : dupQuery.is('area', null);
  const { data: dup, error: dupError } = await dupQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (dupError) throw dupError;
  if (dup) return reply(200, { leadId: dup.id }, headers);

  const utm: Record<string, string> = { ...lead.utm };

  /* Campaign from the QR / link code. Unknown codes are kept in utm so nothing is lost. */
  let campaignId: string | null = null;
  let campaignBuildingId: string | null = null;
  if (lead.campaign) {
    const { data: campaign, error } = await db
      .from('campaigns')
      .select('id, building_id')
      .eq('code', lead.campaign)
      .maybeSingle();
    if (error) throw error;
    if (campaign) {
      campaignId = campaign.id;
      campaignBuildingId = campaign.building_id;
    } else {
      utm.codigo_desconocido = lead.campaign;
    }
  }

  /* Building: the one the visitor picked ("14"), otherwise the campaign's. Demo buildings are skipped. */
  let buildingId: string | null = null;
  if (lead.building) {
    const { data: buildings, error } = await db.from('buildings').select('id, partner:partners(name)').eq('name', lead.building);
    if (error) throw error;
    const real = (buildings ?? []).filter(
      (b: { partner: { name: string } | null }) => !/\(demo\)/i.test(b.partner?.name ?? ''),
    );
    if (real.length === 1) buildingId = real[0].id;
    else utm.edificio = lead.building;
  }
  buildingId ??= campaignBuildingId;

  const { data, error } = await db
    .from('leads')
    .insert({
      form: lead.form,
      area: lead.area,
      interests: lead.interests,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      unit: lead.unit,
      message: lead.message,
      utm,
      page: lead.page,
      campaign_id: campaignId,
      building_id: buildingId,
      privacy_accepted_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  /* Emails / WhatsApp after answering, so the visitor never waits for them. */
  inBackground(notifyLead(db, data.id, { reason: 'new' }));
  return reply(200, { leadId: data.id }, headers);
}

async function saveScan(body: unknown, ip: string, headers: Headers): Promise<Response> {
  /* Too many from one visitor: say OK but don't count them (keeps the numbers honest). */
  if (tooMany(`scan:${ip}`, 30, 10)) return reply(204, null, headers);
  const code = checkScan(body);
  if (!code) return reply(204, null, headers);
  const { data: campaign, error } = await db.from('campaigns').select('id').eq('code', code).maybeSingle();
  if (error) throw error;
  if (campaign) {
    const { error: insertError } = await db.from('scans').insert({ campaign_id: campaign.id });
    if (insertError) throw insertError;
  }
  return reply(204, null, headers);
}

Deno.serve(async (req) => {
  const origin = originOf(req);
  const headers = corsHeaders(origin);
  const allowed = isAllowed(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers });
  if (req.method !== 'POST') return reply(405, { error: 'method' }, headers);
  if (!allowed) return reply(403, { error: 'origin' }, headers);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return reply(413, { error: 'too_large' }, headers);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'json' }, headers);
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const path = new URL(req.url).pathname.replace(/\/+$/, '');

  try {
    if (path.endsWith('/lead')) return await saveLead(body, ip, headers);
    if (path.endsWith('/scan')) return await saveScan(body, ip, headers);
    return reply(404, { error: 'not_found' }, headers);
  } catch (error) {
    console.error('website-intake failed', error);
    return reply(500, { error: 'server' }, headers);
  }
});
