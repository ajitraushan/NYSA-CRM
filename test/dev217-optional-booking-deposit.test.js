import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('an accepted Offer without a deposit remains eligible for reservation',()=>{
  const ui=read('public/offer-ui.js');
  assert.match(ui,/filter\(offer=>offer\.acceptedRevision\)/);
  assert.match(ui,/Not specified in accepted Offer/);
  assert.match(ui,/does not prevent reservation/);
  assert.doesNotMatch(ui,/Offer deposit is missing/);
  assert.doesNotMatch(ui,/cannot be accepted and reserved/);
});

test('booking creation preserves an unspecified accepted deposit as null',()=>{
  const routes=read('src/routes/opportunities.js');
  assert.match(routes,/acceptedRevision\.depositAmount===null\?null:Number\(acceptedRevision\.depositAmount\)/);
  assert.doesNotMatch(routes,/has no positive deposit/);
});

test('booking storage permits null or a specified zero deposit but rejects negative amounts',()=>{
  const migration=read('src/migrations/131_optional_booking_amount.sql');
  assert.match(migration,/ALTER COLUMN booking_amount DROP NOT NULL/);
  assert.match(migration,/booking_amount IS NULL OR booking_amount >= 0/);
});

test('booking and Deal views do not render a missing amount as AED zero',()=>{
  const bookingUi=read('public/offer-ui.js'),dealUi=read('public/deal-ui.js');
  assert.match(bookingUi,/booking\.bookingAmount===null\?'Not specified in accepted Offer'/);
  assert.match(dealUi,/activeBooking\.bookingAmount===null\?'Not specified in accepted Offer'/);
});
