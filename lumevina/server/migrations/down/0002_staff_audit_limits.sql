-- Reverses 0002.
drop function if exists public.take_token(text, int, double precision);
drop table if exists rate_limits;
drop trigger if exists audit_log_append_only on audit_log;
drop table if exists audit_log;
drop function if exists public.lumevina_append_only();
drop table if exists staff;
