-- 0009 · Progress reports and the client's data requests
--
-- progress_reports: a report the practitioner prepares and approves. `content`
--   is exactly what the client will see (measurements she verified, the
--   images she chose, her summary lines), frozen at approval, so a later
--   re-analysis never changes a report they already have. Clients read their
--   own approved reports.
-- data_requests: a client asking for a copy of their data or for it to be
--   deleted; an admin completes it (skin-intelligence/PRIVACY-SECURITY.md).

create table progress_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references skin_profiles (id) on delete cascade,
  title text not null,
  period_from date,
  period_to date,
  session_ids uuid[] not null default '{}',
  content jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'withdrawn')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  withdrawn_at timestamptz
);
create index progress_reports_profile on progress_reports (profile_id, created_at desc);
alter table progress_reports enable row level security;
create policy "clients read their own approved reports" on progress_reports
  for select using (status = 'approved' and profile_id in (select public.my_skin_profile_ids()));

create or replace function public.progress_reports_guard() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('lumevina.purge', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if old.status = 'draft' then return old; end if;
    raise exception 'an approved report is kept' using errcode = '42501';
  end if;
  if old.status = 'approved' and (new.content <> old.content or new.title <> old.title) then
    raise exception 'an approved report cannot change; withdraw it and approve a new one' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger progress_reports_guard before update or delete on progress_reports
  for each row execute function public.progress_reports_guard();

create table data_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  profile_id uuid references skin_profiles (id) on delete set null,
  kind text not null check (kind in ('export', 'delete')),
  status text not null default 'open' check (status in ('open', 'done', 'declined')),
  note text,                            -- the client's words
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  resolution text                       -- what was done (or why not: a record the law requires keeping)
);
create index data_requests_open on data_requests (requested_at) where status = 'open';
alter table data_requests enable row level security;
create policy "clients read their own data requests" on data_requests
  for select using (email = lower(auth.jwt() ->> 'email'));

-- Completing a deletion request: removes the client's images and everything
-- derived from them, their routine, check-ins and reports, and clears the
-- profile's free text. Signed treatment records are kept when the clinic's
-- retention rule requires it (p_keep_treatments); consents and the audit log
-- are kept as the record of what was agreed and done. Returns the storage
-- paths the caller must then remove from the skin-images bucket.
create or replace function public.purge_skin_profile(p_profile uuid, p_keep_treatments boolean default true)
returns table (path text) language plpgsql security definer set search_path = public as $$
begin
  perform set_config('lumevina.purge', 'on', true);
  return query
    select c.original_path from captures c where c.profile_id = p_profile
    union all
    select d.path from derived_images d join captures c on c.id = d.capture_id where c.profile_id = p_profile;
  delete from change_detections where profile_id = p_profile;
  delete from measurements where profile_id = p_profile;
  delete from analyses where profile_id = p_profile;
  delete from captures where profile_id = p_profile;
  delete from imaging_sites where profile_id = p_profile;
  delete from imaging_sessions where profile_id = p_profile;
  delete from recovery_checkins where profile_id = p_profile;
  delete from routine_checkins where profile_id = p_profile;
  delete from routine_entries where profile_id = p_profile;
  delete from progress_reports where profile_id = p_profile;
  if not p_keep_treatments then
    delete from treatment_records where profile_id = p_profile;
  end if;
  update skin_profiles
     set status = 'deleted', name = null, goals = null, concerns = '{}', skin_history = null, sensitivities = null,
         current_products = null, prior_procedures = null, contraindications = '[]'::jsonb, privacy = '{}'::jsonb, updated_at = now()
   where id = p_profile;
end $$;
revoke all on function public.purge_skin_profile(uuid, boolean) from public, anon, authenticated;
