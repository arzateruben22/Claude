-- 0011 · The pre-visit form reaches the server
--
-- js/intake.js kept the form only in the browser (its live save was a TODO),
-- so the server never had a client's allergies, conditions or photo answers,
-- and every client showed "Pre-visit form missing". functions/intake now
-- saves it (service role) and records its consents in `consents`. The
-- existing policy keys on client_id, which is set once they sign in; this
-- adds the email key the rest of the schema uses, for reading only.

alter table intake_forms add column if not exists updated_at timestamptz not null default now();
alter table intake_forms add column if not exists form_version text;

create policy "own intake by email" on intake_forms
  for select using (email = lower(auth.jwt() ->> 'email'));
