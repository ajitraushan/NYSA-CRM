import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const routes=readFileSync(new URL('../src/routes/opportunities.js',import.meta.url),'utf8');

test('DEV221 competing Booking atomically expires a stale reservation before conflict checking',()=>{
  const createStart=routes.indexOf("r.post('/crm/offers/:offerId/bookings'");
  const createEnd=routes.indexOf("r.post('/crm/bookings/:bookingId/status'");
  const creation=routes.slice(createStart,createEnd);
  assert.match(creation,/expireStaleReservationForProperty/);
  assert.ok(creation.indexOf('expireStaleReservationForProperty')<creation.indexOf('const activeBooking='));
  assert.match(creation,/b\.status='reserved' AND b\.expires_at>NOW\(\)/);
  assert.match(creation,/expiredPriorBookingId/);
  assert.match(creation,/an expired reservation will be released automatically/);
});

test('DEV221 automatic expiry retains the Deal, detaches Inventory and returns the Opportunity to Match',()=>{
  const helperStart=routes.indexOf('async function expireStaleReservationForProperty');
  const helperEnd=routes.indexOf('// One governed boundary',helperStart);
  const helper=routes.slice(helperStart,helperEnd);
  for(const marker of [
    "b.status='reserved' AND b.expires_at<=NOW()",
    "UPDATE bookings SET status='expired'",
    "UPDATE inventory_assignments SET state='expired'",
    "'reservation_released'",
    "'detached'",
    'accepted_offer_revision_id=NULL,booking_id=NULL',
    "UPDATE opportunities SET stage='Matching'",
    'listing_id=CASE WHEN listing_id=$3 THEN NULL ELSE listing_id END',
    "recovery_state='matching'",
    "next_action_code='return_to_matching'",
    "'Matching','reservation_expired'",
    "'reservation_expired'",
    "audit('BookingStatus'",
    'triggeredByCompetingReservation:true'
  ])assert.ok(helper.includes(marker),marker);
});

test('DEV221 manual expiry remains available after effective Inventory returns to Assigned',()=>{
  const statusStart=routes.indexOf("r.post('/crm/bookings/:bookingId/status'");
  const statusEnd=routes.indexOf("r.post('/crm/bookings/:bookingId/extensions'");
  const status=routes.slice(statusStart,statusEnd);
  assert.match(status,/v\.toStatus==='expired'\?!releaseAligned/);
  assert.match(status,/dealReservationReleaseAligned/);
  assert.match(status,/if\(\['released','expired'\]\.includes\(v\.toStatus\)\)/);
  assert.match(status,/stage='Matching',listing_id=CASE WHEN listing_id=\$3 THEN NULL ELSE listing_id END/);
  assert.match(status,/recovery_state='matching',next_action_code='return_to_matching'/);
  assert.match(status,/reservation_released_to_matching/);
  assert.match(status,/VALUES\(\$1,\$2,\$3,'Matching',\$4,\$5,\$6\)/);
});

test('DEV221 Manager release is one atomic property-change action while Booking cancellation remains separate',()=>{
  const statusStart=routes.indexOf("r.post('/crm/bookings/:bookingId/status'");
  const statusEnd=routes.indexOf("r.post('/crm/bookings/:bookingId/extensions'");
  const status=routes.slice(statusStart,statusEnd);
  for(const marker of [
    "['released','expired'].includes(v.toStatus)",
    "'reservation_released_to_matching'",
    "Property released; confirm and assign different eligible Inventory",
    "listing_id=CASE WHEN listing_id=$3 THEN NULL ELSE listing_id END",
    "accepted_offer_revision_id=NULL,booking_id=NULL",
    "stage='Negotiation'"
  ])assert.ok(status.includes(marker),marker);
});
