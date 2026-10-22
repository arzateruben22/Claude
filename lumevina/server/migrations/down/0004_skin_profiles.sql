-- Reverses 0004.
drop table if exists imaging_sites;
drop table if exists imaging_devices;
drop table if exists skin_settings;
drop table if exists client_assignments;
drop policy if exists "clients read their own skin profile" on skin_profiles;
drop function if exists public.my_skin_profile_ids();
drop table if exists skin_profiles;
