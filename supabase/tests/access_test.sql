-- Automatic checks of the access rules and the database behaviour.
-- Run after setup.sql and every migration. Any failed check stops the run with its message.
\set ON_ERROR_STOP on
\set QUIET on

-- "Log in" as someone (or nobody) inside a check.
create function pg_temp.login(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
  execute 'set role authenticated';
end $$;
create function pg_temp.visitor() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;
create function pg_temp.server() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

-- People: a owner · b Tecnología · c Marketing · d inactive (tecnologia) · e logged in, not on the team · f Irene
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),
 ('00000000-0000-0000-0000-00000000000c'),('00000000-0000-0000-0000-00000000000d'),
 ('00000000-0000-0000-0000-00000000000e'),('00000000-0000-0000-0000-00000000000f');
insert into public.team_members (id, name, role, areas, active) values
 ('00000000-0000-0000-0000-00000000000a', 'Owner', 'owner', '{}', true),
 ('00000000-0000-0000-0000-00000000000b', 'Tecnología', 'specialist', '{tecnologia}', true),
 ('00000000-0000-0000-0000-00000000000c', 'Marketing', 'specialist', '{marketing}', true),
 ('00000000-0000-0000-0000-00000000000d', 'Inactive', 'specialist', '{tecnologia}', false),
 ('00000000-0000-0000-0000-00000000000f', 'Irene', 'specialist', '{giza,planificacion-financiera}', true);

-- Leads as the website function saves them (server key, nobody logged in).
insert into public.leads (id, form, area, first_name, last_name, email, phone) values
 ('10000000-0000-0000-0000-000000000001', 'business_office', 'tecnologia', 'Tec', 'x', 'a@b.co', '600000000'),
 ('10000000-0000-0000-0000-000000000002', 'business_office', 'marketing', 'Mkt', 'x', 'a@b.co', '600000000'),
 ('10000000-0000-0000-0000-000000000003', 'giza', null, 'Giza', 'x', 'a@b.co', '600000000'),
 ('10000000-0000-0000-0000-000000000004', 'quick', null, 'Quick', 'x', 'a@b.co', '600000000'),
 ('10000000-0000-0000-0000-000000000005', 'business_office', 'consulta', 'Consulta', 'x', 'a@b.co', '600000000'),
 ('10000000-0000-0000-0000-000000000006', 'business_office', 'planificacion-financiera', 'Finanzas', 'x', 'a@b.co', '600000000');

\echo 'auto-assignment'
do $$ begin
  assert (select owner_id from public.leads where first_name = 'Tec') = '00000000-0000-0000-0000-00000000000b', 'Tecnología lead -> Tecnología';
  assert (select owner_id from public.leads where first_name = 'Mkt') = '00000000-0000-0000-0000-00000000000c', 'Marketing lead -> Marketing';
  assert (select owner_id from public.leads where first_name = 'Giza') = '00000000-0000-0000-0000-00000000000f', 'Giza lead -> Irene';
  assert (select owner_id from public.leads where first_name = 'Finanzas') = '00000000-0000-0000-0000-00000000000f', 'Finanzas lead -> Irene';
  assert (select owner_id from public.leads where first_name = 'Quick') is null, 'Quick lead stays unassigned';
  assert (select owner_id from public.leads where first_name = 'Consulta') is null, 'Consulta lead stays unassigned';
end $$;

\echo 'who sees which leads'
do $$ begin
  perform pg_temp.login('00000000-0000-0000-0000-00000000000a');
  assert (select count(*) from public.leads) = 6, 'owner sees every lead';
  perform pg_temp.login('00000000-0000-0000-0000-00000000000b');
  assert (select string_agg(first_name, ',' order by first_name) from public.leads) = 'Tec', 'Tecnología sees only its lead';
  perform pg_temp.login('00000000-0000-0000-0000-00000000000f');
  assert (select string_agg(first_name, ',' order by first_name) from public.leads) = 'Finanzas,Giza', 'Irene sees Giza + Finanzas';
  perform pg_temp.login('00000000-0000-0000-0000-00000000000d');
  assert (select count(*) from public.leads) = 0, 'inactive person sees nothing';
  perform pg_temp.login('00000000-0000-0000-0000-00000000000e');
  assert (select count(*) from public.leads) = 0, 'logged in but not on the team sees nothing';
  assert (select count(*) from public.team_members) = 0, 'not on the team: no team list';
  perform pg_temp.server();
end $$;

do $$ declare blocked boolean := false; begin
  perform pg_temp.visitor();
  begin perform count(*) from public.leads; exception when insufficient_privilege then blocked := true; end;
  perform pg_temp.server();
  assert blocked, 'visitors cannot read leads';
end $$;

\echo 'changes by a specialist'
do $$ declare n int; failed boolean := false; begin
  perform pg_temp.login('00000000-0000-0000-0000-00000000000b');
  update public.leads set stage = 'contacted' where first_name = 'Tec';
  get diagnostics n = row_count; assert n = 1, 'specialist updates own lead';
  update public.leads set stage = 'contacted' where first_name = 'Mkt';
  get diagnostics n = row_count; assert n = 0, 'specialist cannot touch another department';
  -- A Tecnología lead assigned to someone else: Tecnología sees it (department) but cannot send it away.
  perform pg_temp.server();
  insert into public.leads (id, form, area, first_name, last_name, email, phone, owner_id) values
   ('10000000-0000-0000-0000-000000000007', 'business_office', 'tecnologia', 'Tec2', 'x', 'a@b.co', '600000000',
    '00000000-0000-0000-0000-00000000000a');
  perform pg_temp.login('00000000-0000-0000-0000-00000000000b');
  begin
    update public.leads set area = 'marketing' where first_name = 'Tec2';
  exception when insufficient_privilege then failed := true; end;
  assert failed, 'specialist cannot move a department lead to another department';
  update public.team_members set role = 'owner' where id = '00000000-0000-0000-0000-00000000000b';
  get diagnostics n = row_count; assert n = 0, 'specialist cannot make themselves owner';
  perform pg_temp.server();
end $$;

\echo 'lead history'
do $$ declare failed boolean := false; begin
  assert exists (select 1 from public.lead_events where lead_id = '10000000-0000-0000-0000-000000000001'
                 and kind = 'created' and detail = 'web' and to_value = '00000000-0000-0000-0000-00000000000b'),
         'created event from the website, with the assigned person';
  assert exists (select 1 from public.lead_events where lead_id = '10000000-0000-0000-0000-000000000001'
                 and kind = 'stage' and from_value = 'new' and to_value = 'contacted'
                 and actor_id = '00000000-0000-0000-0000-00000000000b'),
         'stage change logged with who did it';
  perform pg_temp.login('00000000-0000-0000-0000-00000000000b');
  assert (select count(*) from public.lead_events where lead_id = '10000000-0000-0000-0000-000000000002') = 0,
         'history of other departments is hidden';
  begin
    insert into public.lead_events (lead_id, kind) values ('10000000-0000-0000-0000-000000000001', 'stage');
  exception when insufficient_privilege then failed := true; end;
  assert failed, 'nobody writes history by hand';
  perform pg_temp.server();
end $$;

\echo 'notes'
do $$ declare failed boolean := false; begin
  perform pg_temp.login('00000000-0000-0000-0000-00000000000b');
  insert into public.lead_notes (lead_id, body) values ('10000000-0000-0000-0000-000000000001', 'Llamado');
  begin
    insert into public.lead_notes (lead_id, body) values ('10000000-0000-0000-0000-000000000002', 'x');
  exception when insufficient_privilege then failed := true; end;
  assert failed, 'no notes on leads of other departments';
  perform pg_temp.server();
end $$;

\echo 'analytics numbers'
do $$ declare failed boolean := false; begin
  perform pg_temp.login('00000000-0000-0000-0000-00000000000a');
  assert (select sum(total) from public.lead_weekly_stats) = 7, 'owner: weekly totals count every lead';
  assert (select touched from public.response_time_stats where department = 'tecnologia') = 1, 'first touch counted';
  perform pg_temp.login('00000000-0000-0000-0000-00000000000b');
  assert (select sum(total) from public.lead_weekly_stats) = 2, 'specialist: only their leads are counted';
  perform pg_temp.visitor();
  begin perform count(*) from public.lead_weekly_stats; exception when insufficient_privilege then failed := true; end;
  perform pg_temp.server();
  assert failed, 'visitors get no numbers';
end $$;

\echo 'team safety'
do $$ declare failed boolean := false; begin
  perform pg_temp.login('00000000-0000-0000-0000-00000000000a');
  begin
    update public.team_members set role = 'specialist' where id = '00000000-0000-0000-0000-00000000000a';
  exception when raise_exception then failed := true; end;
  assert failed, 'the last active owner cannot stop being owner';
  update public.team_members set areas = '{consulta,quick}' where id = '00000000-0000-0000-0000-00000000000b';
  assert (select areas from public.team_members where id = '00000000-0000-0000-0000-00000000000b') = '{consulta,quick}',
         'owners change departments';
  perform pg_temp.server();
end $$;

do $$ declare failed boolean := false; p uuid; begin
  insert into public.partners (name) values ('Test') returning id into p;
  insert into public.buildings (partner_id, name) values (p, '14');
  begin insert into public.buildings (partner_id, name) values (p, '14'); exception when unique_violation then failed := true; end;
  assert failed, 'no duplicate building names per partner';
end $$;

\echo 'ALL CHECKS PASSED'
