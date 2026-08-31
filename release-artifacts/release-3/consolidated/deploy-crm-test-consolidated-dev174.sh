#!/usr/bin/env bash
set -Eeuo pipefail
# Target-locked CRM Test-only cumulative dev.174 installer wrapper.
readonly HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
readonly BASE="$HERE/deploy-crm-test-consolidated-dev162.sh"
readonly BASELINE_MIGRATION=107_dev169_versioned_opportunity_stage_drafts.sql
readonly LATEST_MIGRATION=110_dev174_financial_illustration.sql
[[ -f "$BASE" ]] || { echo "FAIL: guarded dev.162 baseline installer is missing"; exit 1; }
generated=$(mktemp "${TMPDIR:-/tmp}/deploy-crm-test-consolidated-dev174.XXXXXX.sh");cleanup(){ rm -f "$generated"; };trap cleanup EXIT
sed \
  -e 's/2\.1\.0-dev\.162/2.1.0-dev.174/g' \
  -e 's/2\.1\.0-dev\.161/2.1.0-dev.173/g' \
  -e 's/consolidated-dev162/consolidated-dev174/g' \
  -e 's/pre-dev162/pre-dev174/g' \
  -e 's/nysa-core-consolidated-crm-test-dev162/nysa-core-consolidated-crm-test-dev174/g' \
  -e 's/^readonly BASELINE_MIGRATION=.*/readonly BASELINE_MIGRATION=107_dev169_versioned_opportunity_stage_drafts.sql/' \
  -e 's/^readonly LATEST_MIGRATION=.*/readonly LATEST_MIGRATION=110_dev174_financial_illustration.sql/' \
  -e 's/^\[\[ "$before_migration" == "104|$LATEST_MIGRATION" \]\].*/[[ "$before_migration" == "107|$BASELINE_MIGRATION" || ( "$installed_version" == "$EXPECTED_VERSION" \&\& ( "$before_migration" == "109|109_dev174_inventory_parking_spaces.sql" || "$before_migration" == "110|$LATEST_MIGRATION" ) ) ]]||fail "candidate requires exact dev.173 migration-107 baseline, interrupted dev.174 migration-109 recovery, or exact dev.174 rerun: $before_migration"/' \
  -e 's/"$before_migration" == "104|$LATEST_MIGRATION"/"$before_migration" == "110|$LATEST_MIGRATION"/g' \
  -e 's/"$after_migration" == "104|$LATEST_MIGRATION"/"$after_migration" == "110|$LATEST_MIGRATION"/g' \
  -e 's/for number in 101 102 103 104;/for number in 101 102 103 104 105 106 107 108 109 110;/g' \
  -e "s/name '104_\*\.sql'/name '110_*.sql'/g" \
  -e 's/migration 104 missing or unexpected/migration 110 missing or unexpected/g' \
  -e 's/(104 total)/(110 total)/g' \
  -e 's/dev\.161 migration baseline/dev.173 migration-107 baseline/g' \
  -e 's/dev\.161 or dev\.162 files/dev.173 or dev.174 files/g' \
  -e 's/dev\.162/dev.174/g' \
  -e 's/dev\.161/dev.173/g' \
  "$BASE" > "$generated"
grep -Fq 'readonly EXPECTED_VERSION=2.1.0-dev.174' "$generated";grep -Fq 'readonly PREVIOUS_VERSION=2.1.0-dev.173' "$generated";grep -Fq 'readonly BASELINE_MIGRATION=107_dev169_versioned_opportunity_stage_drafts.sql' "$generated";grep -Fq 'readonly LATEST_MIGRATION=110_dev174_financial_illustration.sql' "$generated";grep -Fq 'readonly EXPECTED_PACKAGE=nysa-core-consolidated-crm-test-dev174.zip' "$generated";grep -Fq '107|$BASELINE_MIGRATION' "$generated";grep -Fq '109|109_dev174_inventory_parking_spaces.sql' "$generated";grep -Fq '110|$LATEST_MIGRATION' "$generated";grep -Fq 'for number in 101 102 103 104 105 106 107 108 109 110;' "$generated";grep -Fq "name '110_*.sql'" "$generated";! grep -Fq '2.1.0-dev.161' "$generated";! grep -Fq 'nysa-core-consolidated-crm-test-dev162.zip' "$generated"
trap - EXIT;exec bash "$generated" "$@"
