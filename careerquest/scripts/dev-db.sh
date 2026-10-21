#!/usr/bin/env bash
# Starts a throwaway local PostgreSQL 16 cluster for CareerQuest development (Linux with postgresql-16 installed).
# Usage: scripts/dev-db.sh [start|stop|status]
set -euo pipefail
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGDATA=${PGDATA:-/var/lib/postgresql/careerquest-dev}
PGPORT=${PGPORT:-5432}
cmd=${1:-start}
run_as_pg() { if [ "$(id -u)" = "0" ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
case "$cmd" in
  start)
    if [ ! -d "$PGDATA" ]; then
      mkdir -p "$PGDATA"; [ "$(id -u)" = "0" ] && chown postgres:postgres "$PGDATA"
      run_as_pg "$PGBIN/initdb -D $PGDATA --auth=trust -U postgres" >/dev/null
    fi
    run_as_pg "$PGBIN/pg_ctl -D $PGDATA -l $PGDATA/server.log -o '-p $PGPORT -c listen_addresses=127.0.0.1' start" || true
    sleep 1
    for db in careerquest careerquest_test; do
      run_as_pg "$PGBIN/psql -h 127.0.0.1 -p $PGPORT -U postgres -tc \"SELECT 1 FROM pg_database WHERE datname='$db'\"" | grep -q 1 || \
        run_as_pg "$PGBIN/psql -h 127.0.0.1 -p $PGPORT -U postgres -c \"CREATE DATABASE $db\""
    done
    run_as_pg "$PGBIN/psql -h 127.0.0.1 -p $PGPORT -U postgres -c \"ALTER USER postgres PASSWORD 'postgres'\"" >/dev/null
    echo "PostgreSQL running on 127.0.0.1:$PGPORT (databases: careerquest, careerquest_test)";;
  stop) run_as_pg "$PGBIN/pg_ctl -D $PGDATA stop";;
  status) run_as_pg "$PGBIN/pg_ctl -D $PGDATA status";;
  *) echo "unknown command $cmd"; exit 1;;
esac
