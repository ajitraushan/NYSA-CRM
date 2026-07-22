#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/home/nysareal/nysa-core-dashboard-dd6262a-stage}"
PACKAGE="${1:-}"
EXPECTED_SHA256="${2:-}"
NODE_BIN="${NODE_BIN:-/home/nysareal/nodevenv/nysa-core-dashboard-dd6262a-stage/24/bin/node}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP_ROOT="$(mktemp -d "$APP_ROOT/tmp/r2-2-dev17.XXXXXX")"
BACKUP_ROOT="$HOME/crm-backups/r2-2-dev17-$STAMP"
trap 'rm -rf "$TMP_ROOT"' EXIT

[[ -n "$PACKAGE" && -n "$EXPECTED_SHA256" ]] || { echo "Usage: bash $0 PACKAGE_ZIP EXPECTED_SHA256" >&2; exit 2; }
[[ -f "$PACKAGE" && -d "$APP_ROOT/public" ]] || { echo "Package or CRM Test root not found" >&2; exit 1; }
[[ "$(sha256sum "$PACKAGE" | awk '{print $1}')" == "$EXPECTED_SHA256" ]] || { echo "Package SHA-256 mismatch" >&2; exit 1; }
for name in GOOGLE_CALENDAR_CLIENT_ID GOOGLE_CALENDAR_CLIENT_SECRET GOOGLE_CALENDAR_REDIRECT_URI INTEGRATION_ENCRYPTION_KEY PGDATABASE PGUSER PGPASSWORD; do
  [[ -n "${!name:-}" ]] || { echo "Required secure environment setting is missing: $name" >&2; exit 1; }
done
[[ "$GOOGLE_CALENDAR_REDIRECT_URI" == "https://crm-test.nysarealty.com/api/integrations/google-calendar/callback" ]] || { echo "Unexpected Google redirect URI" >&2; exit 1; }

unzip -q "$PACKAGE" -d "$TMP_ROOT"
[[ "$(node -p "require('$TMP_ROOT/package.json').version")" == "2.0.0-dev.17" ]] || { echo "Unexpected package version" >&2; exit 1; }
for file in "$TMP_ROOT"/src/*.js "$TMP_ROOT"/src/routes/*.js "$TMP_ROOT"/public/*.js; do "$NODE_BIN" --check "$file"; done
[[ -f "$TMP_ROOT/src/migrations/040_release2_matching_viewing.sql" && -f "$TMP_ROOT/src/migrations/041_google_calendar_integration.sql" && -f "$TMP_ROOT/src/migrations/042_google_calendar_sync_reconciliation.sql" ]] || { echo "R2.2 migrations are incomplete" >&2; exit 1; }

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"
pg_dump --format=custom --file="$BACKUP_ROOT/pre-r2-2.dump" "$PGDATABASE"
tar --exclude='./node_modules' --exclude='./tmp' --exclude='./storage/private' -czf "$BACKUP_ROOT/pre-r2-2-app.tar.gz" -C "$APP_ROOT" .
sha256sum "$BACKUP_ROOT"/* > "$BACKUP_ROOT/SHA256SUMS"

cp -a "$TMP_ROOT/." "$APP_ROOT/"
mkdir -p "$APP_ROOT/tmp"
touch "$APP_ROOT/tmp/restart.txt"
echo "R2.2 dev.17 files installed on CRM Test. Backup: $BACKUP_ROOT"
echo "Restart the Node.js application, then verify health, migration 042, OAuth connection and the UAT checklist."
