-- 0003 · Consents, one row per yes or no, with the exact text agreed to
--
-- Four separate consents, never bundled:
--   clinical_photography  photos and magnified images of their skin for their own record
--   treatment             keeping a record of each treatment and its settings
--   ai_processing         photos sent with a chat question may be read by the AI assistant
--   marketing             selected photos, without their name, in Lumevina's own posts
-- consent_texts holds every published version (the words and their hash);
-- consents holds each answer: who, which version, yes or no, how it was
-- signed, by whom, and when it was withdrawn. The latest row per email and
-- kind is the one in force (current_consents). Rows are never edited except
-- to stamp withdrawn_at once.
--
-- The '1-draft' texts below are drafts for counsel to review
-- (skin-intelligence/PRIVACY-SECURITY.md). No real client signs them:
-- counsel's approved wording goes in as version '1' before the pilot.

create table consent_texts (
  kind text not null check (kind in ('clinical_photography', 'treatment', 'ai_processing', 'marketing')),
  version text not null,
  title text not null,
  body text not null,
  body_sha256 text not null,
  published_at timestamptz not null default now(),
  retired_at timestamptz,
  primary key (kind, version)
);
alter table consent_texts enable row level security;
create policy "anyone reads consent texts" on consent_texts for select using (true);

create table consents (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  client_id uuid references clients (id) on delete set null,
  kind text not null,
  version text not null,
  granted boolean not null,             -- a no is recorded as clearly as a yes
  signature text,                       -- their typed name
  source text not null check (source in ('client', 'studio', 'intake', 'booking')),
  recorded_by uuid references auth.users (id) on delete set null,   -- staff who recorded it in the studio; null = the client
  recorded_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  ip_hash text,
  user_agent text,
  foreign key (kind, version) references consent_texts (kind, version)
);
create index consents_email on consents (email, kind, recorded_at desc);
alter table consents enable row level security;
create policy "clients read their own consents" on consents
  for select using (email = lower(auth.jwt() ->> 'email'));

create or replace function public.consents_guard() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('lumevina.purge', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then raise exception 'consents are kept' using errcode = '42501'; end if;
  if old.withdrawn_at is null and new.withdrawn_at is not null
     and (to_jsonb(new) - 'withdrawn_at') = (to_jsonb(old) - 'withdrawn_at') then
    return new;
  end if;
  raise exception 'a consent can only be withdrawn, once' using errcode = '42501';
end $$;
create trigger consents_guard before update or delete on consents
  for each row execute function public.consents_guard();

create view current_consents with (security_invoker = true) as
  select distinct on (email, kind) id, email, client_id, kind, version, granted, recorded_at, withdrawn_at,
         (granted and withdrawn_at is null) as active
    from consents
   order by email, kind, recorded_at desc, id;

insert into consent_texts (kind, version, title, body, body_sha256)
select kind, '1-draft', title, body, encode(sha256(convert_to(body, 'UTF8')), 'hex')
from (values
  ('clinical_photography', 'Photos of your skin, for your record',
   'I agree that Lumevina may take photographs and magnified images of my face and of any area being treated, at my visits, and that I may add my own, to keep a private record of how my skin looks over time and to compare one visit with another. The images are stored privately and seen only by me and the Lumevina practitioner caring for me. They are never posted, never shared, and never sent to an AI service. Measurements made from them describe how my skin looks in a photograph; they are not a diagnosis. I can stop at any time; images already taken stay in my record unless I ask for them to be deleted.'),
  ('treatment', 'Your treatment records',
   'I agree that Lumevina keeps a record of each treatment I receive: the date, the areas treated, the device and its settings, the products used, how my skin responded, and the aftercare I was given, so my practitioner can plan each visit safely. The detailed record is kept by my practitioner; I see a summary in my progress reports and can ask for a full copy at any time.'),
  ('ai_processing', 'Photos you send with a question',
   'When I send a photo with a question in Ask Lumevina, I agree that it may be read by an AI assistant (Claude, by Anthropic) to help draft Evelyn''s reply. Evelyn reads and decides every reply herself. Without this yes, my photos go to Evelyn only. Photos taken for my skin record are never sent to an AI service, whatever I choose here.'),
  ('marketing', 'Photos in Lumevina''s own posts',
   'I agree that Lumevina may use selected photos of my skin, without my name, in its own posts, website or printed materials. Lumevina will show me each photo before it is used, and I can withdraw this at any time; photos already published will be taken down where Lumevina controls them.')
) as t(kind, title, body);
