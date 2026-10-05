import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV217 candidate carries the four post-DEV216 corrections',()=>{
  const pkg=JSON.parse(read('package.json')),
    leave=read('src/routes/agent-leave.js'),app=read('public/app.js'),
    offer=read('public/offer-ui.js'),opportunities=read('src/routes/opportunities.js');
  assert.equal(pkg.version,'2.1.0-dev.218');
  assert.match(leave,/activeLineManager/);
  assert.match(app,/openCrmPdfTab/);
  assert.match(offer,/Not specified in accepted Offer/);
  assert.match(offer,/Revise accepted Offer before Booking/);
  assert.match(opportunities,/freshAcceptanceRequired:revisingAccepted/);
});

test('DEV217 migrations and guarded CRM Test installer are exact and cumulative',()=>{
  const deploy=read('scripts/deploy-crm-test-dev217.sh'),leaveMigration=read('src/migrations/130_line_manager_leave_approval.sql'),
    bookingMigration=read('src/migrations/131_optional_booking_amount.sql');
  assert.match(deploy,/EXPECTED_VERSION=2\.1\.0-dev\.217/);
  assert.match(deploy,/PREVIOUS_VERSION=2\.1\.0-dev\.216/);
  assert.match(deploy,/LATEST_MIGRATION=131_optional_booking_amount\.sql/);
  assert.match(deploy,/EXPECTED_MIGRATION_COUNT=131/);
  assert.match(deploy,/nysa-core-2\.1\.0-dev\.217-origin\.zip/);
  assert.match(deploy,/RELEASE_PROVENANCE\.json/);
  assert.match(deploy,/RUNTIME_MANIFEST\.sha256/);
  assert.match(deploy,/PRODUCTION_ROOT=\/home\/nysareal\/nysa-crm/);
  assert.match(deploy,/R2_CLONE_ROOT=\/home\/nysareal\/nysa-r2-prod-clone/);
  assert.match(deploy,/Production and R2 clone snapshots: unchanged/);
  assert.match(leaveMigration,/leave_to_line_manager/);
  assert.match(bookingMigration,/booking_amount IS NULL OR booking_amount >= 0/);
});
