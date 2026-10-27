#!/bin/sh
# Prism Studio database backups. The compose "backup" service runs this in a postgres:16-alpine container
# (pg_dump 16, busybox); it also runs on any machine with pg_dump 16 and a POSIX shell.
#   backup.sh loop    on start, back up if the newest backup is over a day old; then every day at BACKUP_AT
#   backup.sh once    back up now (docker compose run --rm backup once)
#   backup.sh prune   apply the retention only
#   backup.sh next    print the seconds until the next BACKUP_AT
#   backup.sh list    the backups on hand
#   backup.sh restore daily/prism-YYYY-MM-DD.sql.gz
#                     load a backup into a new database, then swap it in; the one it replaces is kept, renamed
#                     prism_before_restore_<time>. Stop the app and the worker first (it refuses while they're connected)
# Connection: the standard PG* variables (PGHOST, PGUSER, PGPASSWORD, PGDATABASE).
# Files: $BACKUP_DIR/daily/prism-YYYY-MM-DD.sql.gz (the newest KEEP_DAILY are kept) and the first backup of each
# ISO week in $BACKUP_DIR/weekly/prism-YYYY-Www.sql.gz (the newest KEEP_WEEKLY are kept; a hard link, so it costs
# no extra space while the daily one exists). Plain SQL, gzipped: restore with  gunzip -c FILE | psql  (DEPLOY.md).
set -eu
umask 077                                  # the dumps hold everything in the studio: owner-only files

DIR=${BACKUP_DIR:-/backups}
AT=${BACKUP_AT:-03:15}                     # HH:MM in the container's time zone (TZ; UTC unless set)
KEEP_DAILY=${KEEP_DAILY:-14}
KEEP_WEEKLY=${KEEP_WEEKLY:-8}
RETRIES=${BACKUP_RETRIES:-3}               # a failed backup is tried again 10 minutes later, this many times in all

log() { echo "$(date '+%F %T %Z') backup: $*"; }

num() { n=$(echo "$1" | sed 's/^0*//'); echo "${n:-0}"; }   # "08" -> 8 (sh arithmetic reads 08 as octal)

secs_until_next() {
  case "$AT" in [0-2][0-9]:[0-5][0-9]) ;; *) log "BACKUP_AT must be HH:MM, got '$AT'"; exit 2 ;; esac
  [ "$(num "${AT%:*}")" -lt 24 ] || { log "BACKUP_AT must be HH:MM, got '$AT'"; exit 2; }
  target=$(( $(num "${AT%:*}") * 3600 + $(num "${AT#*:}") * 60 ))
  now=$(( $(num "$(date +%H)") * 3600 + $(num "$(date +%M)") * 60 + $(num "$(date +%S)") ))
  wait=$(( target - now ))
  [ "$wait" -gt 60 ] || wait=$(( wait + 86400 ))   # just ran (or a sleep woke a little early): tomorrow
  echo "$wait"
}

# in folder $1, keep the newest $2 backups (their names sort by date) and delete the rest
keep_newest() {
  [ -d "$1" ] || return 0
  (cd "$1" && ls -1 | grep -E '^prism-[0-9]{4}-[0-9W]{2,3}(-[0-9]{2})?\.sql\.gz$' || true) | sort -r | awk -v k="$2" 'NR > k' |
    while IFS= read -r old; do rm -f -- "$1/$old" && log "pruned $old"; done
}

prune() {
  keep_newest "$DIR/daily" "$KEEP_DAILY"
  keep_newest "$DIR/weekly" "$KEEP_WEEKLY"
}

backup() {
  mkdir -p "$DIR/daily" "$DIR/weekly"
  day=$(date +%F) week=$(date +%G-W%V)
  out="$DIR/daily/prism-$day.sql.gz" part="$DIR/daily/.prism-$day.sql.gz.part"
  rm -f "$DIR"/daily/.prism-*.part
  # pg_dump compresses plain SQL itself (-Z), so its own exit status is the one that counts
  if ! pg_dump --no-owner --no-privileges --compress=6 --file="$part"; then
    rm -f "$part"; log "FAILED: pg_dump could not dump ${PGDATABASE:-the database} on ${PGHOST:-localhost}"; return 1
  fi
  if ! gzip -t "$part" || ! gzip -dc "$part" | tail -n 20 | grep -q "PostgreSQL database dump complete"; then
    rm -f "$part"; log "FAILED: the dump is incomplete"; return 1
  fi
  mv -f "$part" "$out"
  weekly="$DIR/weekly/prism-$week.sql.gz"
  [ -e "$weekly" ] || ln "$out" "$weekly" 2>/dev/null || cp "$out" "$weekly"
  log "saved $(basename "$out") ($(du -k "$out" | cut -f1) KB)"
  prune
}

backup_with_retries() {
  i=1
  while ! backup; do
    [ "$i" -lt "$RETRIES" ] || { log "giving up until the next scheduled time"; return 0; }
    i=$((i + 1)); log "trying again in 10 minutes ($i of $RETRIES)"; nap 600
  done
}

restore() {
  f=${1:?usage: backup.sh restore daily/prism-YYYY-MM-DD.sql.gz}
  case "$f" in /*) ;; *) f="$DIR/$f" ;; esac
  if [ ! -f "$f" ] || ! gzip -t "$f" 2>/dev/null; then log "not a readable backup: $f"; return 2; fi
  db=${PGDATABASE:?set PGDATABASE} new="${PGDATABASE}_restore" old="${PGDATABASE}_before_restore_$(date +%Y%m%d_%H%M%S)"
  q() { PGOPTIONS='-c client_min_messages=warning' psql -d postgres -v ON_ERROR_STOP=1 -Atq "$@"; }
  busy=$(q -c "select count(*) from pg_stat_activity where datname = '$db' and pid <> pg_backend_pid()")
  if [ "$busy" != 0 ]; then
    log "$busy connection(s) to $db are open: stop the app and the worker first (docker compose stop app worker)"; return 1
  fi
  log "loading $(basename "$f") into $new"
  q -c "drop database if exists \"$new\"" -c "create database \"$new\""
  if ! gzip -dc "$f" | psql -d "$new" -v ON_ERROR_STOP=1 -q >/dev/null; then
    q -c "drop database if exists \"$new\""; log "FAILED: the backup didn't load; $db is unchanged"; return 1
  fi
  q -c "alter database \"$db\" rename to \"$old\"" -c "alter database \"$new\" rename to \"$db\""
  log "restored $(basename "$f") into $db; the previous database is kept as $old"
  log "when all is well: docker compose exec db dropdb -U ${PGUSER:-prism} $old"
}

# sleep in the background so "docker compose stop" (SIGTERM) ends the wait at once
nap() { sleep "$1" & wait $! || true; }
trap 'log "stopping"; exit 0' TERM INT

case "${1:-loop}" in
  once)  backup ;;
  prune) prune ;;
  next)  secs_until_next ;;
  list)  ls -lh "$DIR/daily" "$DIR/weekly" 2>/dev/null || log "no backups in $DIR yet" ;;
  restore) restore "${2:-}" ;;
  loop)
    log "daily at $AT ($(date +%Z)), keeping $KEEP_DAILY daily and $KEEP_WEEKLY weekly in $DIR"
    if [ -z "$(find "$DIR/daily" -name 'prism-*.sql.gz' -mmin -1440 2>/dev/null)" ]; then
      log "no backup from the last 24 hours: making one now"
      until pg_isready -q; do nap 3; done
      # on a first start the web container is still creating the tables: give it up to 10 minutes
      i=0
      until [ "$(psql -Atqc "select to_regclass('public.studio_settings') is not null" 2>/dev/null)" = t ] || [ "$i" -ge 200 ]; do
        i=$((i + 1)); nap 3
      done
      backup_with_retries
    fi
    while true; do
      s=$(secs_until_next)
      log "next backup in $((s / 3600)) h $((s % 3600 / 60)) min"
      nap "$s"
      backup_with_retries
    done
    ;;
  *) echo "usage: $0 [loop|once|prune|next|list|restore FILE]" >&2; exit 2 ;;
esac
