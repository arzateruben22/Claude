-- 0004 · Skin profiles, practitioner assignments, imaging devices, repeatable sites
--
-- skin_profiles: one per enrolled client, the permanent longitudinal record.
--   Keyed by its own id; linked to clients (once they sign in) and to their
--   email (contacts, bookings, orders all key on it). A practitioner can
--   enroll a client before they ever sign in; the link fills on sign-in.
--   It is separate from client_profiles (what the client tells the chat),
--   which stays as it is.
-- client_assignments: which practitioners may open which clients. At a solo
--   studio skin_settings.assignment_mode = 'all' and every active
--   practitioner sees every enrolled client; switch to 'assigned' the day a
--   second practitioner joins and only assigned clients open.
-- imaging_devices: each camera, microscope or dermatoscope, with its
--   calibration (micrometres per pixel, how and when it was measured) and
--   lighting. Advertised magnification is not calibration.
-- imaging_sites: practitioner-defined places to photograph again and again
--   ("left jaw, the scar by the ear"), so visits line up.

create table skin_profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  client_id uuid unique references clients (id) on delete set null,
  name text,
  goals text,
  concerns text[] not null default '{}',
  skin_history text,
  sensitivities text,                   -- known sensitivities and allergies
  current_products text,
  prior_procedures text,
  contraindications jsonb not null default '[]'::jsonb,   -- recorded by staff: [{ note, at, by }]
  privacy jsonb not null default '{}'::jsonb,              -- { email_when_report_ready: bool }
  status text not null default 'active' check (status in ('active', 'paused', 'deletion_requested', 'deleted')),
  enrolled_at timestamptz not null default now(),
  enrolled_by uuid references auth.users (id) on delete set null,   -- null: the client enrolled themselves
  updated_at timestamptz not null default now()
);
alter table skin_profiles enable row level security;

-- the profiles that belong to whoever is asking (used by the policies below and in later migrations)
create or replace function public.my_skin_profile_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from skin_profiles
   where status <> 'deleted'
     and (client_id = auth.uid() or email = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;
revoke all on function public.my_skin_profile_ids() from public, anon;
grant execute on function public.my_skin_profile_ids() to authenticated, service_role;

create policy "clients read their own skin profile" on skin_profiles
  for select using (id in (select public.my_skin_profile_ids()));

create table client_assignments (
  profile_id uuid not null references skin_profiles (id) on delete cascade,
  staff_user_id uuid not null references staff (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  primary key (profile_id, staff_user_id)
);
alter table client_assignments enable row level security;
revoke all on client_assignments from anon, authenticated;

create table skin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table skin_settings enable row level security;
revoke all on skin_settings from anon, authenticated;
insert into skin_settings (key, value) values
  ('assignment_mode', '"all"'),
  ('signed_url_seconds', '300'),
  ('retention', '{"treatment_records_years": 7, "images_after_deletion_request_days": 30, "audit_log_years": 7}');

create table imaging_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('phone', 'upload', 'usb_microscope', 'dermatoscope', 'pro_export')),
  model text,
  notes text,
  calibration jsonb,                    -- { um_per_px, method, reference, calibrated_at, calibrated_by }
  lighting jsonb,                       -- { source, color_temp_k, distance_cm, polarized }
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table imaging_devices enable row level security;
revoke all on imaging_devices from anon, authenticated;
insert into imaging_devices (name, kind, notes) values
  ('Studio phone', 'phone', 'The phone on the fixed mount, under the studio LED.'),
  ('Uploaded file', 'upload', 'A file added from another device or app; calibration unknown unless noted.');

create table imaging_sites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references skin_profiles (id) on delete cascade,
  name text not null,
  region text not null,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  active boolean not null default true
);
create index imaging_sites_profile on imaging_sites (profile_id);
alter table imaging_sites enable row level security;
revoke all on imaging_sites from anon, authenticated;
