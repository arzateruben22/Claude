-- 0010 · Close what the public anon key could reach
--
-- Supabase grants every public table and view to anon and authenticated by
-- default; row-level security is what stands in the way. These had none:
--   flash_slots, notifications   no RLS at all: readable and writable by anyone
--                                with the anon key. Only the functions use them.
--   reward_balances              a view runs with its owner's rights, so it
--                                listed every client's email and points to anyone.
--                                Only functions/_shared/points.ts reads it.
-- shelf stays public on purpose (the website's stock counts).

alter table flash_slots enable row level security;
alter table notifications enable row level security;
revoke all on reward_balances from anon, authenticated;
