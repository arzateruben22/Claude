-- 0007 · Treatment records (microchanneling and every other treatment)
--
-- Written by the practitioner at the visit; private to the practitioner.
-- The client never reads this table: they see client_summary, a line the
-- practitioner writes for them, in their reports. The software records the
-- settings she chose; it never suggests a needle depth, an energy, or
-- whether someone may be treated.
--
-- A draft can be edited until it is signed. A signed record is fixed; a
-- correction is a new record with amended_from pointing at the old one,
-- which is then marked 'amended'. Series (the ProCell package of four) are
-- tracked in `series`.

create table treatment_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references skin_profiles (id) on delete cascade,
  session_id uuid references imaging_sessions (id) on delete set null,
  booking_id uuid references bookings (id) on delete set null,
  service_id text,                      -- js/services.js id: procell-microchanneling, procell-package, ...
  treated_at timestamptz not null,
  performed_by uuid not null references auth.users (id),
  device text,                          -- "ProCell Microchanneling Device", the pen and cartridge
  treatment_type text not null,         -- 'microchanneling', 'microneedling', 'peel', 'facial', ...
  areas text[] not null default '{}',   -- regions treated
  needle_depth_mm jsonb not null default '{}'::jsonb,   -- { "forehead": 0.25, "left_cheek": 0.5 } as she set it
  rf jsonb,                             -- { device, mode, energy, passes } when radiofrequency was used
  topicals text[] not null default '{}',
  notes_private text,
  reactions text,                       -- what was observed or reported
  adverse_event boolean not null default false,
  recovery_guidance text,               -- the aftercare she gave
  follow_up_on date,
  client_summary text,                  -- the line the client sees in their report
  series jsonb,                         -- { package: 'procell-package', session_no: 2, of: 4 }
  status text not null default 'draft' check (status in ('draft', 'signed', 'amended')),
  signed_at timestamptz,
  amended_from uuid references treatment_records (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index treatment_records_profile on treatment_records (profile_id, treated_at desc);
alter table treatment_records enable row level security;
revoke all on treatment_records from anon, authenticated;

create or replace function public.treatment_records_guard() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('lumevina.purge', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if old.status = 'draft' then return old; end if;
    raise exception 'a signed treatment record is kept' using errcode = '42501';
  end if;
  if old.status = 'signed' then
    if new.status = 'amended' and (to_jsonb(new) - array['status', 'updated_at']) = (to_jsonb(old) - array['status', 'updated_at']) then
      return new;
    end if;
    raise exception 'a signed treatment record cannot change; write an amendment' using errcode = '42501';
  end if;
  if old.status = 'amended' then
    raise exception 'an amended treatment record cannot change' using errcode = '42501';
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger treatment_records_guard before update or delete on treatment_records
  for each row execute function public.treatment_records_guard();
