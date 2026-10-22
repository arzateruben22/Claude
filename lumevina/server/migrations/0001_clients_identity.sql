-- 0001 · Every signed-in person gets a `clients` row
--
-- schema.sql made `clients` (one row per auth user) but nothing ever wrote
-- to it, so bookings.client_id (a foreign key to it) failed for signed-in
-- website bookings, and every policy keyed on auth.uid() could never match.
-- Skin Intelligence needs a stable internal id for each client, so this
-- fills it: a trigger on sign-up, a default referral code, the email kept
-- in step when someone changes it, and a backfill for existing users.
-- Nothing is dropped or renamed. Reverse: down/0001_clients_identity.sql.

alter table clients alter column ref_code
  set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

-- schema.sql's policy let a signed-in client write their own row ("for all"),
-- harmless while no rows existed. With rows, that would let anyone edit their
-- referral and visit fields from the browser. Reading stays; writes are the
-- functions' (service role).
drop policy if exists "own profile" on clients;
create policy "own profile" on clients for select using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is null then return new; end if;
  insert into public.clients (id, email, name)
  values (new.id, lower(new.email), nullif(trim(new.raw_user_meta_data ->> 'name'), ''))
  on conflict do nothing;
  return new;
end $$;

create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.clients set email = lower(new.email) where id = new.id;
  end if;
  return new;
end $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;

create trigger lumevina_on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();
create trigger lumevina_on_auth_user_email_changed
  after update of email on auth.users for each row execute function public.handle_user_email_change();

insert into public.clients (id, email, name)
select u.id, lower(u.email), nullif(trim(u.raw_user_meta_data ->> 'name'), '')
  from auth.users u
 where u.email is not null
on conflict do nothing;
