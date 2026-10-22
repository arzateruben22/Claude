-- Reverses 0003.
drop view if exists current_consents;
drop trigger if exists consents_guard on consents;
drop function if exists public.consents_guard();
drop table if exists consents;
drop table if exists consent_texts;
