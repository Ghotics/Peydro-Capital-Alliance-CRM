-- NOT APPLIED YET — waiting for review (pull request "Assign new leads to their department's specialist").
--
-- Every new lead gets a person in charge (leads.owner_id) automatically, from its department:
--   Business Office -> the area picked in the form (planificacion-financiera, tecnologia, …)
--   Giza form       -> 'giza'
--   Quick form      -> 'quick'
-- The person is an ACTIVE team member whose `areas` include that department (owners too, if they have it).
-- If several people share a department, the one with the fewest open leads gets it (fair split).
-- If nobody has that department, the lead stays "Sin asignar" and the owners see it as always.
-- A lead that already comes with a person in charge (e.g. created by hand in the CRM) is left alone.

create or replace function private.auto_assign_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dep text;
  chosen uuid;
begin
  if new.owner_id is not null then
    return new;
  end if;

  -- Same rule as the generated column leads.department (not filled in yet at this point).
  dep := case when new.form = 'business_office' then new.area else new.form end;
  if dep is null then
    return new;
  end if;

  select tm.id into chosen
  from public.team_members tm
  where tm.active and dep = any (tm.areas)
  order by
    (select count(*) from public.leads l
      where l.owner_id = tm.id
        and l.stage in ('new', 'contacted', 'qualified', 'meeting_booked', 'proposal_sent')),
    tm.created_at
  limit 1;

  new.owner_id := chosen;  -- stays null when nobody has this department
  return new;
end;
$$;

revoke all on function private.auto_assign_lead() from public, anon, authenticated;

create trigger leads_auto_assign
  before insert on public.leads
  for each row execute function private.auto_assign_lead();
