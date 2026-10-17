-- Row-level security probe for 0001_oc_ultra_store.sql (run-local.sh). Each refused write below is expected.
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
