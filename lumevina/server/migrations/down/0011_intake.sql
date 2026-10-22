-- Reverses 0011.
drop policy if exists "own intake by email" on intake_forms;
alter table intake_forms drop column if exists form_version;
alter table intake_forms drop column if exists updated_at;
