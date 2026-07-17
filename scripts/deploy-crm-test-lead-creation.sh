#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT='/home/nysareal/nysa-core-dashboard-dd6262a-stage'
DB_HOST='127.0.0.1'
DB_PORT='5432'
DB_NAME='nysareal_nysacrm_r1test'
DB_USER='nysareal_nysacrmapp'
NODE_BIN='/home/nysareal/nodevenv/nysa-core-dashboard-dd6262a-stage/24/bin/node'
HEALTH_URL='https://crm-test.nysarealty.com/api/health'
APP_JS_URL='https://crm-test.nysarealty.com/app.js'
BACKUP_DIR='/home/nysareal/crm-backups'

PACKAGE_PATH="${1:-}"
EXPECTED_SHA256="${2:-}"
if [[ -z "$PACKAGE_PATH" || -z "$EXPECTED_SHA256" ]]; then
  echo "Usage: bash $0 /absolute/path/package.zip expected_sha256" >&2
  exit 2
fi

for command_name in sha256sum unzip pg_dump pg_restore psql curl tar; do
  command -v "$command_name" >/dev/null || { echo "Required command not found: $command_name" >&2; exit 2; }
done
[[ -x "$NODE_BIN" ]] || { echo "CRM Test Node runtime not found: $NODE_BIN" >&2; exit 2; }
[[ -d "$APP_ROOT" ]] || { echo "CRM Test application root not found: $APP_ROOT" >&2; exit 2; }
[[ -f "$PACKAGE_PATH" ]] || { echo "Deployment package not found: $PACKAGE_PATH" >&2; exit 2; }
[[ "$(cd "$APP_ROOT" && pwd -P)" == "$APP_ROOT" ]] || { echo 'Application-root safety check failed.' >&2; exit 2; }

ACTUAL_SHA256="$(sha256sum "$PACKAGE_PATH" | awk '{print $1}')"
[[ "$ACTUAL_SHA256" == "$EXPECTED_SHA256" ]] || {
  echo "Package checksum mismatch. Expected $EXPECTED_SHA256 but received $ACTUAL_SHA256" >&2
  exit 3
}

read -r -s -p "PostgreSQL password for $DB_USER on CRM Test: " PGPASSWORD
echo
export PGPASSWORD
STAGE_DIR="$(mktemp -d '/home/nysareal/crm-deploy-stage.XXXXXX')"
cleanup(){ unset PGPASSWORD; [[ -n "${STAGE_DIR:-}" && "$STAGE_DIR" == /home/nysareal/crm-deploy-stage.* ]] && rm -rf -- "$STAGE_DIR"; }
trap cleanup EXIT

CONNECTED_DB="$(psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --dbname="$DB_NAME" --tuples-only --no-align --command='SELECT current_database();')"
[[ "$CONNECTED_DB" == "$DB_NAME" ]] || { echo "Database safety check failed: $CONNECTED_DB" >&2; exit 4; }

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DB_BACKUP="$BACKUP_DIR/nysacrm-r1test-before-lead-creation-$STAMP.dump"
APP_BACKUP="$BACKUP_DIR/nysa-crm-test-before-lead-creation-$STAMP.tar.gz"

pg_dump --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --dbname="$DB_NAME" --format=custom --file="$DB_BACKUP"
chmod 600 "$DB_BACKUP"
pg_restore --list "$DB_BACKUP" >/dev/null

tar -czf "$APP_BACKUP" --exclude='./node_modules' --exclude='./stderr.log' --exclude='./tmp' --exclude='*.zip' -C "$APP_ROOT" .
chmod 600 "$APP_BACKUP"
tar -tzf "$APP_BACKUP" >/dev/null

unzip -q "$PACKAGE_PATH" -d "$STAGE_DIR"
[[ -f "$STAGE_DIR/app.cjs" && -f "$STAGE_DIR/public/app.js" && -f "$STAGE_DIR/src/server.js" ]] || {
  echo 'Package structure is incomplete; application files were not changed.' >&2
  exit 5
}
[[ ! -e "$STAGE_DIR/.env" && ! -e "$STAGE_DIR/node_modules" ]] || {
  echo 'Package contains a forbidden environment or dependency directory.' >&2
  exit 5
}
if find "$STAGE_DIR" -type f -iname '*defect*log*.xlsx' -print -quit | grep -q .; then
  echo 'Package unexpectedly contains the private defect workbook.' >&2
  exit 5
fi

while IFS= read -r -d '' js_file; do "$NODE_BIN" --check "$js_file" >/dev/null; done < <(find "$STAGE_DIR/public" "$STAGE_DIR/src" -type f -name '*.js' -print0)

cp -a "$STAGE_DIR/." "$APP_ROOT/"
while IFS= read -r -d '' js_file; do "$NODE_BIN" --check "$js_file" >/dev/null; done < <(find "$APP_ROOT/public" "$APP_ROOT/src" -type f -name '*.js' -print0)

mkdir -p "$APP_ROOT/tmp"
touch "$APP_ROOT/tmp/restart.txt"

HEALTH_BODY=''
for attempt in 1 2 3 4 5 6; do
  if HEALTH_BODY="$(curl --fail --silent --show-error "$HEALTH_URL")" && [[ "$HEALTH_BODY" == *'"ok":true'* && "$HEALTH_BODY" == *'"database":"ready"'* ]]; then
    break
  fi
  sleep 5
done
[[ "$HEALTH_BODY" == *'"ok":true'* && "$HEALTH_BODY" == *'"database":"ready"'* ]] || {
  echo 'CRM Test did not return a healthy response. Do not deploy to production.' >&2
  echo "Database backup: $DB_BACKUP" >&2
  echo "Application backup: $APP_BACKUP" >&2
  exit 6
}

MIGRATION_COUNT="$(psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --dbname="$DB_NAME" --tuples-only --no-align --command="SELECT COUNT(*) FROM schema_migrations WHERE version IN ('017_operational_qualification_questionnaire.sql','018_team_queue_only_lead_intake.sql');")"
[[ "$MIGRATION_COUNT" == '2' ]] || {
  echo 'Required migrations are not both recorded. Use cPanel Setup Node.js App > Restart Application once, then rerun the verification.' >&2
  exit 7
}

curl --fail --silent --show-error "$APP_JS_URL?deployment=$STAMP" | grep -F 'A team lead or Director assigns the lead from the Pending Assignment Queue.' >/dev/null || {
  echo 'CRM Test is healthy but the revised lead-creation browser code is not yet being served.' >&2
  exit 8
}

echo 'CRM Test lead-creation deployment succeeded.'
echo "Package SHA-256: $ACTUAL_SHA256"
echo "Database backup: $DB_BACKUP"
echo "Application backup: $APP_BACKUP"
echo "Health: $HEALTH_BODY"
echo 'Migrations 017 and 018 are recorded. Findings remain open until user retest and explicit confirmation.'
