-- NOT APPLIED YET — waiting for review (pull request "CRM next stage").
--
-- 1. Lead history: every lead keeps a log of what happened (created, stage, person in charge, meeting, Cal.com).
-- 2. Numbers for the Analytics page, counted in the database (and still following the access rules).
-- 3. Team safety: there must always be at least one active owner.
-- 4. A partner can't have two buildings with the same name.

-------------------------------------------------------------------------------
-- 1. Lead history
-------------------------------------------------------------------------------
create table public.lead_events (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads (id) on delete cascade,
  /** Team member who did it; empty = done automatically (website, auto-assignment, Cal.com). */
  actor_id   uuid references public.team_members (id) on delete set null,
  kind       text not null check (kind in ('created', 'stage', 'owner', 'meeting', 'booking')),
  from_value text,
  to_value   text,
  detail     text,
  created_at timestamptz not null default now()
);
comment on table public.lead_events is 'History of each lead. Written only by database rules and server functions.';
create index lead_events_lead_id_idx on public.lead_events (lead_id, created_at);
create index lead_events_actor_id_idx on public.lead_events (actor_id);
alter table public.lead_events enable row level security;

-- Visible when the lead is visible. Nobody writes it from the app: only the rules below and server functions.
create policy "events: read" on public.lead_events
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
revoke all on public.lead_events from anon;
revoke all on public.lead_events from authenticated;
grant select on public.lead_events to authenticated;

/** The logged-in person if they are on the team, otherwise null (website, server functions). */
create or replace function private.current_member()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.team_members where id = (select auth.uid());
$$;

create or replace function private.log_lead_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.lead_events (lead_id, actor_id, kind, to_value, detail)
  values (new.id, private.current_member(), 'created', new.owner_id::text,
          case when (select auth.uid()) is null then 'web' else 'crm' end);
  return null;
end;
$$;

create or replace function private.log_lead_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  who uuid := private.current_member();
begin
  if new.stage is distinct from old.stage then
    insert into public.lead_events (lead_id, actor_id, kind, from_value, to_value)
    values (new.id, who, 'stage', old.stage, new.stage);
  end if;
  if new.owner_id is distinct from old.owner_id then
    insert into public.lead_events (lead_id, actor_id, kind, from_value, to_value)
    values (new.id, who, 'owner', old.owner_id::text, new.owner_id::text);
  end if;
  if new.meeting_at is distinct from old.meeting_at then
    insert into public.lead_events (lead_id, actor_id, kind, from_value, to_value)
    values (new.id, who, 'meeting', old.meeting_at::text, new.meeting_at::text);
  end if;
  return null;
end;
$$;

revoke all on function private.current_member(), private.log_lead_created(), private.log_lead_changes()
  from public, anon, authenticated;

create trigger leads_log_created after insert on public.leads
  for each row execute function private.log_lead_created();
create trigger leads_log_changes after update on public.leads
  for each row execute function private.log_lead_changes();

-------------------------------------------------------------------------------
-- 2. Numbers for the Analytics page (security_invoker: same access rules as the tables)
-------------------------------------------------------------------------------

-- Leads per week (Monday, Madrid time) and department.
create view public.lead_weekly_stats with (security_invoker = true) as
select
  (date_trunc('week', created_at at time zone 'Europe/Madrid'))::date as week,
  department,
  count(*)::int as total,
  count(*) filter (where stage = 'won')::int as won
from public.leads
group by 1, 2;

-- First time a person on the team did something with each lead (a change or a note).
create view public.lead_response_times with (security_invoker = true) as
select
  l.id as lead_id,
  l.department,
  l.owner_id,
  l.created_at,
  least(
    (select min(e.created_at) from public.lead_events e
      where e.lead_id = l.id and e.actor_id is not null and e.kind <> 'created'),
    (select min(n.created_at) from public.lead_notes n where n.lead_id = l.id)
  ) as first_touch_at
from public.leads l;

-- Average and median hours until that first touch, per department, leads of the last 90 days.
create view public.response_time_stats with (security_invoker = true) as
select
  department,
  count(*)::int as leads,
  count(first_touch_at)::int as touched,
  round((avg(extract(epoch from first_touch_at - created_at)) / 3600)::numeric, 1) as avg_hours,
  round((percentile_cont(0.5) within group (order by extract(epoch from first_touch_at - created_at)) / 3600)::numeric, 1)
    as median_hours
from public.lead_response_times
where created_at > now() - interval '90 days'
group by department;

revoke all on public.lead_weekly_stats, public.lead_response_times, public.response_time_stats from anon, authenticated;
grant select on public.lead_weekly_stats, public.lead_response_times, public.response_time_stats to authenticated;

-------------------------------------------------------------------------------
-- 3. Always at least one active owner
-------------------------------------------------------------------------------
create or replace function private.keep_one_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and old.active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.active)
     and not exists (
       select 1 from public.team_members
       where id <> old.id and role = 'owner' and active
     ) then
    raise exception 'Debe quedar al menos una persona de dirección activa.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function private.keep_one_owner() from public, anon, authenticated;

create trigger team_keep_one_owner before update or delete on public.team_members
  for each row execute function private.keep_one_owner();

-------------------------------------------------------------------------------
-- 4. One building name per partner
-------------------------------------------------------------------------------
alter table public.buildings add constraint buildings_partner_name_key unique (partner_id, name);
