import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateBookingCreate,validateBookingTransition} from '../src/booking-domain.js';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
test('booking creation requires typed amount dates refundable state and evidence',()=>{
  const good=validateBookingCreate({bookingAmount:'10000',currency:'aed',refundableState:'conditional',reservationStartsAt:'2099-07-25T10:00:00Z',expiresAt:'2099-07-27T10:00:00Z',evidence:{fileName:'receipt.pdf',mediaType:'application/pdf',base64:'JVBERi0='}});
  assert.equal(good.value.currency,'AED');
  for(const bad of [{},{bookingAmount:0},{bookingAmount:1,currency:'AED',refundableState:'conditional',reservationStartsAt:'2026-07-27',expiresAt:'2026-07-25'}])assert.ok(validateBookingCreate(bad).error);
});
test('booking transitions require active reservation reasons and actual expiry',()=>{
  assert.ok(validateBookingTransition('released',{toStatus:'cancelled',reason:'Customer requested'}).error);
  assert.ok(validateBookingTransition('reserved',{toStatus:'released'}).error);
  assert.ok(validateBookingTransition('reserved',{toStatus:'expired',expiresAt:'2099-01-01'}).error);
  assert.equal(validateBookingTransition('reserved',{toStatus:'released',reason:'Deposit refunded'}).value.toStatus,'released');
});
test('R2.3B migration and API make reservation explicit conflict-safe and auditable',()=>{
  const sql=read('src/migrations/046_release2_booking_reservation.sql'),routes=read('src/routes/opportunities.js'),ui=read('public/offer-ui.js');
  for(const marker of ['CREATE TABLE bookings','CREATE TABLE booking_status_history','bookings_active_listing_uq','inventory_status_before','evidence_document_version_id','booking_status_history_immutable'])assert.match(sql,new RegExp(marker));
  for(const marker of ["/crm/offers/:offerId/bookings","/crm/bookings/:bookingId/status","FOR UPDATE OF b,li","current_inventory_status","status='Reserved'","accepted_offer_revision_id","Reservation evidence document is required","R2.3B enables explicit booking and reservation"])assert.match(routes,new RegExp(marker));
  for(const marker of ['Booking and reservation','Create explicit reservation','Reservation evidence','Release reservation','Cancel reservation','Inventory is reserved explicitly','Exact accepted offer revision'])assert.match(ui,new RegExp(marker));
});
