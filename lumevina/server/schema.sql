-- Lumevina — Supabase (Postgres) schema
-- One shared source of truth for what the site currently keeps in each
-- visitor's browser: clients, bookings, and the Glow Rewards ledger.
-- Apply with:  supabase db push   (see server/README.md)

create extension if not exists btree_gist;
create extension if not exists pgcrypto;   -- gen_random_bytes, for Wallet pass tokens

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
-- Tue–Sat 08:00–18:00 with lunch 12:00–12:30 enforced in the API layer
-- (closed Sundays and Mondays, except the extra Mondays in site_settings).
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
  points_earned int not null default 0,  -- set by stripe-webhook; handed back on cancel
  prev_last_visit date,            -- the client's last_visit before this booking
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

-- A booking cancelled in time hands back the points it earned (its rebooking
-- bonus included), and the visit it counted as stops counting.
create or replace function return_booking_points() returns trigger
language plpgsql security definer as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled'
     and new.client_id is not null and new.points_earned > 0 then
    insert into rewards_ledger (client_id, delta, label, booking_id)
      values (new.client_id, -new.points_earned, 'Cancelled booking — points returned', new.id);
    update clients set last_visit = new.prev_last_visit
      where id = new.client_id and last_visit = new.date;
  end if;
  return new;
end $$;
create trigger booking_points_back after update on bookings
  for each row execute function return_booking_points();

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

-- ── Glow Membership ────────────────────────────────────────────────
-- One row per member. Billing is a Stripe Billing subscription; the
-- stripe-webhook function mirrors its state here. Each paid invoice adds
-- one facial credit. With 2 banked, billing holds (the subscription's
-- pause_collection voids that month's invoice) until one is used, so no one
-- pays for a facial they can't book; a cancelled booking may return a credit
-- past 2. A booking that uses a credit links back through membership_ledger.
-- See server/README.md → Memberships.
create table memberships (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  plan text not null check (plan in ('glow', 'ageless')),
  price_cents int not null,                 -- locked founding price
  status text not null default 'active'
    check (status in ('active', 'cancelling', 'cancelled')),
  credits int not null default 1 check (credits >= 0),
  started_at timestamptz not null default now(),
  min_ends_at timestamptz not null,         -- started_at + 3 months
  next_bill_at timestamptz not null,
  paused_bill_at timestamptz,               -- the one billing date being skipped
  on_hold boolean not null default false,   -- 2 facials waiting: billing held until one is used
  last_pause_at timestamptz,                -- one pause per 12 months
  cancel_at timestamptz,
  founding boolean not null default true,
  -- Founding Five: the first five members (any plan) get a welcome skincare
  -- kit and a free add-on. Assign five_no 1–5 in the join transaction.
  five_no smallint unique check (five_no between 1 and 5),
  five_kit text check (five_kit in ('ready', 'given')),
  five_addon text check (five_addon in ('ready', 'used')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now()
);
create unique index one_live_membership_per_client
  on memberships (client_id) where status <> 'cancelled';

create table membership_ledger (
  id bigint generated always as identity primary key,
  membership_id uuid not null references memberships (id) on delete cascade,
  kind text not null check (kind in ('joined', 'billed', 'paused', 'held', 'used', 'returned', 'gifted', 'cancel-requested', 'kept', 'cancelled')),
  amount_cents int,
  booking_id uuid references bookings (id) on delete set null,
  gift_code text,
  created_at timestamptz not null default now()
);

alter table memberships enable row level security;
alter table membership_ledger enable row level security;
create policy "members read their own membership" on memberships
  for select using (client_id = auth.uid());
create policy "members read their own ledger" on membership_ledger
  for select using (membership_id in (select id from memberships where client_id = auth.uid()));
-- writes happen only in edge functions (service role): join, pause,
-- cancel, keep, gift, and the webhook's billed / cancelled events.

-- ─────────────────────────────────────────────────────────────
-- Ask Lumevina: questions handed to Evelyn (functions/ask)
-- Everyday questions are answered on the spot and never stored here.
-- Personal ones (reactions, pregnancy, medications, "what should I use")
-- land here with a drafted reply she checks and sends from the dashboard.
-- ─────────────────────────────────────────────────────────────
create table questions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients (id) on delete set null,
  name text not null,
  email text not null,
  member boolean not null default false,          -- members are promised a reply within 24 hours
  kind text not null check (kind in ('urgent', 'reaction', 'pregnancy', 'medication', 'condition', 'skin', 'request', 'other')),
  text text not null,
  draft text,                                     -- written by the assistant, never sent as is
  status text not null default 'waiting' check (status in ('waiting', 'answered')),
  due_at timestamptz not null,
  reply text,                                     -- what Evelyn actually sent
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index questions_waiting on questions (due_at) where status = 'waiting';

alter table questions enable row level security;
create policy "clients read their own questions" on questions
  for select using (client_id = auth.uid());
-- writes happen only in edge functions (service role): ask inserts,
-- the dashboard's Send reply updates reply / status / answered_at.


-- ── The Glow Card in Apple Wallet ───────────────────────────────────
-- One pass per client (functions/wallet-pass). Devices that add it register
-- here so Wallet can be told to fetch a fresh copy when points or the next
-- visit change. Server-only: no client policies.
create table wallet_passes (
  serial text primary key default gen_random_uuid()::text,
  client_id uuid unique not null references clients (id) on delete cascade,
  auth_token text not null default encode(gen_random_bytes(24), 'hex'),
  updated_at timestamptz not null default now()
);
create table wallet_registrations (
  device_id text not null,
  push_token text not null,
  serial text not null references wallet_passes (serial) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (device_id, serial)
);
alter table wallet_passes enable row level security;
alter table wallet_registrations enable row level security;

-- any change to points or bookings marks the client's pass as updated
create or replace function touch_wallet_pass() returns trigger
language plpgsql security definer as $$
begin
  update wallet_passes set updated_at = now() where client_id = new.client_id;
  return new;
end $$;
create trigger wallet_after_points after insert on rewards_ledger
  for each row execute function touch_wallet_pass();
create trigger wallet_after_booking after insert or update on bookings
  for each row when (new.client_id is not null) execute function touch_wallet_pass();
