import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {viewingReadiness} from '../src/viewing-readiness.js';

test('ENH-004–008 migration, exact storage, SQL projections, legacy preservation and rollback',{
 skip:process.env.NYSA_RUN_ENH004_008_DB==='1'?false:'Requires restricted synthetic fixture',timeout:30000
},async()=>{
 const {createFixturePool,assertDedicatedFixture}=await import('../tools/local-postgres-fixture/fixture-guard.mjs');
 const pool=createFixturePool();let client;
 const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 try{
  await assertDedicatedFixture(pool);client=await pool.connect();await client.query('BEGIN');
  const before=(await client.query("SELECT (SELECT COUNT(*) FROM bookings) AS bookings,(SELECT COUNT(*) FROM document_versions) AS documents,(SELECT COUNT(*) FROM viewings) AS viewings")).rows[0];
  const installed=(await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='viewings' AND column_name='customer_next_decision'")).rowCount;
  if(!installed)await client.query(read('src/migrations/137_uat_inventory_viewing_and_reservations.sql'));
  const listing=(await client.query('SELECT id FROM listings WHERE deleted_at IS NULL LIMIT 1')).rows[0];assert.ok(listing);
  for(const bedrooms of ['1.5','2.5','Studio','5+']){
   const saved=(await client.query('UPDATE listings SET bedrooms=$1 WHERE id=$2 RETURNING bedrooms',[bedrooms,listing.id])).rows[0];assert.equal(saved.bedrooms,bedrooms);
  }
  const requirement=(await client.query('SELECT id FROM lead_requirements LIMIT 1')).rows[0];assert.ok(requirement);
  const saved=(await client.query('UPDATE lead_requirements SET bedrooms_min=1.5,bedrooms_max=2.5 WHERE id=$1 RETURNING bedrooms_min,bedrooms_max',[requirement.id])).rows[0];assert.equal(Number(saved.bedrooms_min),1.5);assert.equal(Number(saved.bedrooms_max),2.5);
  const column=(await client.query("SELECT is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='bookings' AND column_name='evidence_document_version_id'")).rows[0];assert.equal(column.is_nullable,'YES');
  const viewing=(await client.query("SELECT id FROM viewings WHERE status='completed' LIMIT 1")).rows[0];assert.ok(viewing);
  for(const decision of ['more_viewings_required','ready_for_offer','not_proceeding','undecided']){
   const row=(await client.query('UPDATE viewings SET customer_next_decision=$1 WHERE id=$2 RETURNING id,status,feedback,customer_next_decision AS "customerNextDecision",updated_at AS "updatedAt"',[decision,viewing.id])).rows[0];
   assert.equal(row.customerNextDecision,decision);assert.equal(viewingReadiness([row]).ready,decision==='ready_for_offer');
  }
  await client.query('SAVEPOINT invalid_decision');
  await assert.rejects(client.query("UPDATE viewings SET customer_next_decision='invented' WHERE id=$1",[viewing.id]),{code:'23514'});await client.query('ROLLBACK TO SAVEPOINT invalid_decision');
  await client.query('SAVEPOINT invalid_bedrooms');await assert.rejects(client.query("UPDATE listings SET bedrooms='2.7' WHERE id=$1",[listing.id]),{code:'23514'});await client.query('ROLLBACK TO SAVEPOINT invalid_bedrooms');
  const bookingSource=read('src/routes/opportunities.js');
  // Exercise the actual booking list query, including null evidence retention, using a synthetic existing booking.
  const booking=(await client.query('SELECT id,opportunity_id,created_by FROM bookings LIMIT 1')).rows[0];assert.ok(booking);
  await client.query('UPDATE bookings SET evidence_document_version_id=NULL WHERE id=$1',[booking.id]);
  const start=bookingSource.lastIndexOf('const bookings=await many(`',bookingSource.indexOf('LEFT JOIN document_versions dv ON dv.id=b.evidence_document_version_id'))+'const bookings=await many(`'.length;
  const end=bookingSource.indexOf('`',[start]);const bookingRows=(await client.query(bookingSource.slice(start,end),[booking.opportunity_id])).rows;
  assert.ok(bookingRows.some(row=>row.id===booking.id),'Evidence-free booking remains visible');
  const listingSource=read('src/routes/listings.js'),lateralStart=listingSource.indexOf('SELECT bk.booking_reference,o.id'),lateralEnd=listingSource.indexOf(') reservation ON TRUE',lateralStart);
  await client.query(`SELECT l.id,reservation.* FROM listings l LEFT JOIN LATERAL (${listingSource.slice(lateralStart,lateralEnd)}) reservation ON TRUE LIMIT 1`);
  const compliance=read('src/routes/document-compliance.js'),cstart=compliance.indexOf('SELECT d.*,dc.id'),cend=compliance.indexOf('`',cstart);
  const deal=(await client.query('SELECT id FROM deals LIMIT 1')).rows[0];assert.ok(deal);
  const dealRows=(await client.query(compliance.slice(cstart,cend),[deal.id])).rows;assert.equal(dealRows.length,1);assert.ok(dealRows[0].property_description);assert.ok(dealRows[0].customer_name);
  const after=(await client.query("SELECT (SELECT COUNT(*) FROM bookings) AS bookings,(SELECT COUNT(*) FROM document_versions) AS documents,(SELECT COUNT(*) FROM viewings) AS viewings")).rows[0];assert.deepEqual(after,before);
  await client.query('ROLLBACK');
  const removed=(await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='viewings' AND column_name='customer_next_decision'")).rows;assert.equal(removed.length,installed,'Transaction rollback restores migration baseline');
 }finally{if(client){await client.query('ROLLBACK');client.release();}await pool.end();}
});
