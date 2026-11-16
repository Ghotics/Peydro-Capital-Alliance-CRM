-- PCA CRM: who can see what.
-- Applied to the Supabase project on 2026-11-16.
--
-- Rules in short:
--   * Only owners and specialists log in (invite only, no sign-up).
--   * Owners see and change everything.
--   * Specialists see only:
--       - leads of their own department(s) (team_members.areas), and
--       - leads assigned to them (leads.owner_id).
--   * Without a login (anon key) no table can be read or written. The website forms will save leads
--     through the `submit-lead` Edge Function, which uses the server key and skips these rules.
--   * Someone who logs in but has no active row in team_members sees nothing.

-------------------------------------------------------------------------------
-- 1. Department of each lead
--    Business Office leads -> their area (tecnologia, marketing, ...)
--    Giza leads            -> 'giza'
--    Quick-form leads      -> 'quick'
--    These match the values allowed in team_members.areas.
-------------------------------------------------------------------------------
alter table public.leads
  add column department text generated always as (
    case when form = 'business_office' then area else form end
  ) stored;

comment on column public.leads.department is
  'Filled in automatically: area for Business Office leads, otherwise the form (giza / quick). Used by the access rules.';

create index if not exists leads_department_idx on public.leads (department);
create index if not exists leads_owner_id_idx   on public.leads (owner_id);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_campaign_id_idx on public.leads (campaign_id);

-------------------------------------------------------------------------------
-- 2. Notes on a lead (calls, emails, comments)
-------------------------------------------------------------------------------
create table public.lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads (id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.team_members (id),
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
comment on table public.lead_notes is 'Notes the team writes on a lead in the CRM.';
create index lead_notes_lead_id_idx on public.lead_notes (lead_id, created_at);
alter table public.lead_notes enable row level security;

-------------------------------------------------------------------------------
-- 3. Small helper functions about the logged-in person.
--    Kept in a "private" schema so they can't be called through the public API.
-------------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members
    where id = (select auth.uid()) and active
  );
$$;

create or replace function private.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members
    where id = (select auth.uid()) and active and role = 'owner'
  );
$$;

create or replace function private.my_areas()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select areas from public.team_members where id = (select auth.uid()) and active),
    '{}'::text[]
  );
$$;

revoke all on function private.is_member(), private.is_owner(), private.my_areas() from public, anon;
grant execute on function private.is_member(), private.is_owner(), private.my_areas() to authenticated;

-------------------------------------------------------------------------------
-- 4. Table permissions: visitors get nothing, logged-in users get the basics.
-------------------------------------------------------------------------------
revoke all on public.partners, public.buildings, public.campaigns, public.scans,
              public.team_members, public.leads, public.lead_notes
  from anon;
revoke truncate, references, trigger on public.partners, public.buildings, public.campaigns,
              public.scans, public.team_members, public.leads, public.lead_notes
  from authenticated;
grant select, insert, update, delete on public.lead_notes to authenticated;

-------------------------------------------------------------------------------
-- 5. Access rules (RLS policies)
-------------------------------------------------------------------------------

-- team_members: everyone on the team can see the team list; only owners change it.
create policy "team: members read" on public.team_members
  for select to authenticated using ((select private.is_member()));
create policy "team: owners insert" on public.team_members
  for insert to authenticated with check ((select private.is_owner()));
create policy "team: owners update" on public.team_members
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "team: owners delete" on public.team_members
  for delete to authenticated using ((select private.is_owner()));

-- partners / buildings / campaigns: the team reads them (names shown on leads); owners manage them.
create policy "partners: members read" on public.partners
  for select to authenticated using ((select private.is_member()));
create policy "partners: owners write" on public.partners
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

create policy "buildings: members read" on public.buildings
  for select to authenticated using ((select private.is_member()));
create policy "buildings: owners write" on public.buildings
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

create policy "campaigns: members read" on public.campaigns
  for select to authenticated using ((select private.is_member()));
create policy "campaigns: owners write" on public.campaigns
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

-- scans: only owners (for the analytics page later). Scans are saved by the Edge Function.
create policy "scans: owners read" on public.scans
  for select to authenticated using ((select private.is_owner()));

-- leads: owners everything; specialists their department(s) + leads assigned to them.
create policy "leads: read" on public.leads
  for select to authenticated using (
    (select private.is_owner())
    or ((select private.is_member())
        and (owner_id = (select auth.uid()) or department = any ((select private.my_areas())::text[])))
  );
create policy "leads: insert" on public.leads
  for insert to authenticated with check (
    (select private.is_owner())
    or ((select private.is_member())
        and (owner_id = (select auth.uid()) or department = any ((select private.my_areas())::text[])))
  );
-- A specialist can update a lead they can see, and the lead must still be theirs to see afterwards
-- (so they can't move it to a department that isn't theirs).
create policy "leads: update" on public.leads
  for update to authenticated
  using (
    (select private.is_owner())
    or ((select private.is_member())
        and (owner_id = (select auth.uid()) or department = any ((select private.my_areas())::text[])))
  )
  with check (
    (select private.is_owner())
    or ((select private.is_member())
        and (owner_id = (select auth.uid()) or department = any ((select private.my_areas())::text[])))
  );
create policy "leads: owners delete" on public.leads
  for delete to authenticated using ((select private.is_owner()));

-- lead_notes: visible when the lead is visible (the leads rule above is applied inside the check).
create policy "notes: read" on public.lead_notes
  for select to authenticated using (
    exists (select 1 from public.leads l where l.id = lead_id)
  );
create policy "notes: add" on public.lead_notes
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.leads l where l.id = lead_id)
  );
create policy "notes: author or owner deletes" on public.lead_notes
  for delete to authenticated using (
    author_id = (select auth.uid()) or (select private.is_owner())
  );
