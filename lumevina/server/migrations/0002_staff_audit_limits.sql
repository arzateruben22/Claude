-- 0002 · Staff accounts, the audit log, and rate limits
--
-- staff: the people who sign in to Lumevina Studio with their own account
--   (Supabase Auth, multifactor required by the functions). Two roles:
--   practitioner (clients' imaging and treatment records) and admin
--   (everything a practitioner can do, plus staff, devices, retention,
--   the audit log). Evelyn is both at launch: one row, role 'admin'.
--   The shared STUDIO_KEY keeps serving cron and the existing dashboard
--   actions; Skin Intelligence never accepts it.
-- audit_log: who read or changed what, append-only. Written by the edge
--   functions (service role); no policies, so no browser can read it.
-- rate_limits: a token bucket per key, taken in one statement by
--   take_token(); the functions call it before expensive or sensitive work.

create table staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (email = lower(email)),
  display_name text not null,
  role text not null check (role in ('practitioner', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table staff enable row level security;
create policy "staff read their own row" on staff for select using (user_id = auth.uid());

create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_user_id uuid,
  actor_role text not null check (actor_role in ('client', 'practitioner', 'admin', 'system', 'worker')),
  action text not null,                 -- 'capture.view', 'treatment.sign', 'staff.set', ...
  profile_id uuid,                      -- the client the record belongs to, when there is one
  record_table text,
  record_id text,
  outcome text not null default 'ok' check (outcome in ('ok', 'denied', 'error')),
  detail jsonb,                         -- never images, never free-text notes
  ip_hash text,                         -- sha-256 of the address with a server secret, not the address
  user_agent text
);
create index audit_log_profile on audit_log (profile_id, at desc);
create index audit_log_actor on audit_log (actor_user_id, at desc);
create index audit_log_at on audit_log (at desc);
alter table audit_log enable row level security;
revoke all on audit_log from anon, authenticated;

-- Append-only tables refuse updates and deletes. A retention run sets
-- lumevina.purge = 'on' for its own transaction (documented in
-- skin-intelligence/PRIVACY-SECURITY.md); nothing else can.
create or replace function public.lumevina_append_only() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('lumevina.purge', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;
create trigger audit_log_append_only before update or delete on audit_log
  for each row execute function public.lumevina_append_only();

create table rate_limits (
  key text primary key,                 -- 'skin:capture:<user id>'
  tokens double precision not null,
  updated_at timestamptz not null default now()
);
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;

-- true when the call may go ahead: refills at p_per_minute, holds at most p_capacity
create or replace function public.take_token(p_key text, p_capacity int, p_per_minute double precision)
returns boolean language plpgsql security definer set search_path = public as $$
declare left_after double precision;
begin
  insert into rate_limits as r (key, tokens, updated_at)
  values (p_key, p_capacity - 1, now())
  on conflict (key) do update
     set tokens = least(p_capacity::double precision,
                        r.tokens + extract(epoch from (now() - r.updated_at)) / 60.0 * p_per_minute) - 1,
         updated_at = now()
  returning tokens into left_after;
  if left_after < 0 then
    update rate_limits set tokens = 0 where key = p_key;
    return false;
  end if;
  return true;
end $$;
revoke all on function public.take_token(text, int, double precision) from public, anon, authenticated;
