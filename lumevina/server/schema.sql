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
-- Tue–Sat 08:00–18:00 with lunch 12:00–12:30 enforced in the API layer
-- (closed Sundays and Mondays, except the extra Mondays in site_settings).
create table bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients (id) on delete set null,
  guest_name text,                 -- who booked (signed in or not)
  guest_email text,                -- their email: contacts, points and reminders key on it
  phone text,
  sms_ok boolean not null default false,   -- reminders by text, if they said yes
  note text,                       -- from the client when booking, or Evelyn's when she books for them
  manage_token text unique not null default replace(gen_random_uuid()::text, '-', ''),  -- the link in their emails: cancel, move
  consent jsonb,                   -- { signature, signedAt } from the booking form
  date date not null,
  start_min int not null check (start_min between 0 and 1439),  -- her hours, plus after-hours visits
  dur_min int not null check (dur_min > 0 and dur_min % 30 = 0),
  services jsonb not null,         -- ["brazilian-wax", "lumevina-custom-facial"]
  total_cents int not null,
  deposit_cents int not null,      -- 50% of total (after any flash discount)
  paid_cents int,                  -- what was actually charged (after points)
  points_redeemed int not null default 0,
  points_earned int not null default 0,  -- set by stripe-webhook; handed back on cancel
  prev_last_visit date,            -- the client's last_visit before this booking
  referral_code text,              -- a friend's code: $15 off this first visit
  flash boolean not null default false,
  source text not null default 'web'  -- 'web' | 'app' | 'admin' — powers the
    check (source in ('web', 'app', 'admin')),  -- app-vs-web split in the
                                     -- owner dashboard; captured from booking #1
  stripe_payment_intent text,
  stripe_session text,             -- the Stripe page that took the deposit or saved the card
  stripe_customer text,            -- the card on file: Evelyn charges the visit, a tip or a fee to it
  payment_method text,
  card_label text,                 -- "Visa •••• 4242"
  membership_id uuid,              -- a membership facial: the credit it used (memberships)
  gift_code text,                  -- a gift certificate applied when booking
  gift_applied_cents int not null default 0,
  credit_applied_cents int not null default 0,  -- a deposit carried over from a booking cancelled in time
  first_bonus boolean not null default false,   -- earned the 100 points for a first booking here
  google_event_id text,            -- the event in her Google Calendar (GlossGenius reads it)
  status text not null default 'pending'
    check (status in ('pending', 'held', 'completed', 'cancelled', 'no_show')),
  cancelled_at timestamptz,
  cancel_kind text check (cancel_kind in ('in_time', 'late', 'evelyn')),
  -- checkout at the visit (functions/studio-book → checkout)
  checkout jsonb,                  -- { services, products, discounts, method, receipt }
  balance_paid_cents int,          -- paid at the visit, tip not included
  tip_cents int not null default 0,
  completed_at timestamptz,
  fee_cents int,                   -- a late-cancel or no-show fee Evelyn charged
  fee_kind text check (fee_kind in ('late_cancel', 'no_show')),
  created_at timestamptz not null default now()
);

-- THE double-booking guard: two live bookings can never overlap, and each
-- one carries Evelyn's 30 minutes of cleaning time after it, so the next
-- appointment starts at least 30 minutes after the last one ends.
-- This is what localStorage could not do — one calendar for everyone.
alter table bookings add constraint no_overlap
  exclude using gist (
    date with =,
    int4range(start_min, start_min + dur_min + 30) with &&
  ) where (status in ('pending', 'held', 'completed'));

create index bookings_by_day on bookings (date) where status in ('pending', 'held');
create index bookings_by_email on bookings (lower(guest_email));

-- ── Glow Rewards ledger ─────────────────────────────────────────────
-- Append-only. The balance is the sum — same shape as js/rewards.js.
-- Keyed by email (lower case), so points earned before someone signs in
-- are already theirs when they do.
create table rewards_ledger (
  id bigint generated always as identity primary key,
  email text not null check (email = lower(email)),
  client_id uuid references clients (id) on delete set null,
  delta int not null,              -- positive earn, negative redeem
  label text not null,             -- "Visit — Lumevina Custom Facial", "First booking here"
  booking_id uuid references bookings (id),
  order_id uuid,                   -- a shop order (orders)
  created_at timestamptz not null default now()
);
create index rewards_by_email on rewards_ledger (email);

create view reward_balances as
  select email, coalesce(sum(delta), 0)::int as points
  from rewards_ledger group by email;

-- A booking cancelled in time hands back the points it earned (its rebooking
-- bonus included), and the visit it counted as stops counting.
create or replace function return_booking_points() returns trigger
language plpgsql security definer as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled'
     and new.guest_email is not null and new.points_earned > 0 then
    insert into rewards_ledger (email, client_id, delta, label, booking_id)
      values (lower(new.guest_email), new.client_id, -new.points_earned, 'Cancelled booking: points returned', new.id);
    update contacts set last_visit = new.prev_last_visit
      where email = lower(new.guest_email) and last_visit = new.date;
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

-- ── Appointment notifications (older queue, unused since v3) ──────────
-- v3 sends booking messages as they happen (functions/_shared/bookings.ts)
-- and the scheduled ones from functions/client-reminders, recorded once
-- each in sent_messages. Kept so an existing database needs no migration.
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
  for select using (auth.uid() = client_id or lower(guest_email) = lower(auth.jwt() ->> 'email'));

create policy "own ledger" on rewards_ledger
  for select using (email = lower(auth.jwt() ->> 'email'));

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
  email text not null check (email = lower(email)),   -- who it belongs to; signing in with it shows it
  name text,
  client_id uuid references clients (id) on delete set null,
  plan text not null check (plan in ('glow', 'ageless')),
  price_cents int not null,                 -- locked founding price
  status text not null default 'active'
    check (status in ('active', 'cancelling', 'cancelled')),
  credits int not null default 0 check (credits >= 0),   -- each paid invoice adds one
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
  payment_method text,                      -- the card the subscription bills: booking needs no other
  card_label text,
  created_at timestamptz not null default now()
);
create unique index one_live_membership_per_email
  on memberships (email) where status <> 'cancelled';

create table membership_ledger (
  id bigint generated always as identity primary key,
  membership_id uuid not null references memberships (id) on delete cascade,
  kind text not null check (kind in ('joined', 'billed', 'paused', 'held', 'used', 'returned', 'gifted', 'cancel-requested', 'kept', 'cancelled')),
  amount_cents int,
  booking_id uuid references bookings (id) on delete set null,
  gift_code text,
  invoice_id text unique,          -- a 'billed' row's Stripe invoice: each counts once
  created_at timestamptz not null default now()
);

alter table memberships enable row level security;
alter table membership_ledger enable row level security;
create policy "members read their own membership" on memberships
  for select using (email = lower(auth.jwt() ->> 'email'));
create policy "members read their own ledger" on membership_ledger
  for select using (membership_id in (select id from memberships where email = lower(auth.jwt() ->> 'email')));
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
  why text,                                       -- the assistant's one line on what they need
  photos text[] not null default '{}',            -- paths in the private question-photos bucket
  photo_note text,                                -- what the photos show, in plain words (never a diagnosis)
  reply text,                                     -- what Evelyn actually sent
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index questions_waiting on questions (due_at) where status = 'waiting';

alter table questions enable row level security;
create policy "clients read their own questions" on questions
  for select using (client_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email'));
-- writes happen only in edge functions (service role): ask inserts,
-- the dashboard's Send reply (functions/studio) updates reply / status / answered_at.

-- Photos a client adds to a question: private. Only the edge functions
-- (service role) upload them or make the short-lived links Evelyn's
-- dashboard shows, so there are no storage policies on purpose.
insert into storage.buckets (id, name, public) values ('question-photos', 'question-photos', false)
  on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Skin plans: the routine Evelyn writes for each client (dashboard →
-- Clients → Skin plan). Keyed by email, so she can write one before the
-- client ever signs in. The client sees it in My Lumevina, and Ask
-- Lumevina answers their routine questions from it (functions/ask), along
-- with their pre-visit form, visits and the questions she has answered.
-- ─────────────────────────────────────────────────────────────
create table client_plans (
  email text primary key check (email = lower(email)),
  client_id uuid references clients (id) on delete set null,
  name text,
  plan jsonb not null,             -- { skinType, concerns[], goal, phase, morning[], night[], weekly[],
                                   --   avoid, next, note, log[] }: see functions/_shared/plans.ts
  updated_at timestamptz not null default now()
);

alter table client_plans enable row level security;
create policy "clients read their own plan" on client_plans
  for select using (email = lower(auth.jwt() ->> 'email'));
-- writes happen only in functions/client-plans (service role, studio key).

-- ─────────────────────────────────────────────────────────────
-- Skin profiles and what the chat remembers: each client's own.
-- The profile is what they tell us in My Lumevina (skin, what they're
-- working on, the products they use morning and night, supplements,
-- treatments they've had, what their skin reacts to, their goal), saved
-- only with their yes. The memory is what they've told the chat since
-- (functions/ask → remember), one short line each, which they can see and
-- delete. Both go into their chat file and Evelyn's view of them, and
-- never to anyone else. Writes happen only in functions/profile and
-- functions/ask (service role); see functions/_shared/profiles.ts.
-- ─────────────────────────────────────────────────────────────
create table client_profiles (
  email text primary key check (email = lower(email)),
  profile jsonb not null,          -- { skinType, concerns[], goal, morning, night, weekly,
                                   --   supplements, treatments, sensitivities }
  consent_at timestamptz not null, -- when they said yes to saving it
  updated_at timestamptz not null default now()
);
alter table client_profiles enable row level security;
create policy "clients read their own profile" on client_profiles
  for select using (email = lower(auth.jwt() ->> 'email'));

create table client_memory (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  kind text not null default 'other'
    check (kind in ('skin', 'concern', 'product', 'supplement', 'treatment', 'sensitivity', 'goal', 'other')),
  fact text not null,              -- "Uses CeraVe Hydrating Cleanser at night"
  source text not null default 'chat' check (source in ('chat', 'evelyn')),
  created_at timestamptz not null default now()
);
create index client_memory_email on client_memory (email, created_at desc);
alter table client_memory enable row level security;
create policy "clients read their own memory" on client_memory
  for select using (email = lower(auth.jwt() ->> 'email'));

-- ─────────────────────────────────────────────────────────────
-- What the chat learns from Evelyn. When she replies to a question the
-- chat handed her, Claude suggests a general version of it (no names, no
-- details about that client); she approves, edits or dismisses it in the
-- dashboard (Teach the chat), and approved answers join what the chat
-- knows for everyone (functions/ask). Server only: no policies.
-- ─────────────────────────────────────────────────────────────
create table learned_answers (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  kind text,
  source_question uuid references questions (id) on delete set null,
  status text not null default 'suggested' check (status in ('suggested', 'approved', 'dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table learned_answers enable row level security;

-- ─────────────────────────────────────────────────────────────
-- Shipping: everything that goes out by mail (js/shipping.js)
-- Shelf orders, Glow Routine boxes and Skin School kits. stripe-webhook
-- inserts a row for each paid order that ships (payment_intent.succeeded
-- for the shop and Skin School, invoice.paid for each month's Glow Routine
-- box). The dashboard's Shipping card works from it: the Pirate Ship
-- spreadsheet, packing slips, then the tracking number and what the
-- label really cost, which replaces the estimate in the books.
-- See SHIPPING.md.
-- ─────────────────────────────────────────────────────────────
create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null,                        -- the Stripe PaymentIntent or invoice
  source text not null check (source in ('shop', 'routine', 'school')),
  client_id uuid references clients (id) on delete set null,
  name text not null,
  email text,                                     -- Pirate Ship emails the tracking here
  street text not null,
  apt text,
  city text not null,
  state char(2) not null,
  zip text not null check (zip ~ '^\d{5}(-\d{4})?$'),
  items jsonb not null,                           -- [{ "id": "gm-cleanser", "name": "...", "qty": 1 }]
  package text not null default 'mailer' check (package in ('mailer', 'small', 'medium')),
  weight_oz int not null check (weight_oz > 0),
  charged_cents int not null default 0,           -- what the client paid for shipping
  est_cents int not null,                         -- estimated postage + supplies, until the label is bought
  postage_cents int,                              -- the label's real price
  supplies_cents int,
  tracking text,
  carrier text check (carrier in ('USPS', 'UPS')),
  status text not null default 'to_ship' check (status in ('to_ship', 'shipped', 'delivered', 'returned')),
  ship_by timestamptz not null,                   -- two business days after the order; a Routine box's date
  shipped_at timestamptz,
  created_at timestamptz not null default now()
);
create index shipments_to_ship on shipments (ship_by) where status = 'to_ship';

alter table shipments enable row level security;
create policy "clients read their own shipments" on shipments
  for select using (client_id = auth.uid());
-- writes happen only in edge functions (service role): the webhook inserts,
-- the dashboard's Mark shipped updates tracking / postage / status.

-- ─────────────────────────────────────────────────────────────
-- Gift certificates (js/giftcards.js on the site, the gift-cards function)
-- One row per code. A value certificate ("$100 toward any treatment") draws
-- down: a $100 certificate used on a $50 visit keeps $50 for next time, and
-- on a $120 visit it covers $100 and the client pays the $20 difference.
-- (Older treatment certificates, kind 'service', cover their whole treatment
-- once.) Every use is a row in gift_redemptions, so the history adds up.
-- Nothing here is public: only the gift-cards function (service role) reads
-- or writes, and spending takes Evelyn's studio key.
-- ─────────────────────────────────────────────────────────────
create table gift_cards (
  code text primary key check (code ~ '^LUM-[A-Z2-9]{4}-[A-Z2-9]{4}$'),
  kind text not null default 'value' check (kind in ('value', 'service')),
  label text not null default 'Any treatment',
  service_id text,                                -- kind 'service' only
  amount_cents int not null check (amount_cents > 0),
  balance_cents int not null check (balance_cents >= 0 and balance_cents <= amount_cents),
  status text not null default 'active' check (status in ('active', 'redeemed', 'void')),
  recipient_name text,
  recipient_email text,
  buyer_email text,
  message text,
  deliver_to_buyer boolean not null default false,
  send_date date,
  source text not null default 'sale' check (source in ('sale', 'studio', 'membership')),
  stripe_payment_intent text,                     -- the order that paid for it
  delivered_at timestamptz,                       -- when its email went out (dated gifts wait for studio-digest)
  purchased_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index gift_cards_recipient on gift_cards (lower(recipient_email));

create table gift_redemptions (
  id bigint generated always as identity primary key,
  code text not null references gift_cards (code),
  bill_cents int not null check (bill_cents >= 0),        -- what the visit came to
  applied_cents int not null check (applied_cents > 0),   -- what the certificate covered
  pay_cents int not null check (pay_cents >= 0),          -- what the client paid on top
  balance_after_cents int not null check (balance_after_cents >= 0),
  where_used text not null default 'studio' check (where_used in ('studio', 'online')),
  booking_id uuid references bookings (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index gift_redemptions_code on gift_redemptions (code, created_at);

alter table gift_cards enable row level security;
alter table gift_redemptions enable row level security;
-- no policies on purpose: the gift-cards function is the only way in.

-- Spend a certificate against a bill, all in one step (the row is locked, so
-- two uses at once can't both spend the same dollars). Returns what it
-- covered, what's left to pay, and the balance left on the certificate.
create or replace function redeem_gift(p_code text, p_bill_cents int, p_where text default 'studio',
                                       p_note text default null, p_booking uuid default null)
returns table (code text, applied_cents int, pay_cents int, balance_cents int, status text)
language plpgsql security definer set search_path = public as $$
declare
  g gift_cards%rowtype;
  use_cents int;
  left_cents int;
begin
  if p_bill_cents is null or p_bill_cents <= 0 then raise exception 'nothing_due'; end if;
  select * into g from gift_cards where gift_cards.code = upper(trim(p_code)) for update;
  if not found then raise exception 'not_found'; end if;
  if g.status = 'void' then raise exception 'void'; end if;
  if g.balance_cents <= 0 then raise exception 'empty'; end if;
  if g.kind = 'service' then
    use_cents := g.balance_cents;                          -- covers its whole treatment
  else
    use_cents := least(g.balance_cents, p_bill_cents);     -- only what the bill needs
  end if;
  left_cents := g.balance_cents - use_cents;
  update gift_cards
     set balance_cents = left_cents,
         status = case when left_cents = 0 then 'redeemed' else 'active' end,
         last_used_at = now()
   where gift_cards.code = g.code;
  insert into gift_redemptions (code, bill_cents, applied_cents, pay_cents, balance_after_cents, where_used, booking_id, note)
  values (g.code, p_bill_cents, use_cents, greatest(p_bill_cents - use_cents, 0), left_cents,
          coalesce(p_where, 'studio'), p_booking, p_note);
  return query select g.code, use_cents, greatest(p_bill_cents - use_cents, 0), left_cents,
                      (case when left_cents = 0 then 'redeemed' else 'active' end)::text;
end $$;
revoke all on function redeem_gift(text, int, text, text, uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- The shop: products, one stock count, and orders
-- js/inventory.js reads the `shelf` view (counts and prices only) on the
-- website and the dashboard. A paid online order takes stock off in the
-- Stripe webhook; an in-person sale, a recount or a new price goes through
-- functions/studio (Evelyn's studio key). Seed the rows from the catalog
-- with server/seed-products.sql (scripts/seed-products.mjs writes it).
-- ─────────────────────────────────────────────────────────────
create table products (
  id text primary key,                            -- the catalog's id (js/catalog.js)
  name text not null,
  brand text,
  category text,
  price_cents int not null check (price_cents >= 0),
  stock int check (stock is null or stock >= 0),  -- null: not counted
  low_at int not null default 3,                  -- tell Evelyn when it gets this low
  hidden boolean not null default false,          -- off the website (drafts, discontinued)
  updated_at timestamptz not null default now()
);
alter table products enable row level security;  -- no policies: the view below is the public part

create view shelf as select id, stock, price_cents, hidden from products;
grant select on shelf to anon, authenticated;

-- take stock off for a list of [{ "id", "qty" }], in one step, never below
-- zero; returns each product's count after, and whether it's now low
create or replace function take_stock(p_items jsonb)
returns table (id text, name text, stock int, low boolean)
language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    update products
       set stock = greatest(products.stock - greatest((it->>'qty')::int, 0), 0), updated_at = now()
     where products.id = it->>'id' and products.stock is not null;
  end loop;
  return query
    select p.id, p.name, p.stock, (p.stock is not null and p.stock <= p.low_at)
      from products p
     where p.id in (select x->>'id' from jsonb_array_elements(p_items) x);
end $$;
revoke all on function take_stock(jsonb) from public, anon, authenticated;

-- One row per checkout. functions/create-checkout writes it as 'pending'
-- with the prices it charged; the Stripe webhook marks it 'paid' with the
-- real totals (tax and shipping included), the address Stripe collected,
-- and the gift certificate codes it issued.
create table orders (
  id uuid primary key default gen_random_uuid(),
  ref text generated always as ('LUM-' || upper(left(id::text, 8))) stored,   -- the order number on the receipt
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  email text not null,
  name text,
  client_id uuid references clients (id) on delete set null,
  items jsonb not null default '[]',              -- [{ "id", "name", "qty", "price_cents" }]
  gifts jsonb not null default '[]',              -- [{ "amount_cents", "recipient_name", "recipient_email", "message", "send_date", "to_buyer" }]
  delivery text not null default 'none' check (delivery in ('ship', 'pickup', 'none')),
  subtotal_cents int not null,
  shipping_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int,
  address jsonb,                                  -- { name, street, apt, city, state, zip }
  gift_codes text[] not null default '{}',
  stripe_session text unique,
  stripe_payment_intent text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_paid on orders (paid_at desc) where status = 'paid';
create index orders_ref on orders (ref);
alter table orders enable row level security;
create policy "clients read their own orders" on orders
  for select using (lower(email) = lower(auth.jwt() ->> 'email'));

-- ─────────────────────────────────────────────────────────────
-- Lumevina Studio: what Evelyn's phone is told (functions/_shared/notify.ts)
-- Every alert is kept (the dashboard's feed), pushed to each phone she
-- turned notifications on for, and summed up in the morning email
-- (functions/studio-digest).
-- ─────────────────────────────────────────────────────────────
create table studio_alerts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('order', 'question', 'low_stock', 'gift', 'test', 'booking', 'cancel', 'member', 'waitlist')),
  title text not null,
  body text,
  url text,                                       -- where the dashboard should open
  created_at timestamptz not null default now()
);
create table studio_push (
  endpoint text primary key,                      -- the phone's push address
  subscription jsonb not null,
  label text,                                     -- "Evelyn's iPhone"
  created_at timestamptz not null default now()
);
alter table studio_alerts enable row level security;
alter table studio_push enable row level security;
-- no policies: only edge functions (service role) read or write these.


-- ─────────────────────────────────────────────────────────────
-- v3: booking moves home (functions/book, studio-book, membership,
-- rewards, client-reminders). See server/README.md → v3.
-- ─────────────────────────────────────────────────────────────

-- Evelyn's client list: everyone who books or buys, and everyone she
-- imports from GlossGenius (dashboard → Clients → Import). Keyed by email.
create table contacts (
  email text primary key check (email = lower(email)),
  name text,
  phone text,
  birthday text,                   -- as GlossGenius exports it ("May 14"); birth_month is what points use
  birth_month int check (birth_month between 0 and 11),
  birthday_claimed_year int,
  notes text,                      -- Evelyn's own, never shown to the client
  source text not null default 'website' check (source in ('website', 'glossgenius', 'studio')),
  sms_ok boolean not null default false,
  email_ok boolean not null default true,      -- false once they unsubscribe (functions/client-prefs)
  stripe_customer text,            -- their card on file
  payment_method text,
  card_label text,
  deposit_credit_cents int not null default 0, -- a deposit carried over from a booking cancelled in time
  deposit_credit_until date,                   -- the end of that booking's month
  ref_code text unique,            -- GLOW-XXXX: a friend's first visit $15 off, 150 points to them
  referred_by text,                -- the friend's code they used
  referral_credited boolean not null default false,
  first_booked_at timestamptz,     -- the 100-point first booking here
  last_visit date,
  visits int not null default 0,   -- completed visits (GlossGenius history counts on import)
  imported_at timestamptz,
  invited_at timestamptz,          -- the "book with me on the website now" email
  created_at timestamptz not null default now()
);
alter table contacts enable row level security;
create policy "clients read their own contact" on contacts
  for select using (email = lower(auth.jwt() ->> 'email'));
-- writes only in edge functions (service role).

-- A full day: clients wait for a time to open (js/booking.js → Join the
-- waitlist). A cancellation emails and texts everyone waiting on that day.
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  services jsonb not null default '[]',
  name text not null,
  email text not null check (email = lower(email)),
  phone text,
  sms_ok boolean not null default false,
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'booked', 'removed')),
  offered_at timestamptz,
  created_at timestamptz not null default now()
);
create index waitlist_by_day on waitlist (date) where status in ('waiting', 'offered');
alter table waitlist enable row level security;

-- Every automatic message, once: reminders, review requests, "time for
-- your next facial", "running low?", waitlist offers (functions/client-reminders).
create table sent_messages (
  id bigint generated always as identity primary key,
  kind text not null,              -- 'reminder', 'text_reminder', 'review', 'rebook', 'restock', 'waitlist', 'invite'
  ref text not null,               -- the booking, order or contact it was about
  email text,
  sent_at timestamptz not null default now(),
  unique (kind, ref)
);
alter table sent_messages enable row level security;

-- Settings the website reads: Evelyn's hours (js/hours.js), edited in the
-- dashboard through functions/studio (hours_set).
create table site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table site_settings enable row level security;
create policy "anyone reads the site settings" on site_settings for select using (true);
