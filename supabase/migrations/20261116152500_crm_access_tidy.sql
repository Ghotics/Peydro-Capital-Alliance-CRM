-- Applied to the Supabase project on 2026-11-16.
-- Small clean-up after Supabase's performance check on 20261116150000_crm_access.sql:
--   * index for lead_notes.author_id
--   * the "owners write" rules were FOR ALL, so they also counted as a second read rule.
--     Split into insert / update / delete. Same access as before.

create index if not exists lead_notes_author_id_idx on public.lead_notes (author_id);

drop policy "partners: owners write" on public.partners;
create policy "partners: owners insert" on public.partners
  for insert to authenticated with check ((select private.is_owner()));
create policy "partners: owners update" on public.partners
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "partners: owners delete" on public.partners
  for delete to authenticated using ((select private.is_owner()));

drop policy "buildings: owners write" on public.buildings;
create policy "buildings: owners insert" on public.buildings
  for insert to authenticated with check ((select private.is_owner()));
create policy "buildings: owners update" on public.buildings
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "buildings: owners delete" on public.buildings
  for delete to authenticated using ((select private.is_owner()));

drop policy "campaigns: owners write" on public.campaigns;
create policy "campaigns: owners insert" on public.campaigns
  for insert to authenticated with check ((select private.is_owner()));
create policy "campaigns: owners update" on public.campaigns
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "campaigns: owners delete" on public.campaigns
  for delete to authenticated using ((select private.is_owner()));
