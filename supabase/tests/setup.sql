-- Test setup: a minimal copy of what Supabase provides (roles anon/authenticated, auth.uid())
-- plus the PCA tables as they were created in the dashboard BEFORE the files in ../migrations.
-- Used by .github/workflows/checks.yml: setup.sql -> every migration in order -> access_test.sql.
-- auth.uid() reads the setting request.jwt.claim.sub, so a test can "log in" with:
--   set role authenticated; set request.jwt.claim.sub = '<user id>';
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$; do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;

create table public.partners (id uuid primary key default gen_random_uuid(), name varchar check (length(name) < 30), created_at timestamptz default now());
create table public.buildings (id uuid primary key default gen_random_uuid(), partner_id uuid not null references public.partners(id), name varchar not null, created_at timestamptz default now());
create table public.campaigns (id uuid primary key default gen_random_uuid(), building_id uuid references public.buildings(id), code text unique not null, form text not null check (form in ('giza','business_office','quick')), name text not null, active boolean default true, created_at timestamptz default now());
create table public.scans (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns(id), scanned_at timestamptz default now());
create table public.team_members (id uuid primary key references auth.users(id), name varchar not null, cal_link text, role text not null default 'specialist' check (role in ('owner','specialist')), areas text[] not null default '{}', active boolean not null default true, created_at timestamptz default now());
create table public.leads (
  id uuid primary key default gen_random_uuid(), campaign_id uuid references public.campaigns(id), building_id uuid references public.buildings(id),
  owner_id uuid references public.team_members(id), stage text not null default 'new', created_at timestamptz default now(),
  form text not null check (form in ('giza','business_office','quick')), area text, interests text[] default '{}',
  first_name text not null, last_name text not null, email text not null, phone text not null, unit text, message text,
  utm jsonb default '{}', page text, privacy_accepted_at timestamptz not null default now(), meeting_at timestamptz,
  lost_reason text, deal_value_eur numeric, updated_at timestamptz default now());
alter table public.partners enable row level security; alter table public.buildings enable row level security;
alter table public.campaigns enable row level security; alter table public.scans enable row level security;
alter table public.team_members enable row level security; alter table public.leads enable row level security;

-- updated_at, as in the live project
create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();
