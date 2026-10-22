-- Reverses 0009.
drop table if exists data_requests;
drop trigger if exists progress_reports_guard on progress_reports;
drop table if exists progress_reports;
drop function if exists public.progress_reports_guard();
