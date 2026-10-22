-- Reverses 0006.
drop table if exists change_detections;
drop table if exists measurement_validation;
drop trigger if exists measurements_guard on measurements;
drop table if exists measurements;
drop function if exists public.measurements_guard();
drop table if exists analyses;
