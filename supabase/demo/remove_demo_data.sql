-- Removes the fake data added on 2026-11-16 to try the CRM.
-- Run it in Supabase → SQL Editor before real leads start coming in.
-- Only touches rows marked as demo (utm.demo = 'true', campaign codes starting with "demo-",
-- partner "Renta 92 (demo)"), the 3 test leads sent through the live forms on 2026-11-16
-- (emails prueba.*@example.com) and any other lead linked to a demo campaign.
-- Notes on those leads are removed with them.

begin;

delete from public.leads
  where utm ->> 'demo' = 'true'
     or email like 'prueba.%@example.com'
     or campaign_id in (select id from public.campaigns where code like 'demo-%');
delete from public.scans where campaign_id in (select id from public.campaigns where code like 'demo-%');
delete from public.campaigns where code like 'demo-%';
delete from public.buildings
  where partner_id in (select id from public.partners where name = 'Renta 92 (demo)');
delete from public.partners where name = 'Renta 92 (demo)';

commit;
