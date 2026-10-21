-- OC Ultra store, 0002: the OC Hypercar Founder Edition's serial numbers (PROJECT_OC_HYPERCAR.md §7 and §11).
-- Run after 0001, in the Supabase SQL editor (or `supabase db push`). Safe to run twice.
--
-- The rules this enforces:
--   * The server numbers each sale, never the device. Only the stripe-webhook function (the service role) calls
--     assign_serial, after the payment succeeds; players can't execute it, and can't write either table.
--   * One number per Checkout Session. A purchase row is unique per session (0001), and serials.purchase_id is
--     unique, so a retried webhook delivery, or the session's second success event, gets back the number it already
--     has. Concurrent deliveries queue on the sku's counter row (select ... for update), so a sku's numbers are
--     handed out one at a time and the counter has no gaps from races.
--   * Numbers start at 1 (No. 0001) and only go up. No. 0000 is reserved for owner-mode tests and can never be
--     issued (serial >= 1 everywhere).
--   * A refunded number is retired, never reissued: marking the purchase refunded retires its number (the trigger
--     below), the counter never goes back, and (sku, serial) is the primary key, so a number exists once. Deleting
--     an account keeps the ledger row (user and purchase set to null), so even then the number is never reissued.
--   * A refund never races the numbering: assign_serial locks the purchase row before it reads the status, so a
--     refund being written at the same moment either commits first (and assign_serial refuses: not paid) or waits
--     until the number is issued (and then retires it).
--   * One live number per player per sku: a second paid purchase by a player who already holds a live number (two
--     checkouts opened side by side both pass create-checkout's "already own" check) is refused, never numbered,
--     and the webhook refunds it in full.
--   * The plaque never shows a retired number: when a purchase is refunded, the player's entitlement rows for that
--     sku go back to their lowest live number, or to none.
--   * A player reads their own serial (on their entitlement rows, and in serials), and never writes it.

-- ------------------------------------------------------------------------------------------- purchases
-- 'refused': a founder purchase the store doesn't honour, refunded in full by the webhook (stripe-webhook):
--   * paid through a Checkout Session created after the founder window closed (it grants nothing), or
--   * a second OC Hypercar Founder Edition for a player who already holds a live number (assign_serial below; it
--     gets no number, and the player keeps the one they have).
alter table public.purchases drop constraint if exists purchases_status_check;
alter table public.purchases add constraint purchases_status_check check (status in ('paid', 'refunded', 'ended', 'refused'));

-- ------------------------------------------------------------------------------------------- tables
-- the number on the plaque, on each entitlement row the numbered sku granted (null for everything else)
alter table public.entitlements add column if not exists serial integer check (serial is null or serial >= 1);

-- one counter per numbered sku: `next` is the number the next sale gets
create table if not exists public.serial_counters (
  sku  text primary key,
  next integer not null default 1 check (next >= 1)
);
insert into public.serial_counters (sku, next) values ('hypercar-founder', 1) on conflict (sku) do nothing;

-- the ledger: every number ever issued, to whom, for which purchase, and whether it was retired
create table if not exists public.serials (
  sku         text not null references public.serial_counters (sku),
  serial      integer not null check (serial >= 1),
  purchase_id uuid unique references public.purchases (id) on delete set null,
  user_id     uuid references auth.users (id) on delete set null,
  issued_at   timestamptz not null default now(),
  retired_at  timestamptz,                               -- set when the purchase is refunded; never cleared
  primary key (sku, serial)
);
create index if not exists serials_user_idx on public.serials (user_id);

-- ------------------------------------------------------------------------------------------- functions
-- The webhook's one call (POST /rest/v1/rpc/assign_serial { p_purchase }): the purchase's number, issuing the next
-- one if it has none yet, written to the entitlement rows that purchase's sku granted. Idempotent per purchase.
-- Returns null when it refuses the purchase instead: a second one for a player who already holds a live number. The
-- purchase is then marked 'refused' (in the same transaction) and the webhook refunds it.
create or replace function public.assign_serial(p_purchase uuid) returns integer
language plpgsql set search_path = public, pg_temp as $$
declare
  v_user uuid; v_sku text; v_status text; v_serial integer;
begin
  -- the purchase row is locked first: a refund marking it refunded at this moment either committed before (and is
  -- seen here) or waits until this transaction ends (and its trigger then retires the number issued below)
  select user_id, sku, status into v_user, v_sku, v_status from public.purchases where id = p_purchase for update;
  if not found then raise exception 'assign_serial: no purchase %', p_purchase; end if;
  if v_status <> 'paid' then raise exception 'assign_serial: purchase % is %, not paid', p_purchase, v_status; end if;
  -- one sale at a time per sku: concurrent deliveries wait here, then see the number the first one issued
  perform 1 from public.serial_counters where sku = v_sku for update;
  if not found then raise exception 'assign_serial: % is not a numbered sku', v_sku; end if;
  select serial into v_serial from public.serials where purchase_id = p_purchase;
  if v_serial is null then
    -- one live number per player: a second purchase (two checkouts opened side by side) is refused, never numbered
    if exists (select 1 from public.serials where user_id = v_user and sku = v_sku and retired_at is null) then
      update public.purchases set status = 'refused' where id = p_purchase;
      return null;
    end if;
    update public.serial_counters set next = next + 1 where sku = v_sku returning next - 1 into v_serial;
    insert into public.serials (sku, serial, purchase_id, user_id) values (v_sku, v_serial, p_purchase, v_user);
  end if;
  update public.entitlements set serial = v_serial where user_id = v_user and sku = v_sku and revoked_at is null;
  return v_serial;
end $$;

-- a refund retires the purchase's number, whichever path marks it refunded, and the player's entitlement rows for
-- that sku go back to their lowest live number (or to none), so the plaque never shows a retired number
create or replace function public.retire_serial() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status = 'refunded' and old.status is distinct from 'refunded'
     and exists (select 1 from public.serial_counters where sku = new.sku) then
    update public.serials set retired_at = coalesce(retired_at, now()) where purchase_id = new.id;
    update public.entitlements set serial = (
      select min(serial) from public.serials where user_id = new.user_id and sku = new.sku and retired_at is null
    ) where user_id = new.user_id and sku = new.sku;
  end if;
  return new;
end $$;
drop trigger if exists purchases_retire_serial on public.purchases;
create trigger purchases_retire_serial after update of status on public.purchases
  for each row execute function public.retire_serial();

-- ------------------------------------------------------------------------------------------- row-level security
alter table public.serial_counters enable row level security;
alter table public.serials         enable row level security;

drop policy if exists "serials: read own" on public.serials;
create policy "serials: read own" on public.serials for select to authenticated using ((select auth.uid()) = user_id);
-- serial_counters: no policy at all, so only the service role reaches it

-- ------------------------------------------------------------------------------------------- grants
-- Functions are executable by PUBLIC by default, and Supabase's default privileges grant new ones to the API roles:
-- take both away, so a player can never issue or retire a number.
revoke all on public.serial_counters, public.serials from anon, authenticated;
grant select on public.serials to authenticated;
grant all on public.serial_counters, public.serials to service_role;
revoke all on function public.assign_serial(uuid) from public, anon, authenticated;
grant execute on function public.assign_serial(uuid) to service_role;
revoke all on function public.retire_serial() from public, anon, authenticated;
-- entitlements.serial: 0001 grants players select only on entitlements, so they read their number and can't write it
