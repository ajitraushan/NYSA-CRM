#!/usr/bin/env bash
set -euo pipefail

readonly APP_ROOT="/home/nysareal/nysa-core-dashboard-dd6262a-stage"
readonly EXPECTED_DATABASE="nysareal_nysa_r2_rehearsal"
readonly EXPECTED_APP_USER="nysareal_nysar2app"
readonly NODE_BIN="/home/nysareal/nodevenv/nysa-core-dashboard-dd6262a-stage/24/bin/node"
readonly EXPECTED_CURRENT_VERSION="2.0.0-dev.44"
readonly EXPECTED_VERSION="2.0.0-dev.45"
readonly EXPECTED_BASELINE="050_release2_customer_kyc_uat_corrections.sql"
readonly EXPECTED_SHA256="0eb32eb642555a70fc7b27744f812ce31c4b755b52f10ab08300591421afaf4c"
readonly PACKAGE="${1:-}"
readonly STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

[[ -n "$PACKAGE" && -f "$PACKAGE" ]] || {
  echo "Usage: bash $0 ./nysa-core-r2-5-uat-remediation-dev45-f5ec662.zip" >&2
  exit 2
}
[[ "$PWD" != "/" ]] || { echo "Refusing to run from the filesystem root" >&2; exit 1; }
[[ -d "$APP_ROOT/public" && -d "$APP_ROOT/src/migrations" ]] || { echo "CRM Test application root not found" >&2; exit 1; }
for name in PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD; do
  [[ -n "${!name:-}" ]] || { echo "Required secure CRM Test setting is missing: $name" >&2; exit 1; }
done
[[ "$PGDATABASE" == "$EXPECTED_DATABASE" ]] || { echo "Refusing database '$PGDATABASE'" >&2; exit 1; }
[[ "$PGUSER" == "$EXPECTED_APP_USER" ]] || { echo "Refusing application role '$PGUSER'" >&2; exit 1; }
[[ "$PGHOST" == "localhost" || "$PGHOST" == "127.0.0.1" ]] || { echo "Refusing PostgreSQL host '$PGHOST'" >&2; exit 1; }
[[ "$PGPORT" == "5432" ]] || { echo "Refusing PostgreSQL port '$PGPORT'" >&2; exit 1; }
[[ "$(sha256sum "$PACKAGE" | awk '{print $1}')" == "$EXPECTED_SHA256" ]] || { echo "Package SHA-256 mismatch" >&2; exit 1; }
[[ "$("$NODE_BIN" -p "require('$APP_ROOT/package.json').version")" == "$EXPECTED_CURRENT_VERSION" ]] || {
  echo "Refusing installation: CRM Test is not on accepted dev.44" >&2
  exit 1
}

app_psql() { PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -v ON_ERROR_STOP=1 "$@"; }
app_psql -Atqc "SELECT current_database(),current_user" | grep -Fx "$EXPECTED_DATABASE|$EXPECTED_APP_USER" >/dev/null
LATEST_MIGRATION="$(app_psql -Atqc "SELECT version FROM schema_migrations ORDER BY applied_at DESC,version DESC LIMIT 1")"
readonly LATEST_MIGRATION
[[ "$LATEST_MIGRATION" == "$EXPECTED_BASELINE" ]] || { echo "Unexpected CRM Test migration baseline: $LATEST_MIGRATION" >&2; exit 1; }

mkdir -p "$APP_ROOT/tmp"
readonly TMP_ROOT="$(mktemp -d "$APP_ROOT/tmp/r2-5-dev45.XXXXXX")"
readonly BACKUP_ROOT="/home/nysareal/crm-backups/r2-5-dev45-$STAMP"
cleanup() { if [[ "$TMP_ROOT" == "$APP_ROOT/tmp/r2-5-dev45."* && -d "$TMP_ROOT" ]]; then rm -rf -- "$TMP_ROOT"; fi; }
trap cleanup EXIT
unzip -q "$PACKAGE" -d "$TMP_ROOT"
cat > "$TMP_ROOT/expected-files.txt" <<'FILES'
package-lock.json
package.json
public/app.js
public/deal-ui.js
public/index.html
src/google-calendar.js
src/routes/opportunities.js
FILES
(
  cd "$TMP_ROOT"
  find . -type f ! -name expected-files.txt ! -name actual-files.txt -printf '%P\n' | LC_ALL=C sort > actual-files.txt
  diff -u expected-files.txt actual-files.txt
)
[[ "$("$NODE_BIN" -p "require('$TMP_ROOT/package.json').version")" == "$EXPECTED_VERSION" ]] || { echo "Unexpected package version" >&2; exit 1; }
"$NODE_BIN" --check "$TMP_ROOT/public/app.js"
"$NODE_BIN" --check "$TMP_ROOT/public/deal-ui.js"
"$NODE_BIN" --check "$TMP_ROOT/src/google-calendar.js"
"$NODE_BIN" --check "$TMP_ROOT/src/routes/opportunities.js"
grep -Fq 'app.js?v=r2.5-dev45' "$TMP_ROOT/public/index.html" || { echo "dev.45 browser cache identity is missing" >&2; exit 1; }
grep -Fq 'Return for correction' "$TMP_ROOT/public/deal-ui.js" || { echo "Manager return decision is missing" >&2; exit 1; }
grep -Fq 'lead_inventory_carried_forward' "$TMP_ROOT/src/routes/opportunities.js" || { echo "Lead Inventory carry-forward is missing" >&2; exit 1; }

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"
PGPASSWORD="$PGPASSWORD" pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --format=custom --file="$BACKUP_ROOT/pre-r2-5-dev45.dump"
tar --exclude='./node_modules' --exclude='./tmp' --exclude='./storage/private' -czf "$BACKUP_ROOT/pre-r2-5-dev45-app.tar.gz" -C "$APP_ROOT" .
sha256sum "$BACKUP_ROOT"/* > "$BACKUP_ROOT/SHA256SUMS"

while IFS= read -r file; do install -D -m 0644 "$TMP_ROOT/$file" "$APP_ROOT/$file"; done < "$TMP_ROOT/expected-files.txt"
touch "$APP_ROOT/tmp/restart.txt"
echo "R2.5 UAT remediation dev.45 installed on CRM Test only."
echo "Backup: $BACKUP_ROOT"
echo "Restart only CRM Test, verify dev.45 and migration baseline 050, then retest the remediated transaction cycle."
echo "Production and the frozen Release 1.1 candidate were not modified."
