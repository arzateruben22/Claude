-- 0005 · Imaging sessions, original captures, derived images, quality checks,
--        the analysis queue and the private skin-images bucket
--
-- An imaging session is one visit's set of photos. It attaches to a booking
-- when there is one (v3 website bookings) and otherwise stands on its own
-- with a label ("ProCell #2"), because at launch appointments live in
-- GlossGenius. A capture is one original image of one region. The original
-- is stored once, untouched, at original_path in the private skin-images
-- bucket, and its SHA-256 is recorded by the worker; neither can change
-- afterwards. Everything derived (the viewing copy, a thumbnail, an aligned
-- copy, a difference map) is a separate row pointing back at it, with the
-- algorithm version that made it. Clients read none of these tables
-- directly: the skin function returns what they may see.

create table imaging_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references skin_profiles (id) on delete cascade,
  booking_id uuid references bookings (id) on delete set null,
  visit_label text,
  service_id text,                      -- js/services.js id when known (procell-microchanneling, ...)
  performed_by uuid references auth.users (id) on delete set null,   -- null: the client's own photos
  device_id uuid references imaging_devices (id) on delete set null,
  lighting jsonb,
  notes_private text,                   -- the practitioner's, never shown to the client
  status text not null default 'open' check (status in ('open', 'submitted', 'reviewed', 'void')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);
create index imaging_sessions_profile on imaging_sessions (profile_id, started_at desc);
create index imaging_sessions_booking on imaging_sessions (booking_id) where booking_id is not null;
alter table imaging_sessions enable row level security;
revoke all on imaging_sessions from anon, authenticated;

create table captures (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references imaging_sessions (id) on delete cascade,
  profile_id uuid not null references skin_profiles (id) on delete cascade,
  region text not null check (region in ('front', 'left_profile', 'right_profile', 'forehead', 'left_cheek',
                                          'right_cheek', 'nose', 'chin', 'custom')),
  site_id uuid references imaging_sites (id) on delete set null,
  source text not null check (source in ('camera', 'upload', 'microscope', 'dermatoscope', 'pro_export')),
  original_path text not null unique,
  original_sha256 text,                 -- set once, by the worker, from the stored bytes
  mime text not null,
  bytes bigint,
  width int,
  height int,
  exif jsonb,                           -- camera, lens, exposure, ISO, white balance, focus, when present
  capture_meta jsonb,                   -- what the capture screen knew: guide, pose, distance hint, on-device checks
  um_per_px double precision,           -- spatial calibration for this image, when known
  calibration_status text not null default 'uncalibrated'
    check (calibration_status in ('uncalibrated', 'device_calibrated', 'reference_in_frame')),
  status text not null default 'pending_upload'
    check (status in ('pending_upload', 'uploaded', 'processed', 'failed', 'excluded')),
  excluded_reason text,
  captured_at timestamptz not null default now(),
  captured_by uuid references auth.users (id) on delete set null,
  captured_by_role text not null check (captured_by_role in ('client', 'practitioner', 'admin'))
);
create index captures_session on captures (session_id);
create index captures_profile_region on captures (profile_id, region, captured_at);
alter table captures enable row level security;
revoke all on captures from anon, authenticated;

-- The original never changes: its path and kind are fixed at creation, its
-- hash, size and dimensions are filled once. Status, exclusion and
-- calibration may move on. No deletes outside a retention run.
create or replace function public.captures_guard() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('lumevina.purge', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then raise exception 'captures are kept' using errcode = '42501'; end if;
  if new.original_path <> old.original_path or new.profile_id <> old.profile_id or new.session_id <> old.session_id
     or new.mime <> old.mime or new.captured_at <> old.captured_at or new.source <> old.source
     or new.captured_by is distinct from old.captured_by then
    raise exception 'the original capture cannot change' using errcode = '42501';
  end if;
  if (old.original_sha256 is not null and new.original_sha256 is distinct from old.original_sha256)
     or (old.bytes is not null and new.bytes is distinct from old.bytes)
     or (old.width is not null and new.width is distinct from old.width)
     or (old.height is not null and new.height is distinct from old.height) then
    raise exception 'the original''s hash and size are set once' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger captures_guard before update or delete on captures
  for each row execute function public.captures_guard();

create table derived_images (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references captures (id) on delete cascade,
  kind text not null check (kind in ('view', 'thumb', 'aligned', 'enhanced', 'diffmap', 'overlay')),
  path text not null unique,
  reference_capture_id uuid references captures (id) on delete cascade,   -- aligned to / compared with
  algorithm_version text not null,
  params jsonb,
  width int,
  height int,
  created_at timestamptz not null default now()
);
create index derived_images_capture on derived_images (capture_id, kind);
alter table derived_images enable row level security;
revoke all on derived_images from anon, authenticated;

create table quality_checks (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references captures (id) on delete cascade,
  algorithm_version text not null,
  metrics jsonb not null,               -- { sharpness, clip_dark, clip_bright, mean_l, wb_shift, face, yaw, pitch, roll, scale }
  flags text[] not null default '{}',   -- 'blur', 'underexposed', 'overexposed', 'color_cast', 'angle', 'scale', 'motion', 'no_calibration'
  passed boolean not null,              -- usable at all
  comparable boolean not null,          -- usable for measurements and comparisons
  reviewed_by uuid references auth.users (id) on delete set null,
  review_decision text check (review_decision in ('accept', 'retake', 'exclude')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index quality_checks_capture on quality_checks (capture_id, created_at desc);
alter table quality_checks enable row level security;
revoke all on quality_checks from anon, authenticated;

create table analysis_jobs (
  id bigint generated always as identity primary key,
  capture_id uuid not null references captures (id) on delete cascade,
  kind text not null check (kind in ('ingest', 'quality', 'measure', 'register')),
  reference_capture_id uuid references captures (id) on delete cascade,
  params jsonb,                         -- e.g. { scar_roi: [[x, y], ...] } in original-image pixels
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  attempts int not null default 0,
  claimed_by text,
  claimed_at timestamptz,
  finished_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create unique index analysis_jobs_once on analysis_jobs (capture_id, kind, coalesce(reference_capture_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('queued', 'running');
create index analysis_jobs_queue on analysis_jobs (id) where status = 'queued';
alter table analysis_jobs enable row level security;
revoke all on analysis_jobs from anon, authenticated;

-- the worker takes the next job (or one stuck for 10 minutes), never two workers the same one
create or replace function public.claim_analysis_job(p_worker text)
returns setof analysis_jobs language plpgsql security definer set search_path = public as $$
begin
  return query
  update analysis_jobs j
     set status = 'running', claimed_by = p_worker, claimed_at = now(), attempts = j.attempts + 1
   where j.id = (
     select id from analysis_jobs
      where (status = 'queued' or (status = 'running' and claimed_at < now() - interval '10 minutes'))
        and attempts < 5
      order by id
      for update skip locked
      limit 1)
  returning j.*;
end $$;
revoke all on function public.claim_analysis_job(text) from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('skin-images', 'skin-images', false, 26214400,
        array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/tiff', 'image/webp'])
on conflict (id) do nothing;
-- No storage policies on purpose: only the edge functions and the worker
-- (service role) touch the bucket; browsers get single-object signed URLs.
