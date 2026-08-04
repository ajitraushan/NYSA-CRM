#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage
NODE_BIN=/home/nysareal/nodevenv/nysa-core-dashboard-dd6262a-stage/24/bin/node
WORKER_LABEL="lsnode:${APP_ROOT}/"
HEALTH_URL=https://crm-test.nysarealty.com/api/health
PACKAGE=${1:-}
EXPECTED_HASH=689d089b357f8f9c956c329c44e592712e26becff10a9b0efbc77d8bc074836f
EXPECTED_FROM=2.1.0-dev.78
EXPECTED_TO=2.1.0-dev.79
MIGRATION=059_release26_inventory_owner_and_activation.sql

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

[[ -f "$PACKAGE" ]] || { echo "Package not found: $PACKAGE"; exit 1; }
actual_hash=$(sha256sum "$PACKAGE" | awk '{print $1}')
[[ "$actual_hash" == "$EXPECTED_HASH" ]] || {
  echo "Invalid dev.79 package hash: $actual_hash"
  exit 1
}

before_health=$(health)
before_version=$("$NODE_BIN" -p "require('$APP_ROOT/package.json').version")
old_pid_text=$(worker_pids || true)
old_pids=()
if [[ -n "$old_pid_text" ]]; then
  read -r -a old_pids <<< "$old_pid_text"
fi
[[ "${#old_pids[@]}" -ge 1 ]] || { echo "CRM Test worker not found"; exit 1; }

if [[ "$before_health" == *'"ok":true'* &&
      "$before_health" == *'"version":"2.1.0-dev.79"'* &&
      "$before_version" == "$EXPECTED_TO" &&
      "${#old_pids[@]}" -eq 1 ]]; then
  echo "Deployment already confirmed"
  echo "CRM Test PID: ${old_pids[0]}"
  echo "Installed version: $before_version"
  echo "Health: $before_health"
  echo "Migration: $MIGRATION unchanged"
  echo "Production and frozen Release 1.1 were not modified"
  exit 0
fi

[[ "$before_health" == *'"ok":true'* &&
    "$before_health" == *'"version":"2.1.0-dev.78"'* ]] || {
  echo "CRM Test preflight failed: $before_health"
  exit 1
}
[[ "$before_version" == "$EXPECTED_FROM" ]] || {
  echo "Unexpected installed package version: $before_version"
  exit 1
}
echo "Preflight passed: CRM Test PID(s) ${old_pids[*]}; health $before_health"

environment_pid=${old_pids[0]}
while IFS= read -r -d '' item; do
  case "$item" in
    PGHOST=*|PGPORT=*|PGDATABASE=*|PGUSER=*|PGPASSWORD=*) export "$item";;
  esac
done < "/proc/$environment_pid/environ"
[[ "${PGDATABASE:-}" == nysareal_nysa_r2_rehearsal &&
   "${PGUSER:-}" == nysareal_nysar2app ]] || {
  echo "Unexpected CRM Test database target"
  exit 1
}

tmp=$(mktemp -d "$APP_ROOT/tmp/r2-6-dev79.XXXXXX")
unzip -q "$PACKAGE" -d "$tmp"
package_version=$("$NODE_BIN" -p "require('$tmp/package.json').version")
[[ "$package_version" == "$EXPECTED_TO" ]] || {
  echo "Unexpected package version: $package_version"
  exit 1
}
[[ -f "$tmp/src/migrations/$MIGRATION" ]] || {
  echo "Required migration 059 missing from package"
  exit 1
}
installed_migration_hash=$(sha256sum "$APP_ROOT/src/migrations/$MIGRATION" | awk '{print $1}')
package_migration_hash=$(sha256sum "$tmp/src/migrations/$MIGRATION" | awk '{print $1}')
[[ "$installed_migration_hash" == "$package_migration_hash" ]] || {
  echo "Migration 059 differs; deployment stopped"
  exit 1
}

backup=/home/nysareal/crm-backups/r2-6-dev79-$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$backup"
chmod 700 "$backup"
PGPASSWORD="$PGPASSWORD" pg_dump \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  --format=custom --file="$backup/pre-r2-6-dev79.dump"

install -m 0644 "$tmp/package.json" "$APP_ROOT/package.json"
cp -a "$tmp/public/." "$APP_ROOT/public/"
cp -a "$tmp/src/." "$APP_ROOT/src/"
touch "$APP_ROOT/tmp/restart.txt"
echo "Installed dev.79; terminating old CRM Test worker PID(s): ${old_pids[*]}"
for pid in "${old_pids[@]}"; do
  kill -KILL "$pid" 2>/dev/null || true
done

new_pid=
after_health=
after_version=
worker_count=0
for attempt in {1..12}; do
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
        " ${old_pids[*]} " != *" $new_pid "* &&
        "$after_version" == "$EXPECTED_TO" &&
        "$after_health" == *'"ok":true'* &&
        "$after_health" == *'"version":"2.1.0-dev.79"'* ]]; then
    if ! rm -rf "$tmp" >/dev/null 2>&1; then
      echo "Temporary package directory retained: $tmp"
    fi
    echo "Deployment confirmed"
    echo "CRM Test PID: $new_pid (one worker)"
    echo "Installed version: $after_version"
    echo "Health: $after_health"
    echo "Backup: $backup"
    echo "Migration: $MIGRATION unchanged"
    echo "Production and frozen Release 1.1 were not modified"
    exit 0
  fi
done

echo "Deployment confirmation failed"
echo "Old PID(s): ${old_pids[*]}"
echo "New PID: ${new_pid:-none}"
echo "CRM Test worker count: $worker_count"
echo "Installed version: ${after_version:-unknown}"
echo "Health: ${after_health:-unavailable}"
echo "Backup: $backup"
echo "Temporary package directory retained: $tmp"
exit 1
