#!/usr/bin/env bash
set -euo pipefail

PACKAGE=${1:-}
APP_ROOT=${2:-}
HEALTH_URL=${3:-}
EXPECTED_CLONE_DATABASE=${4:-}
EXPECTED_CLONE_USER=${5:-}
EXPECTED_HASH=689d089b357f8f9c956c329c44e592712e26becff10a9b0efbc77d8bc074836f
EXPECTED_VERSION=2.1.0-dev.79
EXPECTED_APP_BASELINE=1.1.0
EXPECTED_BASELINE=026_routing_rule_governance.sql
EXPECTED_R11_FINAL=037_listing_mapping_governance.sql
EXPECTED_FINAL=059_release26_inventory_owner_and_activation.sql
PRODUCTION_ROOT=/home/nysareal/nysa-crm
CRM_TEST_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage
PRODUCTION_HEALTH=https://crm.nysarealty.com/api/health
CRM_TEST_HEALTH=https://crm-test.nysarealty.com/api/health

usage(){
  echo "Usage:"
  echo "REHEARSAL_CONFIRM=R2_6_CLONE_ONLY bash $0 PACKAGE CLONE_APP_ROOT CLONE_HEALTH_URL CLONE_DATABASE CLONE_DB_USER"
}

[[ "${REHEARSAL_CONFIRM:-}" == R2_6_CLONE_ONLY ]] || {
  echo "Clone-only confirmation is missing."
  usage
  exit 1
}
[[ -f "$PACKAGE" && -n "$APP_ROOT" && -n "$HEALTH_URL" &&
   -n "$EXPECTED_CLONE_DATABASE" && -n "$EXPECTED_CLONE_USER" ]] || {
  usage
  exit 1
}
[[ "$APP_ROOT" == /home/nysareal/* &&
   "$APP_ROOT" != "$PRODUCTION_ROOT" &&
   "$APP_ROOT" != "$CRM_TEST_ROOT" ]] || {
  echo "Refusing protected or unexpected application root: $APP_ROOT"
  exit 1
}
[[ "$HEALTH_URL" != "$PRODUCTION_HEALTH" &&
   "$HEALTH_URL" != "$CRM_TEST_HEALTH" ]] || {
  echo "Refusing Production or CRM Test health URL: $HEALTH_URL"
  exit 1
}
case "$EXPECTED_CLONE_DATABASE" in
  *rehearsal*|*clone*|*sandbox*) ;;
  *)
    echo "Clone database name must contain rehearsal, clone or sandbox."
    exit 1
    ;;
esac

APP_ROOT=$(cd "$APP_ROOT" && pwd -P)
[[ "$APP_ROOT" != "$PRODUCTION_ROOT" && "$APP_ROOT" != "$CRM_TEST_ROOT" ]] || {
  echo "Resolved application root is protected: $APP_ROOT"
  exit 1
}
APP_NAME=$(basename "$APP_ROOT")
NODE_BIN=${NODE_BIN:-/home/nysareal/nodevenv/$APP_NAME/24/bin/node}
WORKER_LABEL="lsnode:${APP_ROOT}/"
[[ -x "$NODE_BIN" ]] || { echo "Clone Node runtime not found: $NODE_BIN"; exit 1; }

worker_pids(){
  pgrep -afu "$USER" node |
    awk -v label="$WORKER_LABEL" '
      index($0,label) {
        if (found) printf " "
        printf "%s", $1
        found=1
      }
      END { if (found) print "" }
    '
}
health(){ curl -fsS --max-time 15 "$HEALTH_URL"; }
db_psql(){
  PGPASSWORD="$PGPASSWORD" psql \
    -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
    -X -v ON_ERROR_STOP=1 "$@"
}

actual_hash=$(sha256sum "$PACKAGE" | awk '{print $1}')
[[ "$actual_hash" == "$EXPECTED_HASH" ]] || {
  echo "Candidate package hash is invalid: $actual_hash"
  exit 1
}

old_pid_text=$(worker_pids || true)
old_pids=()
if [[ -n "$old_pid_text" ]]; then
  read -r -a old_pids <<< "$old_pid_text"
fi
[[ "${#old_pids[@]}" -eq 1 ]] || {
  echo "Expected exactly one isolated clone worker; found ${#old_pids[@]}."
  exit 1
}
old_pid=${old_pids[0]}

while IFS= read -r -d '' item; do
  case "$item" in
    PGHOST=*|PGPORT=*|PGDATABASE=*|PGUSER=*|PGPASSWORD=*|PGSSL=*) export "$item";;
  esac
done < "/proc/$old_pid/environ"
[[ "${PGDATABASE:-}" == "$EXPECTED_CLONE_DATABASE" &&
   "${PGUSER:-}" == "$EXPECTED_CLONE_USER" ]] || {
  echo "Clone worker database identity does not match the explicit arguments."
  exit 1
}
db_psql -Atqc "SELECT current_database(),current_user" |
  grep -Fx "$EXPECTED_CLONE_DATABASE|$EXPECTED_CLONE_USER" >/dev/null

before_health=$(health)
[[ "$before_health" == *'"ok":true'* ]] || {
  echo "Clone health preflight failed: $before_health"
  exit 1
}
before_version=$("$NODE_BIN" -p "require('$APP_ROOT/package.json').version")
[[ "$before_version" == "$EXPECTED_APP_BASELINE" ]] || {
  echo "Clone application is not on the verified Production version: $before_version"
  exit 1
}
baseline=$(db_psql -Atqc "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1")
[[ "$baseline" == "$EXPECTED_BASELINE" ]] || {
  echo "Clone is not on the verified Production database baseline: $baseline"
  exit 1
}
release11_before=$(db_psql -Atqc "SELECT COUNT(*) FROM schema_migrations WHERE version >= '027_' AND version <= '037~'")
release2_before=$(db_psql -Atqc "SELECT COUNT(*) FROM schema_migrations WHERE version >= '038_' AND version <= '059~'")
[[ "$release11_before" == 0 && "$release2_before" == 0 ]] || {
  echo "Clone already contains post-baseline migrations: Release 1.1=$release11_before Release 2=$release2_before"
  exit 1
}
echo "Preflight passed: isolated clone PID $old_pid; application $before_version; database $PGDATABASE; baseline $baseline"

tmp=$(mktemp -d "$APP_ROOT/tmp/r2-6-prod-rehearsal.XXXXXX")
unzip -q "$PACKAGE" -d "$tmp"
package_version=$("$NODE_BIN" -p "require('$tmp/package.json').version")
[[ "$package_version" == "$EXPECTED_VERSION" ]] || {
  echo "Unexpected package version: $package_version"
  exit 1
}
migration_count=$(find "$tmp/src/migrations" -maxdepth 1 -type f \
  -name '*.sql' -printf '%f\n' |
  awk '$0 >= "027_" && $0 <= "059~" { count++ } END { print count+0 }')
[[ "$migration_count" == 33 &&
   -f "$tmp/src/migrations/$EXPECTED_R11_FINAL" &&
   -f "$tmp/src/migrations/$EXPECTED_FINAL" ]] || {
  echo "Candidate does not contain the complete 33-migration cumulative chain."
  exit 1
}

backup=/home/nysareal/crm-backups/production-db026-to-r2-6-clone-rehearsal-$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$backup"
chmod 700 "$backup"
PGPASSWORD="$PGPASSWORD" pg_dump \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  --format=custom --file="$backup/pre-r2-6-clone.dump"
tar --exclude='./node_modules' --exclude='./tmp' --exclude='./storage/private' \
  -czf "$backup/pre-r2-6-clone-app.tar.gz" -C "$APP_ROOT" .

echo "Applying migrations 027 through 059 to the isolated clone."
migration_files=$(find "$tmp/src/migrations" -maxdepth 1 -type f \
  -name '*.sql' -printf '%f\n' |
  awk '$0 >= "027_" && $0 <= "059~"' |
  sort)
while IFS= read -r migration; do
  [[ -n "$migration" ]] || continue
  already_applied=$(db_psql -Atqc \
    "SELECT COUNT(*) FROM schema_migrations WHERE version = '$migration'")
  if [[ "$already_applied" == 0 ]]; then
    echo "Applying $migration"
    db_psql --single-transaction \
      -f "$tmp/src/migrations/$migration" \
      -c "INSERT INTO schema_migrations(version) VALUES ('$migration') ON CONFLICT (version) DO NOTHING"
  fi
done <<< "$migration_files"

after_migration=$(db_psql -Atqc "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1")
release11_after=$(db_psql -Atqc "SELECT COUNT(*) FROM schema_migrations WHERE version >= '027_' AND version <= '037~'")
release2_after=$(db_psql -Atqc "SELECT COUNT(*) FROM schema_migrations WHERE version >= '038_' AND version <= '059~'")
[[ "$after_migration" == "$EXPECTED_FINAL" &&
   "$release11_after" == 11 &&
   "$release2_after" == 22 ]] || {
  echo "Migration verification failed: latest=$after_migration Release 1.1=$release11_after Release 2=$release2_after"
  echo "Clone database backup: $backup/pre-r2-6-clone.dump"
  exit 1
}

install -m 0644 "$tmp/app.cjs" "$APP_ROOT/app.cjs"
install -m 0644 "$tmp/package.json" "$APP_ROOT/package.json"
install -m 0644 "$tmp/package-lock.json" "$APP_ROOT/package-lock.json"
cp -a "$tmp/public/." "$APP_ROOT/public/"
cp -a "$tmp/src/." "$APP_ROOT/src/"
touch "$APP_ROOT/tmp/restart.txt"
echo "Installed dev.79 on the clone; terminating old clone PID $old_pid."
kill -KILL "$old_pid"

new_pid=
after_health=
after_version=
worker_count=0
for attempt in {1..24}; do
  sleep 5
  current_pid_text=$(worker_pids || true)
  current_pids=()
  if [[ -n "$current_pid_text" ]]; then
    read -r -a current_pids <<< "$current_pid_text"
  fi
  worker_count=${#current_pids[@]}
  new_pid=${current_pids[0]:-}
  after_health=$(health || true)
  after_version=$("$NODE_BIN" -p "require('$APP_ROOT/package.json').version" || true)
  if [[ "$worker_count" -eq 1 &&
        "$new_pid" != "$old_pid" &&
        "$after_version" == "$EXPECTED_VERSION" &&
        "$after_health" == *'"ok":true'* &&
        "$after_health" == *'"version":"2.1.0-dev.79"'* ]]; then
    if ! rm -rf "$tmp" >/dev/null 2>&1; then
      echo "Temporary package directory retained: $tmp"
    fi
    echo "Production-clone rehearsal deployment confirmed"
    echo "Clone PID: $new_pid (one worker)"
    echo "Installed version: $after_version"
    echo "Health: $after_health"
    echo "Migration baseline: $baseline"
    echo "Release 1.1 migration final: $EXPECTED_R11_FINAL"
    echo "Migration final: $after_migration"
    echo "Release 1.1 migrations recorded: $release11_after"
    echo "Release 2 migrations recorded: $release2_after"
    echo "Database backup: $backup/pre-r2-6-clone.dump"
    echo "Application backup: $backup/pre-r2-6-clone-app.tar.gz"
    echo "Production and CRM Test were not modified"
    echo "Complete the clone smoke tests before requesting a Production deployment script."
    exit 0
  fi
done

echo "Clone deployment confirmation failed"
echo "Old clone PID: $old_pid"
echo "New clone PID: ${new_pid:-none}"
echo "Clone worker count: $worker_count"
echo "Installed version: ${after_version:-unknown}"
echo "Health: ${after_health:-unavailable}"
echo "Database backup: $backup/pre-r2-6-clone.dump"
echo "Application backup: $backup/pre-r2-6-clone-app.tar.gz"
echo "Temporary package directory retained: $tmp"
echo "Production and CRM Test were not modified"
exit 1
