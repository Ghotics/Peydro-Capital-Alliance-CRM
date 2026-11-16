-- Removes the fake data added on 2026-11-16 to try the CRM.
-- Run it in Supabase → SQL Editor before real leads start coming in.
-- Only touches rows marked as demo (utm.demo = 'true', campaign codes starting with "demo-",
-- partner "Renta 92 (demo)"). Notes on those leads are removed with them.

begin;

delete from public.leads where utm ->> 'demo' = 'true';
delete from public.scans where campaign_id in (select id from public.campaigns where code like 'demo-%');
delete from public.campaigns where code like 'demo-%';
delete from public.buildings
  where partner_id in (select id from public.partners where name = 'Renta 92 (demo)');
delete from public.partners where name = 'Renta 92 (demo)';

commit;
