-- Reverses 0005. The bucket is removed only when it is empty.
delete from storage.buckets b where b.id = 'skin-images'
  and not exists (select 1 from storage.objects o where o.bucket_id = 'skin-images');
drop function if exists public.claim_analysis_job(text);
drop table if exists analysis_jobs;
drop table if exists quality_checks;
drop table if exists derived_images;
drop trigger if exists captures_guard on captures;
drop table if exists captures;
drop function if exists public.captures_guard();
drop table if exists imaging_sessions;
