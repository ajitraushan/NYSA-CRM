# CRM Test deployment — governed provider listing mappings

Target: `https://crm-test.nysarealty.com/` only. Production deployment is not authorized.

## Correction record

- Amendment ID: R1.1-AMD-014
- Related UAT finding: R1.1-UAT-028
- Agreed requirement: ETL/provider adapters retain technical extraction, shape and
  authentication responsibility. CORE Admin governs provider business values against
  stable CORE values using approved, effective-dated versions. Unknown values are never
  guessed; they remain unmapped until an authorized correction is activated and the
  original event is replayed into exactly one Draft.
- Status: Implemented and automatically tested locally. CRM Test deployment, functional
  retest and explicit user confirmation remain pending.
- Retest condition: Complete every test below on CRM Test. Do not close the finding
  until the NYSA owner explicitly confirms the result.

## cPanel deployment

Upload `nysa-core-r1-1-provider-mappings-crm-test.zip` to `/home/nysareal/`, then use
cPanel Terminal. The commands deliberately target only the CRM Test application.

```bash
APP_ROOT="/home/nysareal/nysa-core-dashboard-dd6262a-stage"
NODE_BIN="/home/nysareal/nodevenv/nysa-core-dashboard-dd6262a-stage/24/bin/node"
PACKAGE="/home/nysareal/nysa-core-r1-1-provider-mappings-crm-test.zip"
STAGE_DIR="$(mktemp -d /home/nysareal/nysa-r1-1-provider-mappings-stage.XXXXXX)"
NODE_MODULES="$(dirname "$(dirname "$NODE_BIN")")/lib/node_modules"

test -d "$APP_ROOT" || { echo "STOP: CRM Test application root not found"; exit 1; }
test -x "$NODE_BIN" || { echo "STOP: Node executable not found"; exit 1; }
test -f "$PACKAGE" || { echo "STOP: package not found"; exit 1; }
test -d "$NODE_MODULES" || { echo "STOP: Node modules not found"; exit 1; }

unzip -q "$PACKAGE" -d "$STAGE_DIR"
ln -s "$NODE_MODULES" "$STAGE_DIR/node_modules"
"$NODE_BIN" --check "$STAGE_DIR/public/app.js"
"$NODE_BIN" --check "$STAGE_DIR/src/routes/listing-intake.js"
"$NODE_BIN" --check "$STAGE_DIR/src/routes/listing-mappings.js"
cd "$STAGE_DIR" && "$NODE_BIN" --test --test-isolation=none
```

Create a database backup in cPanel before copying. Then copy only the package contents
over CRM Test and restart the CRM Test Node application from cPanel Application Manager:

```bash
BACKUP_DIR="/home/nysareal/crm-backups"
BACKUP_FILE="$BACKUP_DIR/nysacrm-r1test-before-provider-mappings-$(date -u +%Y%m%dT%H%M%SZ).dump"
mkdir -p "$BACKUP_DIR"
pg_dump -h localhost -p 5432 -U nysareal_nysacrmapp -d nysareal_nysacrm_r1test -Fc -f "$BACKUP_FILE"
pg_restore --list "$BACKUP_FILE" | head -n 20

cp -a "$STAGE_DIR/public/." "$APP_ROOT/public/"
cp -a "$STAGE_DIR/src/." "$APP_ROOT/src/"
cp -a "$STAGE_DIR/test/." "$APP_ROOT/test/"
cp -a "$STAGE_DIR/docs/." "$APP_ROOT/docs/"
cp -a "$STAGE_DIR/package.json" "$APP_ROOT/package.json"
cp -a "$STAGE_DIR/package-lock.json" "$APP_ROOT/package-lock.json"
cp -a "$STAGE_DIR/app.cjs" "$APP_ROOT/app.cjs"

cd "$APP_ROOT"
touch tmp/restart.txt
curl -sS https://crm-test.nysarealty.com/api/health
echo
```

Startup applies `037_listing_mapping_governance.sql` once. Confirm it using the CRM Test
database account (the prompt is for that database user's password):

```bash
psql -h localhost -p 5432 -U nysareal_nysacrmapp -d nysareal_nysacrm_r1test -P pager=off \
  -c "SELECT version,applied_at FROM schema_migrations WHERE version='037_listing_mapping_governance.sql';"
```

## Functional retest

1. Sign in as a full Administrator. Open Administration → Provider listing mappings.
2. Create a Draft for `crm_test_feed` with a new mapping version. Add at least Area and
   Property type external values mapped to active CORE values.
3. Test it with a sample-event reference, approve it with decision evidence, then
   activate it. Confirm its effective time and Active status.
4. Send a correctly signed event using that exact `mappingVersion` and external values.
   Confirm one blocked Draft is created and its source provider/version are retained.
5. Resend the identical event and confirm the same listing is returned as idempotent.
6. Send a new event with an unknown business value. Confirm no listing is created and
   the event appears as Unmapped in the Listing Executive intake attention queue.
7. Clone/create a replacement Draft, add the missing mapping, test, approve and activate
   it. Confirm the prior Active version becomes Retired and remains read-only.
8. Retry the original Unmapped event. Confirm exactly one Draft is created, the attempt
   count/history remains, and another retry cannot create a duplicate.
9. Sign in as a non-Administrator and confirm mapping maintenance API/UI is unavailable.
10. Confirm audit entries exist for version creation, mappings, testing, approval,
    activation/replacement and the resulting intake/Draft.

Record the deployed package SHA-256, migration evidence, automated-test count and user
confirmation in the status/findings documents. Until then R1.1-UAT-028 remains open.
