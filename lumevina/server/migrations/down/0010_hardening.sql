-- Reverses 0010 (puts the gaps back; only for rolling back this migration itself).
grant all on reward_balances to anon, authenticated;
alter table notifications disable row level security;
alter table flash_slots disable row level security;
