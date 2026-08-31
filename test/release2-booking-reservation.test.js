import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateBookingCreate,validateBookingTransition,validateBookingExtension} from '../src/booking-domain.js';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
test('booking creation applies a system-controlled seven-day term while commercial value comes from the accepted revision',()=>{
  const now=new Date('2099-07-25T10:00:00Z'),good=validateBookingCreate({refundableState:'conditional',evidence:{fileName:'receipt.pdf',mediaType:'application/pdf',base64:'JVBERi0='}},now);
  assert.equal(good.value.refundableState,'conditional');
  assert.equal(good.value.bookingAmount,undefined);
  assert.equal(good.value.currency,undefined);
  assert.equal(good.value.reservationStartsAt,now.toISOString());
  assert.equal(good.value.expiresAt,new Date('2099-08-01T10:00:00Z').toISOString());
  for(const bad of [{},{refundableState:'conditional'}])assert.ok(validateBookingCreate(bad,now).error);
});
test('booking transitions require active reservation reasons and actual expiry',()=>{
  assert.ok(validateBookingTransition('released',{toStatus:'cancelled',reason:'Customer requested'}).error);
  assert.ok(validateBookingTransition('reserved',{toStatus:'released'}).error);
  assert.ok(validateBookingTransition('reserved',{toStatus:'expired',expiresAt:'2099-01-01'}).error);
  assert.equal(validateBookingTransition('reserved',{toStatus:'released',reason:'Deposit refunded'}).value.toStatus,'released');
});
test('reservation expiry defaults are bounded to seven days and Manager extensions to fourteen cumulative days',()=>{
  const start='2099-07-01T10:00:00Z',seven='2099-07-08T10:00:00Z',fourteen='2099-07-15T10:00:00Z';
  const evidence={fileName:'receipt.pdf',mediaType:'application/pdf',base64:'JVBERi0='};
  const created=validateBookingCreate({refundableState:'refundable',reservationStartsAt:'2099-01-01',expiresAt:'2099-12-31',evidence},new Date(start));
  assert.equal(created.value.reservationStartsAt,new Date(start).toISOString());
  assert.equal(created.value.expiresAt,new Date(seven).toISOString());
  const booking={status:'reserved',reservationStartsAt:start,expiresAt:seven};
  assert.equal(validateBookingExtension(booking,{expiresAt:fourteen,reason:'Customer funds require documented additional processing time'},new Date('2099-07-02')).value.expiresAt,new Date(fourteen).toISOString());
  assert.ok(validateBookingExtension(booking,{expiresAt:'2099-07-15T10:00:01Z',reason:'Customer requested additional processing time'},new Date('2099-07-02')).error);
  assert.ok(validateBookingExtension(booking,{expiresAt:'2099-07-09T10:00:00Z',reason:'short'},new Date('2099-07-02')).error);
});
test('R2.3B migration and API make reservation explicit conflict-safe and auditable',()=>{
  const sql=read('src/migrations/046_release2_booking_reservation.sql'),routes=read('src/routes/opportunities.js'),ui=read('public/offer-ui.js'),
    listings=read('src/routes/listings.js'),app=read('public/app.js');
  for(const marker of ['CREATE TABLE bookings','CREATE TABLE booking_status_history','bookings_active_listing_uq','inventory_status_before','evidence_document_version_id','booking_status_history_immutable'])assert.match(sql,new RegExp(marker));
  for(const marker of ["/crm/offers/:offerId/bookings","/crm/bookings/:bookingId/status","/crm/bookings/:bookingId/extensions","FOR UPDATE OF b","nysa_inventory_effective_status","accepted_offer_revision_id","Reservation evidence document is required","Property is already reserved under","Only the maintained manager for this Opportunity","inventory_assignments"])assert.match(routes,new RegExp(marker));
  for(const marker of ['Booking and reservation','Create seven-day reservation','Reservation evidence','Release reservation','Cancel reservation','Inventory is reserved explicitly','Exact accepted offer revision','Inventory already reserved','Manager action required','Open blocking Opportunity','Reservation amount from accepted revision','acceptance is already recorded in Negotiation'])assert.match(ui,new RegExp(marker));
  for(const marker of ['nysa_inventory_effective_status','is system-controlled by Inventory assignments, Booking or Deal closure'])assert.match(listings,new RegExp(marker));
  for(const marker of ['Inventory lifecycle linkages','Open Opportunity'])assert.match(app,new RegExp(marker));
  assert.doesNotMatch(routes,/reservation-reconciliation|legacy_reservation_reconciled/);
});
