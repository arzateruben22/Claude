-- OC Ultra store: accounts, purchases, entitlements, the launch waitlist and invite codes.
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to read top to bottom: tables, then row-level
-- security, then grants. Nothing here holds card data: Stripe's hosted page takes the card and keeps it.
--
-- Who can do what (row-level security is on for every table):
--   profiles      a player reads, creates and updates only their own row (the 13+ answer; never a birth date)
--   purchases     a player reads only their own rows; only the service role (the stripe-webhook function) writes
--   entitlements  a player reads only their own rows; only the service role writes
--   waitlist      anyone may add an email (and a ZIP and who referred them); nobody but the service role reads
--   invite_codes  the service role only
-- The service role bypasses row-level security by design; its key lives only in the Edge Functions' secrets.

-- ------------------------------------------------------------------------------------------- tables
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 24),
  is_13_plus   boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.purchases (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  sku                    text not null,
  stripe_session_id      text not null unique,          -- one row per Checkout Session: redelivered webhooks change nothing
  stripe_payment_intent  text,                          -- one-time payments: how a refund finds its purchase
  stripe_subscription_id text,                          -- the club: how a cancellation finds its purchase
  amount_cents           integer not null check (amount_cents >= 0),
  currency               text not null default 'usd',
  status                 text not null default 'paid' check (status in ('paid', 'refunded', 'ended')),
  roll_name              text check (roll_name is null or char_length(roll_name) between 1 and 24),  -- Founder Pack opt-in; the owner approves it
  created_at             timestamptz not null default now(),
  refunded_at            timestamptz
);
create index if not exists purchases_user_idx on public.purchases (user_id);
create index if not exists purchases_pi_idx on public.purchases (stripe_payment_intent) where stripe_payment_intent is not null;
create index if not exists purchases_sub_idx on public.purchases (stripe_subscription_id) where stripe_subscription_id is not null;

create table if not exists public.entitlements (
  user_id     uuid not null references auth.users (id) on delete cascade,
  entitlement text not null,                            -- an id from src/store/cosmetics.json
  sku         text not null,                            -- the purchase that granted it most recently
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,                              -- set by a refund or the end of a subscription
  primary key (user_id, entitlement)
);

create table if not exists public.waitlist (
  email         text not null unique check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  zip           text check (zip is null or zip ~ '^\d{5}$'),
  referral_code text not null unique default substr(md5(gen_random_uuid()::text), 1, 10),
  referred_by   text check (referred_by is null or referred_by ~ '^[0-9a-f]{10}$'),
  created_at    timestamptz not null default now()
);

create table if not exists public.invite_codes (
  code       text primary key check (code ~ '^[A-Z0-9-]{4,32}$'),
  max_uses   integer not null default 1 check (max_uses > 0),
  uses       integer not null default 0 check (uses >= 0 and uses <= max_uses),
  expires_at timestamptz
);

-- ------------------------------------------------------------------------------------------- row-level security
alter table public.profiles     enable row level security;
alter table public.purchases    enable row level security;
alter table public.entitlements enable row level security;
alter table public.waitlist     enable row level security;
alter table public.invite_codes enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles: create own" on public.profiles;
create policy "profiles: create own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "purchases: read own" on public.purchases;
create policy "purchases: read own" on public.purchases for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "entitlements: read own" on public.entitlements;
create policy "entitlements: read own" on public.entitlements for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "waitlist: anyone may join" on public.waitlist;
create policy "waitlist: anyone may join" on public.waitlist for insert to anon, authenticated with check (true);

-- invite_codes: no policy at all, so only the service role reaches it

-- ------------------------------------------------------------------------------------------- grants
-- Belt and braces under the policies: the roles the page uses get only what they need, whatever the project's
-- default privileges are.
revoke all on public.profiles, public.purchases, public.entitlements, public.waitlist, public.invite_codes from anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (id, display_name, is_13_plus) on public.profiles to authenticated;   -- an upsert sets every column it sends; the policy keeps id = you
grant select on public.purchases to authenticated;
grant select on public.entitlements to authenticated;
grant insert (email, zip, referred_by) on public.waitlist to anon, authenticated;
grant all on public.profiles, public.purchases, public.entitlements, public.waitlist, public.invite_codes to service_role;
