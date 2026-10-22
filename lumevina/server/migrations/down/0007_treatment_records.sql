-- Reverses 0007.
drop trigger if exists treatment_records_guard on treatment_records;
drop table if exists treatment_records;
drop function if exists public.treatment_records_guard();
