-- Applied to the Supabase project on 2026-11-16.
-- Totals per campaign for the CRM, counted in the database (the API only returns 1000 rows at a time).
-- security_invoker = the access rules of leads / scans still apply:
--   owners count everything; specialists only count the leads they can see and get no scan numbers.

create view public.campaign_lead_stats with (security_invoker = true) as
select
  campaign_id,
  count(*)::int as total,
  count(*) filter (where stage in ('new', 'contacted', 'qualified', 'meeting_booked', 'proposal_sent'))::int as open,
  count(*) filter (where stage = 'won')::int as won,
  coalesce(sum(deal_value_eur) filter (where stage = 'won'), 0)::numeric as won_value
from public.leads
where campaign_id is not null
group by campaign_id;

create view public.campaign_scan_stats with (security_invoker = true) as
select
  campaign_id,
  count(*)::int as total,
  count(*) filter (where scanned_at > now() - interval '7 days')::int as last_7_days
from public.scans
group by campaign_id;

comment on view public.campaign_lead_stats is 'Leads per campaign (respects the leads access rules).';
comment on view public.campaign_scan_stats is 'QR / link arrivals per campaign (owners only, like scans).';

revoke all on public.campaign_lead_stats, public.campaign_scan_stats from anon;
revoke all on public.campaign_lead_stats, public.campaign_scan_stats from authenticated;
grant select on public.campaign_lead_stats, public.campaign_scan_stats to authenticated;
