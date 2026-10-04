#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage
readonly PRODUCTION_ROOT=/home/nysareal/nysa-crm
readonly R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone
readonly EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal
readonly EXPECTED_VERSION=2.1.0-dev.217
readonly PREVIOUS_VERSION=2.1.0-dev.216
readonly PREVIOUS_MIGRATION=129_dev214_offplan_developer_stock.sql
readonly PREVIOUS_MIGRATION_COUNT=129
readonly LATEST_MIGRATION=131_optional_booking_amount.sql
readonly EXPECTED_MIGRATION_COUNT=131
readonly REPOSITORY_URL=https://github.com/ajitraushan/NYSA-CRM.git
readonly HEALTH_URL=https://crm-test.nysarealty.com/api/health
readonly READINESS_URL=https://crm-test.nysarealty.com/api/readiness
readonly NODE_BIN=/home/nysareal/nodevenv/nysa-core-dashboard-dd6262a-stage/24/bin/node
readonly NPM_BIN=/home/nysareal/nodevenv/nysa-core-dashboard-dd6262a-stage/24/bin/npm
readonly WORKER_LABEL="lsnode:${APP_ROOT}/"
readonly WORKER_SOCKET_PREFIX=/usr/local/lsws/extapp-sock/APVH_crm-test.nysarealty.com

PACKAGE=${1:-/home/nysareal/nysa-core-2.1.0-dev.217-origin.zip}
CHECKSUM=${2:-/home/nysareal/nysa-core-2.1.0-dev.217-origin.sha256.txt}
JSON_MANIFEST=${3:-/home/nysareal/nysa-core-2.1.0-dev.217-origin.manifest.json}
MANIFEST_CHECKSUM=${4:-/home/nysareal/nysa-core-2.1.0-dev.217-origin.manifest.sha256.txt}
EXPECTED_COMMIT=${5:-}
APPROVED_SHA256=${6:-}
backup=not-created
tmp=not-created
confirmed=0

finish() {
  local code=$?
  [[ "$confirmed" -eq 1 ]] && exit 0
  echo "FAIL: CRM Test dev.217 deployment did not complete (exit $code)"
  echo "Backup: $backup"
  echo "Production and R2 clone were not targeted."
  exit "$code"
}
trap finish EXIT
fail() { echo "FAIL: $*"; return 1; }
health() { curl -fsS --max-time 15 "$HEALTH_URL"; }
readiness() { curl -fsS --max-time 15 "$READINESS_URL"; }
worker_pids() {
  pgrep -afu "$USER" '[n]ode' |
    awk -v label="$WORKER_LABEL" '$2==label{if(found)printf " ";printf "%s",$1;found=1}END{if(found)print ""}'
}
snapshot() {
  local root=$1
  [[ -f "$root/package.json" ]] && sha256sum "$root/package.json" | awk '{print $1}' || printf missing
}
verify_worker_socket() {
  local pid=$1 fd link inode line found=0
  for fd in /proc/"$pid"/fd/*; do
    link=$(readlink "$fd" 2>/dev/null || true)
    [[ "$link" =~ ^socket:\[([0-9]+)\]$ ]] || continue
    inode=${BASH_REMATCH[1]}
    line=$(awk -v inode="$inode" '$7==inode{print}' /proc/net/unix 2>/dev/null || true)
    [[ "$line" == *"$WORKER_SOCKET_PREFIX"* ]] && found=1
  done
  [[ "$found" -eq 1 ]] || fail "PID $pid does not own the CRM Test listener"
}
load_db_env() {
  local pid=$1 copy item
  copy=$(mktemp "$APP_ROOT/tmp/dev217-env.XXXXXX")
  chmod 600 "$copy"
  dd if="/proc/$pid/environ" of="$copy" status=none
  while IFS= read -r -d '' item; do
    case "$item" in
      PGHOST=*|PGPORT=*|PGDATABASE=*|PGUSER=*|PGPASSWORD=*|PGSSL=*) export "$item" ;;
    esac
  done < "$copy"
  rm -f "$copy"
}
verify_switches() {
  local pid=$1 flag
  for flag in PROPERTY_FINDER_SANDBOX_ENABLED PROPERTY_FINDER_ALLOW_READS PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS PROPERTY_FINDER_PRODUCTION_ALLOW_READS PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE PROPERTY_FINDER_PRODUCTION_ALLOW_PUBLISH MICROSOFT365_EMAIL_ENABLED CALENDLY_ENABLED; do
    if tr '\0' '\n' < "/proc/$pid/environ" | grep -Eiq "^${flag}=(1|true)$"; then
      fail "$flag must remain disabled"
    fi
  done
}
db_state() {
  PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -Atqc 'SELECT COUNT(*),MAX(version) FROM schema_migrations;'
}
verify_contract() {
  local result
  result=$(PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -Atqc "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version='$LATEST_MIGRATION'),EXISTS(SELECT 1 FROM schema_migrations WHERE version='130_line_manager_leave_approval.sql'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='booking_amount' AND is_nullable='YES'),EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='bookings'::regclass AND conname='bookings_booking_amount_non_negative_ck'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='provisional_external_properties' AND column_name='usage_kind'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='provisional_external_properties' AND column_name='developer_name'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='provisional_external_properties' AND column_name='community_or_area'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='opportunities' AND column_name='property_source'),EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='deal_inventory_linkages'::regclass AND pg_get_constraintdef(oid) LIKE '%developer_stock_attached%'),EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='customer_change_requests'),EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='deal_cancellation_requests');")
  [[ "$result" == "t|t|t|t|t|t|t|t|t|t|t" ]] || fail "DEV217 database contract failed: $result"
}

[[ "$APP_ROOT" != "$PRODUCTION_ROOT" && "$APP_ROOT" != "$R2_CLONE_ROOT" ]] || fail "protected environment path selected"
[[ "$EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "full expected Git commit is required"
[[ "$APPROVED_SHA256" =~ ^[0-9a-f]{64}$ ]] || fail "approved package SHA256 is required"
for command_name in sha256sum unzip pg_dump pg_restore psql tar curl; do
  command -v "$command_name" >/dev/null || fail "$command_name is required"
done
[[ -x "$NODE_BIN" && -x "$NPM_BIN" ]] || fail "CRM Test Node runtime is unavailable"
[[ -f "$PACKAGE" && -f "$CHECKSUM" && -f "$JSON_MANIFEST" && -f "$MANIFEST_CHECKSUM" ]] || fail "package, checksum or manifest missing"
[[ "$(basename "$PACKAGE")" == nysa-core-2.1.0-dev.217-origin.zip ]] || fail "unexpected package filename"
(cd "$(dirname "$PACKAGE")" && sha256sum -c "$(basename "$CHECKSUM")" && sha256sum -c "$(basename "$MANIFEST_CHECKSUM")")
[[ "$(sha256sum "$PACKAGE" | awk '{print $1}')" == "$APPROVED_SHA256" ]] || fail "package differs from approved candidate"
manifest_identity=$($NODE_BIN -e "const m=require(process.argv[1]);process.stdout.write([m.version,m.package,m.commit,m.repositoryUrl,m.latestMigration,m.migrationCount,m.testReceipt?.failed].join('|'))" "$JSON_MANIFEST")
[[ "$manifest_identity" == "$EXPECTED_VERSION|$(basename "$PACKAGE")|$EXPECTED_COMMIT|$REPOSITORY_URL|$LATEST_MIGRATION|$EXPECTED_MIGRATION_COUNT|0" ]] || fail "manifest identity or test receipt mismatch"

old_text=$(worker_pids || true)
old_pids=()
[[ -n "$old_text" ]] && read -r -a old_pids <<< "$old_text"
[[ "${#old_pids[@]}" -ge 1 && "${#old_pids[@]}" -le 2 ]] || fail "expected one or two CRM Test workers"
mkdir -p "$APP_ROOT/tmp"
for pid in "${old_pids[@]}"; do verify_worker_socket "$pid"; verify_switches "$pid"; done
load_db_env "${old_pids[0]}"
[[ "${PGDATABASE:-}" == "$EXPECTED_DATABASE" ]] || fail "unexpected database identity"
installed_version=$($NODE_BIN -p "require('$APP_ROOT/package.json').version")
before_migration=$(db_state)
if [[ "$installed_version" == "$PREVIOUS_VERSION" ]]; then
  [[ "$before_migration" == "$PREVIOUS_MIGRATION_COUNT|$PREVIOUS_MIGRATION" ]] || fail "DEV216 baseline migration mismatch: $before_migration"
elif [[ "$installed_version" == "$EXPECTED_VERSION" ]]; then
  [[ "$before_migration" == "$EXPECTED_MIGRATION_COUNT|$LATEST_MIGRATION" ]] || fail "DEV217 rerun migration mismatch: $before_migration"
else
  fail "requires exact DEV216 baseline or DEV217 rerun: $installed_version $before_migration"
fi
production_before=$(snapshot "$PRODUCTION_ROOT")
r2_before=$(snapshot "$R2_CLONE_ROOT")

tmp=$(mktemp -d "$APP_ROOT/tmp/consolidated-dev217.XXXXXX")
unzip -q "$PACKAGE" -d "$tmp"
[[ -f "$tmp/app.cjs" && -f "$tmp/RUNTIME_MANIFEST.sha256" && -f "$tmp/RELEASE_PROVENANCE.json" ]] || fail "package layout incomplete"
(cd "$tmp" && sha256sum -c RUNTIME_MANIFEST.sha256)
[[ "$($NODE_BIN -p "require('$tmp/package.json').version")" == "$EXPECTED_VERSION" ]] || fail "package version mismatch"
embedded_identity=$($NODE_BIN -e "const m=require(process.argv[1]);process.stdout.write([m.version,m.commit,m.repositoryUrl,m.latestMigration,m.migrationCount,m.testReceipt?.failed].join('|'))" "$tmp/RELEASE_PROVENANCE.json")
[[ "$embedded_identity" == "$EXPECTED_VERSION|$EXPECTED_COMMIT|$REPOSITORY_URL|$LATEST_MIGRATION|$EXPECTED_MIGRATION_COUNT|0" ]] || fail "embedded provenance mismatch"
[[ "$(find "$tmp/src/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l)" -eq "$EXPECTED_MIGRATION_COUNT" ]] || fail "unexpected migration inventory"
for file in "$tmp"/src/*.js "$tmp"/src/routes/*.js "$tmp"/src/lib/*.js "$tmp"/public/*.js; do
  [[ -f "$file" ]] && "$NODE_BIN" --check "$file"
done

if [[ "$installed_version" == "$EXPECTED_VERSION" ]]; then
  (cd "$APP_ROOT" && sha256sum -c RUNTIME_MANIFEST.sha256)
  verify_contract
  [[ "$(snapshot "$PRODUCTION_ROOT")" == "$production_before" && "$(snapshot "$R2_CLONE_ROOT")" == "$r2_before" ]] || fail "protected environment changed"
  confirmed=1
  echo "Deployment already confirmed"
  exit 0
fi

backup=/home/nysareal/crm-backups/consolidated-crm-test-dev217-$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$backup"
chmod 700 "$backup"
PGPASSWORD="$PGPASSWORD" pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --format=custom --no-owner --no-acl --file="$backup/pre-dev217.dump"
tar -czf "$backup/pre-dev217-app.tar.gz" -C "$APP_ROOT" app.cjs package.json package-lock.json public src
pg_restore --list "$backup/pre-dev217.dump" > "$backup/database-contents.txt"
tar -tzf "$backup/pre-dev217-app.tar.gz" > "$backup/application-contents.txt"
[[ -s "$backup/pre-dev217.dump" && -s "$backup/pre-dev217-app.tar.gz" && -s "$backup/database-contents.txt" && -s "$backup/application-contents.txt" ]] || fail "backup verification failed"
(cd "$backup" && sha256sum pre-dev217.dump pre-dev217-app.tar.gz > SHA256SUMS)
echo "Verified pre-deployment backup: $backup"

chmod -R u+rwX "$APP_ROOT/public" "$APP_ROOT/src"
install -m 0644 "$tmp/app.cjs" "$APP_ROOT/app.cjs"
install -m 0644 "$tmp/package.json" "$APP_ROOT/package.json"
install -m 0644 "$tmp/package-lock.json" "$APP_ROOT/package-lock.json"
install -m 0644 "$tmp/.env.example" "$APP_ROOT/.env.example"
install -m 0644 "$tmp/RELEASE_PROVENANCE.json" "$APP_ROOT/RELEASE_PROVENANCE.json"
install -m 0644 "$tmp/RUNTIME_MANIFEST.sha256" "$APP_ROOT/RUNTIME_MANIFEST.sha256"
cp -a "$tmp/public/." "$APP_ROOT/public/"
cp -a "$tmp/src/." "$APP_ROOT/src/"
find "$APP_ROOT/public" "$APP_ROOT/src" -type d -exec chmod 0755 {} +
find "$APP_ROOT/public" "$APP_ROOT/src" -type f -exec chmod 0644 {} +
(cd "$APP_ROOT" && "$NPM_BIN" install --omit=dev --no-audit --no-fund)
touch "$APP_ROOT/tmp/restart.txt"
for pid in "${old_pids[@]}"; do kill -KILL "$pid" 2>/dev/null || true; done
current=()
for attempt in $(seq 1 36); do
  sleep 5
  health >/dev/null 2>&1 || true
  now=$(worker_pids || true)
  current=()
  [[ -n "$now" ]] && read -r -a current <<< "$now"
  [[ "${#current[@]}" -eq 1 && " ${old_pids[*]} " != *" ${current[0]} "* ]] && break
done
[[ "${#current[@]}" -eq 1 ]] || fail "expected one new CRM Test worker"
verify_worker_socket "${current[0]}"
verify_switches "${current[0]}"
sleep 5
after_health=$(health)
after_readiness=$(readiness)
[[ "$after_health" == *'"ok":true'* && "$after_health" == *"\"version\":\"$EXPECTED_VERSION\""* ]] || fail "health/version check failed"
[[ "$after_readiness" == *'"database":"ready"'* && "$after_readiness" == *"\"version\":\"$EXPECTED_VERSION\""* ]] || fail "readiness check failed"
after_migration=$(db_state)
[[ "$after_migration" == "$EXPECTED_MIGRATION_COUNT|$LATEST_MIGRATION" ]] || fail "migration confirmation failed: $after_migration"
verify_contract
(cd "$APP_ROOT" && sha256sum -c RUNTIME_MANIFEST.sha256)
[[ "$(snapshot "$PRODUCTION_ROOT")" == "$production_before" && "$(snapshot "$R2_CLONE_ROOT")" == "$r2_before" ]] || fail "protected environment changed"
echo "Deployment confirmed"
echo "Installed/served version: $EXPECTED_VERSION"
echo "Git commit: $EXPECTED_COMMIT"
echo "Latest migration: $LATEST_MIGRATION ($EXPECTED_MIGRATION_COUNT total)"
echo "Backup: $backup"
echo "Production and R2 clone snapshots: unchanged"
confirmed=1
