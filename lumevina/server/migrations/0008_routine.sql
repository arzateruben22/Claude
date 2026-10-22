-- 0008 · The client's routine, their check-ins, and recovery check-ins
--
-- routine_entries: what they use morning, night and weekly. A product from
--   the shop carries its products.id; one from elsewhere just a name. Added
--   by the client, proposed by the practitioner (status 'proposed' until the
--   client accepts it), or offered from a past order. Buying a product is
--   not taken as using it: an order only ever creates a suggestion.
-- routine_checkins: one row a day, if the client chooses to log it.
-- recovery_checkins: after a treatment, how their skin feels on day 1, 3, 7.
-- Clients read and write their own through the skin function; the read
-- policies below let the website show them directly too.

create table routine_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references skin_profiles (id) on delete cascade,
  slot text not null check (slot in ('am', 'pm', 'weekly')),
  position int not null default 0,
  product_id text,                      -- products.id when it is one of hers
  product_name text not null,
  category text,                        -- cleanser, toner, serum, moisturizer, sunscreen, treatment, other
  how text,
  frequency text,                       -- 'daily', '3x weekly', ...
  started_on date,
  stopped_on date,
  source text not null check (source in ('client', 'practitioner', 'order')),
  status text not null default 'active' check (status in ('proposed', 'active', 'stopped')),
  proposed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index routine_entries_profile on routine_entries (profile_id, slot, position);
alter table routine_entries enable row level security;
create policy "clients read their own routine" on routine_entries
  for select using (profile_id in (select public.my_skin_profile_ids()));

create table routine_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references skin_profiles (id) on delete cascade,
  on_date date not null,
  am_done boolean,
  pm_done boolean,
  irritation text check (irritation in ('none', 'mild', 'moderate', 'strong')),
  note text,
  created_at timestamptz not null default now(),
  unique (profile_id, on_date)
);
alter table routine_checkins enable row level security;
create policy "clients read their own check-ins" on routine_checkins
  for select using (profile_id in (select public.my_skin_profile_ids()));

create table recovery_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references skin_profiles (id) on delete cascade,
  treatment_id uuid references treatment_records (id) on delete set null,
  day_after int not null check (day_after between 0 and 60),
  redness int check (redness between 0 and 3),          -- 0 none … 3 a lot, as they see it
  tightness int check (tightness between 0 and 3),
  comfort int check (comfort between 0 and 3),          -- 0 comfortable … 3 uncomfortable
  note text,
  flagged boolean not null default false,               -- they asked Evelyn to look
  created_at timestamptz not null default now()
);
create index recovery_checkins_profile on recovery_checkins (profile_id, created_at desc);
alter table recovery_checkins enable row level security;
create policy "clients read their own recovery check-ins" on recovery_checkins
  for select using (profile_id in (select public.my_skin_profile_ids()));
