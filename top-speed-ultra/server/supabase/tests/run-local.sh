#!/usr/bin/env bash
# Optional, for reviewers: run the migration twice on a throwaway local Postgres (16 here) with a stub of the parts
# of Supabase it relies on (the API roles, auth.users, auth.uid()), then probe row-level security as the service role,
# a signed-in player and an anonymous visitor. Every "ERROR: permission denied" / "violates" line is expected: each is
# a write the policies must refuse. Usage: server/supabase/tests/run-local.sh  (needs initdb, pg_ctl and psql on PATH
# or in /usr/lib/postgresql/16/bin; never touches a real project)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
tmp="$(mktemp -d)"; port=54331
trap '"$bin/pg_ctl" -D "$tmp/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
"$bin/initdb" -D "$tmp/data" -A trust -U postgres >/dev/null
"$bin/pg_ctl" -D "$tmp/data" -o "-p $port -k $tmp -c listen_addresses=" -l "$tmp/log" start >/dev/null
psql=(psql -h "$tmp" -p "$port" -U postgres -X -q)
"${psql[@]}" -c 'create database store'
"${psql[@]}" -d store -v ON_ERROR_STOP=1 -f "$here/stub-supabase.sql"
"${psql[@]}" -d store -v ON_ERROR_STOP=1 -f "$here/../migrations/0001_oc_ultra_store.sql" 2>/dev/null
"${psql[@]}" -d store -v ON_ERROR_STOP=1 -f "$here/../migrations/0001_oc_ultra_store.sql" 2>/dev/null
echo "migration ran twice"
"${psql[@]}" -d store -t -f "$here/rls-probe.sql" 2>&1 | sed '/^$/d; s/^psql:[^E]*ERROR:/  refused:/'
