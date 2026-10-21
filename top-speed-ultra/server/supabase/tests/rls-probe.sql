-- Row-level security probe for 0001_oc_ultra_store.sql and 0002_founder_serials.sql (run-local.sh), and for the Ultra
-- graphics tier's entitlement (graphics-ultra), which rides 0001's entitlements table. Each refused write below is expected.
\set ON_ERROR_STOP 0
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
-- the webhook (service role) writes a purchase and entitlements for A and one for B
set role service_role;
insert into purchases (user_id, sku, stripe_session_id, stripe_payment_intent, amount_cents, currency) values (:'A', 'founder-pack-2026', 'cs_test_A1', 'pi_A1', 1000, 'usd'), (:'B', 'paint-pack-coast', 'cs_test_B1', 'pi_B1', 300, 'usd');
insert into purchases (user_id, sku, stripe_session_id, amount_cents) values (:'A', 'founder-pack-2026', 'cs_test_A1', 1000) on conflict (stripe_session_id) do nothing;
select 'service: purchases rows = ' || count(*) from purchases;
insert into entitlements (user_id, entitlement, sku) values (:'A', 'paint-founders-sunset', 'founder-pack-2026'), (:'B', 'paint-laguna-tidepool', 'paint-pack-coast');
reset role;
-- player A
set role authenticated; set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select 'A sees purchases: ' || string_agg(stripe_session_id, ',') from purchases;
select 'A sees entitlements: ' || string_agg(entitlement, ',') from entitlements;
insert into entitlements (user_id, entitlement, sku) values (:'A', 'paint-405-midnight', 'x');
insert into purchases (user_id, sku, stripe_session_id, amount_cents) values (:'A', 'x', 'cs_fake', 0);
update entitlements set revoked_at = null where true;
delete from entitlements where true;
select 'A entitlements after write attempts: ' || count(*) from entitlements;
insert into profiles (id, is_13_plus) values (:'A', true) on conflict (id) do update set id = excluded.id, is_13_plus = excluded.is_13_plus;
insert into profiles (id, is_13_plus) values (:'A', true) on conflict (id) do update set id = excluded.id, is_13_plus = excluded.is_13_plus;
select 'A profile: ' || is_13_plus from profiles;
insert into profiles (id, is_13_plus) values (:'B', true);
select 'A reads waitlist: ' || count(*) from waitlist;
reset role;
-- an anonymous visitor
set role anon; reset request.jwt.claims;
insert into waitlist (email, zip) values ('fan@example.com', '92805');
insert into waitlist (email, zip, referral_code) values ('cheat@example.com', '92805', 'aaaaaaaaaa');
insert into waitlist (email, zip) values ('bad-email', '92805');
insert into waitlist (email, zip) values ('fan2@example.com', 'ABCDE');
select 'anon reads waitlist: ' || count(*) from waitlist;
select 'anon reads purchases: ' || count(*) from purchases;
select 'anon reads invite codes: ' || count(*) from invite_codes;
insert into profiles (id, is_13_plus) values (:'A', true);
reset role;
select 'waitlist rows (owner view): ' || count(*) || ', referral code ' || min(referral_code) from waitlist;
-- refunds: service role marks refunded and revokes
set role service_role;
update purchases set status = 'refunded', refunded_at = now() where stripe_payment_intent = 'pi_A1';
update entitlements set revoked_at = now() where user_id = :'A' and entitlement in ('paint-founders-sunset') and revoked_at is null;
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select 'A live entitlements after refund: ' || count(*) from entitlements where revoked_at is null;
-- ------------------------------------------------------------------------------------------- 0002: serial numbers
-- the webhook (service role) records an OC Hypercar Founder Edition purchase for A and one for B, grants the car and
-- numbers each through assign_serial (a second call for the same purchase gets the same number)
set role service_role;
insert into purchases (user_id, sku, stripe_session_id, stripe_payment_intent, amount_cents, currency) values (:'A', 'hypercar-founder', 'cs_test_A2', 'pi_A2', 499, 'usd'), (:'B', 'hypercar-founder', 'cs_test_B2', 'pi_B2', 499, 'usd');
insert into entitlements (user_id, entitlement, sku) values (:'A', 'car-oc-hyper', 'hypercar-founder'), (:'B', 'car-oc-hyper', 'hypercar-founder');
select 'service: assign_serial for A = ' || assign_serial((select id from purchases where stripe_session_id = 'cs_test_A2'));
select 'service: assign_serial for B = ' || assign_serial((select id from purchases where stripe_session_id = 'cs_test_B2'));
select 'service: assign_serial for A again = ' || assign_serial((select id from purchases where stripe_session_id = 'cs_test_A2'));
reset role;
-- player A: reads their own number (in serials and on the entitlement row) and nothing else; every write and call is refused
set role authenticated; set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select 'A sees serials: ' || coalesce(string_agg(serial::text, ','), 'none') from serials;
select 'A sees the number on the car row: ' || coalesce(serial::text, 'none') from entitlements where entitlement = 'car-oc-hyper';
select 'A reads serial_counters: ' || count(*) from serial_counters;
insert into serials (sku, serial, user_id) values ('hypercar-founder', 99, :'A');
update serials set retired_at = now() where true;
delete from serials where true;
update serial_counters set next = 1 where true;
update entitlements set serial = 1 where entitlement = 'car-oc-hyper';
select assign_serial((select id from purchases where stripe_session_id = 'cs_test_A2'));
select retire_serial();
select 'A serials after write attempts: ' || coalesce(string_agg(serial || case when retired_at is null then ' live' else ' retired' end, ','), 'none') from serials;
reset role;
-- an anonymous visitor: nothing at all
set role anon; reset request.jwt.claims;
select 'anon reads serials: ' || count(*) from serials;
select 'anon reads serial_counters: ' || count(*) from serial_counters;
insert into serials (sku, serial, user_id) values ('hypercar-founder', 98, :'A');
update serial_counters set next = 1 where true;
select assign_serial('00000000-0000-0000-0000-000000000000');
select retire_serial();
reset role;
-- a refund (service role) retires A's number and clears it from A's car row; B's stays
set role service_role;
update purchases set status = 'refunded', refunded_at = now() where stripe_session_id = 'cs_test_A2';
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select 'A serials after refund: ' || string_agg(serial || case when retired_at is null then ' live' else ' retired' end, ',') from serials;
select 'A car row after refund: ' || coalesce(serial::text, 'no number') from entitlements where entitlement = 'car-oc-hyper';
reset role;
select 'ledger (owner view): ' || string_agg(serial || case when retired_at is null then ' live' else ' retired' end, ', ' order by serial) || '; counter next ' || (select next from serial_counters where sku = 'hypercar-founder') from serials;
-- ------------------------------------------------------------------------------------------- the Ultra graphics tier
-- graphics-ultra lives in 0001's entitlements table: only the webhook (service role) grants or revokes it, a player
-- reads their own row (that is what Restore purchases reads) and can't grant it to themselves, take another player's,
-- or undo a refund's revoke; an anonymous visitor reads nothing
set role service_role;
insert into purchases (user_id, sku, stripe_session_id, stripe_payment_intent, amount_cents, currency) values (:'B', 'graphics-ultra', 'cs_test_B3', 'pi_B3', 500, 'usd');
insert into entitlements (user_id, entitlement, sku) values (:'B', 'graphics-ultra', 'graphics-ultra');
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select 'A sees graphics-ultra rows (B has one): ' || count(*) from entitlements where entitlement = 'graphics-ultra';
insert into entitlements (user_id, entitlement, sku) values (:'A', 'graphics-ultra', 'graphics-ultra');
update entitlements set user_id = :'A' where entitlement = 'graphics-ultra';
insert into purchases (user_id, sku, stripe_session_id, amount_cents) values (:'A', 'graphics-ultra', 'cs_fake_ultra', 0);
reset role;
select 'graphics-ultra rows after A''s attempts (owner view): ' || string_agg(case when user_id = :'B' then 'B' else 'A' end, ',') from entitlements where entitlement = 'graphics-ultra';
set role authenticated; set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select 'B restores: ' || string_agg(entitlement, ',') from entitlements where revoked_at is null and entitlement = 'graphics-ultra';
reset role;
set role service_role;
update purchases set status = 'refunded', refunded_at = now() where stripe_session_id = 'cs_test_B3';
update entitlements set revoked_at = now() where user_id = :'B' and entitlement = 'graphics-ultra' and revoked_at is null;
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
update entitlements set revoked_at = null where entitlement = 'graphics-ultra';
select 'B restores after the refund: ' || count(*) || ' live graphics-ultra row(s)' from entitlements where revoked_at is null and entitlement = 'graphics-ultra';
reset role;
set role anon; reset request.jwt.claims;
select 'anon reads graphics-ultra: ' || count(*) from entitlements where entitlement = 'graphics-ultra';
reset role;
