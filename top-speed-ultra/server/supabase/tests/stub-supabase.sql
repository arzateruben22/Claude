-- A stub of the parts of a Supabase project that 0001_oc_ultra_store.sql relies on, for run-local.sh only.
-- the bits of a Supabase project the migration relies on: the API roles, auth.users and auth.uid()
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase's default privileges grant everything on new public tables to the API roles; the migration must cope
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'a@example.com'), ('22222222-2222-2222-2222-222222222222', 'b@example.com');
