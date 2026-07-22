-- Lumevina — Supabase (Postgres) schema
-- One shared source of truth for what the site currently keeps in each
-- visitor's browser: clients, bookings, and the Glow Rewards ledger.
-- Apply with:  supabase db push   (see server/README.md)

create extension if not exists btree_gist;

-- ── Clients ─────────────────────────────────────────────────────────
-- One row per person. Auth is Supabase magic-link email auth; this
-- table extends auth.users with spa-specific fields.
create table clients (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  name text,
  birth_month int check (birth_month between 0 and 11),
  birthday_claimed_year int,
  ref_code text unique not null,
  referred_by text,                -- another client's ref_code, set once
  referral_credited boolean not null default false,
  last_visit date,
  created_at timestamptz not null default now()
);

-- ── Bookings ────────────────────────────────────────────────────────
-- Times mirror the site's grid: minutes from midnight, 30-minute cells,
-- Tue–Sun 08:00–18:00 with lunch 12:00–12:30 enforced in the API layer.
create table bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients (id) on delete set null,
  guest_name text,                 -- guest checkout stays supported
  guest_email text,
  date date not null,
  start_min int not null check (start_min between 480 and 1050),
  dur_min int not null check (dur_min > 0 and dur_min % 30 = 0),
  services jsonb not null,         -- ["brazilian-wax", "lumevina-custom-facial"]
  total_cents int not null,
  deposit_cents int not null,      -- 50% of total (after any flash discount)
  paid_cents int,                  -- what was actually charged (after points)
  points_redeemed int not null default 0,
  flash boolean not null default false,
  source text not null default 'web'  -- 'web' | 'app' | 'admin' — powers the
    check (source in ('web', 'app', 'admin')),  -- app-vs-web split in the
                                     -- owner dashboard; captured from booking #1
  stripe_payment_intent text,
  status text not null default 'pending'
    check (status in ('pending', 'held', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz not null default now()
);

-- THE double-booking guard: two live bookings can never overlap.
-- This is what localStorage could not do — one calendar for everyone.
alter table bookings add constraint no_overlap
  exclude using gist (
    date with =,
    int4range(start_min, start_min + dur_min) with &&
  ) where (status in ('pending', 'held', 'completed'));

create index bookings_by_day on bookings (date) where status in ('pending', 'held');

-- ── Glow Rewards ledger ─────────────────────────────────────────────
-- Append-only. The balance is the sum — same shape as js/rewards.js.
create table rewards_ledger (
  id bigint generated always as identity primary key,
  client_id uuid not null references clients (id) on delete cascade,
  delta int not null,              -- positive earn, negative redeem
  label text not null,             -- "Deposit — Brazilian Wax", "Mystery petal"
  booking_id uuid references bookings (id),
  created_at timestamptz not null default now()
);

create view reward_balances as
  select client_id, coalesce(sum(delta), 0) as points
  from rewards_ledger group by client_id;

-- ── Flash openings ──────────────────────────────────────────────────
-- One row per day; set by the owner (or a scheduled job when a
-- cancellation frees a slot). The push notification fans out from here.
create table flash_slots (
  date date primary key,
  start_min int not null,
  discount_pct int not null default 10,
  claimed_by uuid references bookings (id)
);

-- ── Pre-visit intake / consent forms ────────────────────────────────
-- One current form per client (by email); resubmitting overwrites.
-- Mirrors js/intake.js. The owner reads these before the visit.
create table intake_forms (
  email text primary key,
  client_id uuid references clients (id) on delete set null,
  name text not null,
  answers jsonb not null,          -- all questions, keyed by field name
  signature text not null,
  signed_at timestamptz not null default now()
);

alter table intake_forms enable row level security;
create policy "own intake" on intake_forms
  for all using (auth.uid() = client_id) with check (auth.uid() = client_id);

-- ── Appointment notifications (confirmations + reminders) ────────────
-- Rows queued by the webhook; a scheduled function sends what's due and
-- stamps sent_at. Confirmation fires immediately; reminder is dated to
-- 24h before the appointment. See send-confirmation + README.
create table notifications (
  id bigint generated always as identity primary key,
  booking_id uuid references bookings (id) on delete cascade,
  kind text not null check (kind in ('confirmation', 'reminder')),
  channel text not null check (channel in ('email', 'sms')),
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_due on notifications (send_after) where sent_at is null;

-- ── Push tokens (flash-opening notifications) ───────────────────────
create table push_tokens (
  token text primary key,
  client_id uuid references clients (id) on delete cascade,
  platform text not null default 'ios',
  created_at timestamptz not null default now()
);

-- ── Row-level security ──────────────────────────────────────────────
-- Clients see and touch only their own rows; the service role (used by
-- edge functions) bypasses RLS for payments and availability.
alter table clients enable row level security;
alter table bookings enable row level security;
alter table rewards_ledger enable row level security;
alter table push_tokens enable row level security;

create policy "own profile" on clients
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own bookings" on bookings
  for select using (auth.uid() = client_id);

create policy "own ledger" on rewards_ledger
  for select using (auth.uid() = client_id);

create policy "own tokens" on push_tokens
  for all using (auth.uid() = client_id) with check (auth.uid() = client_id);

-- Availability is public data (times only, never names): expose it
-- through a security-definer function instead of opening the table.
create or replace function day_availability(p_date date)
returns table (start_min int, dur_min int)
language sql security definer stable as $$
  select b.start_min, b.dur_min from bookings b
  where b.date = p_date and b.status in ('pending', 'held', 'completed');
$$;
