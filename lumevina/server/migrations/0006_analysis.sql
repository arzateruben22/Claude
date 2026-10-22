-- 0006 · Analyses, measurements, measurement validation, change detection
--
-- An analysis is one run of one algorithm version over one capture; it is
-- never overwritten, so results can be recalculated when the algorithm
-- improves and both versions stay. Each measurement carries its name, value
-- and unit, the region and region-of-interest it was taken in, the capture
-- quality, the calibration status, the repeatability coefficient for that
-- measurement (from measurement_validation, when it has been validated),
-- its uncertainty, whether it is experimental, and the practitioner's
-- review. Only the review fields can change after it is written.
--
-- measurement_validation is the result of the repeatability protocol
-- (skin-intelligence/VALIDATION.md): for each measurement, region and kind
-- of device, how much the number moves when nothing about the skin has
-- changed. A change smaller than that is "no meaningful change". Until a
-- measurement has a row here with status 'validated', every result for it
-- is experimental and no change detection is made from it.

create table analyses (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references captures (id) on delete cascade,
  profile_id uuid not null references skin_profiles (id) on delete cascade,
  algorithm_version text not null,
  engine text not null,                 -- 'lumevina-worker'
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  params jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index analyses_capture on analyses (capture_id, started_at desc);
alter table analyses enable row level security;
revoke all on analyses from anon, authenticated;

create table measurements (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references analyses (id) on delete cascade,
  capture_id uuid not null references captures (id) on delete cascade,
  profile_id uuid not null references skin_profiles (id) on delete cascade,
  name text not null,                   -- js/skin/core/measurements.js names
  value double precision,               -- null when there is not enough to say
  unit text,
  region text not null,
  roi jsonb,                            -- the polygon or box measured, in original-image pixels
  quality text not null check (quality in ('good', 'marginal', 'poor')),
  calibration_status text not null,
  repeatability double precision,       -- the validated repeatability coefficient, same unit, when there is one
  uncertainty jsonb,                    -- { sd, ci95: [lo, hi], method }
  experimental boolean not null default true,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'verified', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,                     -- the practitioner's, not shown to the client
  created_at timestamptz not null default now()
);
create index measurements_profile on measurements (profile_id, name, region, created_at);
create index measurements_capture on measurements (capture_id);
alter table measurements enable row level security;
revoke all on measurements from anon, authenticated;

create or replace function public.measurements_guard() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('lumevina.purge', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then raise exception 'measurements are kept' using errcode = '42501'; end if;
  if (to_jsonb(new) - array['review_status', 'reviewed_by', 'reviewed_at', 'review_note'])
     <> (to_jsonb(old) - array['review_status', 'reviewed_by', 'reviewed_at', 'review_note']) then
    raise exception 'a measurement cannot change; run a new analysis' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger measurements_guard before update or delete on measurements
  for each row execute function public.measurements_guard();

create table measurement_validation (
  name text not null,
  region text not null,                 -- or 'any'
  device_kind text not null,            -- imaging_devices.kind, or 'any'
  status text not null default 'experimental' check (status in ('experimental', 'validated', 'retired')),
  repeatability_coefficient double precision,   -- 1.96 × √2 × within-subject SD, same unit as the measurement
  within_sd double precision,
  n_subjects int,
  n_repeats int,
  protocol_version text,
  algorithm_version text,
  validated_at timestamptz,
  validated_by uuid references auth.users (id) on delete set null,
  notes text,
  primary key (name, region, device_kind)
);
alter table measurement_validation enable row level security;
revoke all on measurement_validation from anon, authenticated;

create table change_detections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references skin_profiles (id) on delete cascade,
  name text not null,
  region text not null,
  from_capture_id uuid not null references captures (id) on delete cascade,
  to_capture_id uuid not null references captures (id) on delete cascade,
  from_value double precision,
  to_value double precision,
  delta double precision,
  threshold double precision,           -- the repeatability coefficient used
  verdict text not null check (verdict in ('improvement', 'deterioration', 'no_meaningful_change', 'uncertain', 'invalid_comparison')),
  reasons text[] not null default '{}',
  algorithm_version text not null,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'confirmed', 'dismissed')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  shared_with_client boolean not null default false,
  created_at timestamptz not null default now()
);
create index change_detections_profile on change_detections (profile_id, created_at desc);
alter table change_detections enable row level security;
revoke all on change_detections from anon, authenticated;
