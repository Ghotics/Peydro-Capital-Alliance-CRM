/* crm-actions: things the CRM can't do with the normal database rules, because they need the server key.
   Only for people logged in to the CRM (checked here, with their login token).
     POST /team/create    owners: create a login + add the person to the team
                          { email, name, role, areas, invite }  -> { id, tempPassword? }
     POST /team/password  owners: give someone a new temporary password { id } -> { tempPassword }
     POST /team/emails    owners: the login email of each team member -> { emails: { [id]: email } }
     POST /notify         anyone on the team: email the person now in charge of a lead { leadId }
   "invite: true" sends Supabase's invitation email (needs email set up in Supabase → Authentication → SMTP);
   otherwise a temporary password is returned once, to pass on privately. */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, isAllowed, originOf, reply } from '../_shared/cors.ts';
import { crmUrl } from '../_shared/env.ts';
import { notifyLead } from '../_shared/notify.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const AREAS = ['giza', 'planificacion-financiera', 'tecnologia', 'telecomunicaciones', 'marketing', 'consulta', 'quick'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 12 characters, without look-alikes (0/O, 1/l/I). */
function tempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}

interface Caller {
  id: string;
  role: 'owner' | 'specialist';
}

/** Who is calling, from their CRM login. Null = not logged in or not an active team member. */
async function caller(req: Request): Promise<Caller | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: member } = await db.from('team_members').select('id, role, active').eq('id', data.user.id).maybeSingle();
  return member?.active ? { id: member.id, role: member.role } : null;
}

Deno.serve(async (req) => {
  const origin = originOf(req);
  const headers = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: isAllowed(origin) ? 204 : 403, headers });
  if (req.method !== 'POST') return reply(405, { error: 'method' }, headers);

  const who = await caller(req);
  if (!who) return reply(401, { error: 'login' }, headers);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    /* empty body is fine for some actions */
  }
  const path = new URL(req.url).pathname.replace(/\/+$/, '');

  try {
    if (path.endsWith('/notify')) {
      const leadId = String(body.leadId ?? '');
      if (!UUID.test(leadId)) return reply(400, { error: 'invalid' }, headers);
      const result = await notifyLead(db, leadId, { reason: 'assigned', skipUserId: who.id });
      return reply(200, result, headers);
    }

    if (who.role !== 'owner') return reply(403, { error: 'owners_only' }, headers);

    if (path.endsWith('/team/create')) {
      const email = String(body.email ?? '').trim().toLowerCase();
      const name = String(body.name ?? '').trim();
      const role = body.role === 'owner' ? 'owner' : 'specialist';
      const areas = Array.isArray(body.areas) ? [...new Set(body.areas.filter((a) => AREAS.includes(String(a))))] : [];
      if (!EMAIL.test(email) || name.length < 1 || name.length > 60) {
        return reply(400, { error: 'invalid', fields: [!EMAIL.test(email) ? 'email' : 'name'] }, headers);
      }

      let userId: string;
      let password: string | undefined;
      if (body.invite === true) {
        const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: crmUrl() });
        if (error) return reply(400, { error: 'auth', message: error.message }, headers);
        userId = data.user.id;
      } else {
        password = tempPassword();
        const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) return reply(400, { error: 'auth', message: error.message }, headers);
        userId = data.user.id;
      }

      const { error: teamError } = await db.from('team_members').insert({ id: userId, name, role, areas, active: true });
      if (teamError) {
        await db.auth.admin.deleteUser(userId); // don't leave a login without a team row
        return reply(400, { error: 'team', message: teamError.message }, headers);
      }
      return reply(200, { id: userId, tempPassword: password }, headers);
    }

    if (path.endsWith('/team/password')) {
      const id = String(body.id ?? '');
      if (!UUID.test(id)) return reply(400, { error: 'invalid' }, headers);
      const password = tempPassword();
      const { error } = await db.auth.admin.updateUserById(id, { password });
      if (error) return reply(400, { error: 'auth', message: error.message }, headers);
      return reply(200, { tempPassword: password }, headers);
    }

    if (path.endsWith('/team/emails')) {
      const { data: team } = await db.from('team_members').select('id');
      const emails: Record<string, string> = {};
      for (const member of team ?? []) {
        const { data } = await db.auth.admin.getUserById(member.id);
        if (data?.user?.email) emails[member.id] = data.user.email;
      }
      return reply(200, { emails }, headers);
    }

    return reply(404, { error: 'not_found' }, headers);
  } catch (error) {
    console.error('crm-actions failed', error);
    return reply(500, { error: 'server' }, headers);
  }
});
