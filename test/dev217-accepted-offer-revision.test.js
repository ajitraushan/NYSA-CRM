import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('accepted Offer can be revised before Booking while its accepted revision remains immutable history',()=>{
  const ui=read('public/offer-ui.js'),route=read('src/routes/opportunities.js');
  assert.match(ui,/Revise accepted Offer before Booking/);
  assert.match(ui,/remains unchanged in history/);
  assert.match(ui,/requires the revised terms to be sent and accepted again/);
  assert.match(route,/accepted_revision_id=CASE WHEN \$3 THEN NULL ELSE accepted_revision_id END/);
  assert.match(route,/previousAcceptedRevisionId:revisingAccepted\?acceptedRevisionId:null/);
  assert.match(route,/freshAcceptanceRequired:revisingAccepted/);
});

test('accepted Offer revision is blocked after Booking or Deal lineage exists',()=>{
  const ui=read('public/offer-ui.js'),route=read('src/routes/opportunities.js');
  assert.match(ui,/offer\.status!==\'accepted\'\|\|\(!offer\.hasBookingHistory&&!offer\.hasDeal\)/);
  assert.match(route,/SELECT id FROM bookings WHERE offer_id=\$1 LIMIT 1/);
  assert.match(route,/SELECT id FROM deals WHERE offer_id=\$1 LIMIT 1/);
  assert.match(route,/already has Booking history and cannot be revised/);
  assert.match(route,/already governs a Deal and cannot be revised/);
});

test('accepted Offer revision returns the Opportunity to Offer stage and fresh send action',()=>{
  const route=read('src/routes/opportunities.js');
  assert.match(route,/stage='Offer',next_action_code='prepare_or_review_offer',next_action='Review and send the revised Offer'/);
  assert.match(route,/accepted_offer_revised/);
  assert.match(route,/fresh acceptance is required/);
});
