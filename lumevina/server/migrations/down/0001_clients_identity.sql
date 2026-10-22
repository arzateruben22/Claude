-- Reverses 0001. The clients rows it created stay (bookings may point at them).
drop trigger if exists lumevina_on_auth_user_email_changed on auth.users;
drop trigger if exists lumevina_on_auth_user_created on auth.users;
drop function if exists public.handle_user_email_change();
drop function if exists public.handle_new_user();
alter table clients alter column ref_code drop default;
drop policy if exists "own profile" on clients;
create policy "own profile" on clients
  for all using (auth.uid() = id) with check (auth.uid() = id);
