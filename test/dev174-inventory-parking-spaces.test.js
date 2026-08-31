import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeProposalPdf } from '../src/proposal-pdf.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Inventory captures Parking spaces beside Bedrooms and displays the saved fact',()=>{
  const app=read('public/app.js');
  assert.match(app,/name="bedrooms"[\s\S]{0,300}<label>Parking spaces<\/label><input name="parkingSpaces" type="number" min="0" step="1"/);
  assert.match(app,/<b>Parking spaces<\/b>\$\{l\.parkingSpaces===null\|\|l\.parkingSpaces===undefined\?'Not recorded'/);
  assert.match(app,/\['parkingSpaces','sizeSqft','downPaymentPercent'/);
});

test('Inventory API persists only a non-negative whole-number parking count',()=>{
  const route=read('src/routes/listings.js');
  assert.match(route,/parkingSpaces:'parking_spaces'/);
  assert.match(route,/parkingSpaces must be a non-negative whole number/);
  assert.match(route,/bedrooms,parking_spaces,size_sqft/);
  assert.match(route,/b\.bedrooms\|\|null,b\.parkingSpaces,b\.sizeSqft/);
  assert.match(route,/targetPropertyType==='Bulk deal'\)\{req\.body\.bedrooms=null;req\.body\.parkingSpaces=null/);
});

test('migration adds a nullable constrained Inventory parking column without invented backfill',()=>{
  const migration=read('src/migrations/109_dev174_inventory_parking_spaces.sql');
  assert.match(migration,/ADD COLUMN parking_spaces INTEGER/);
  assert.match(migration,/CHECK \(parking_spaces IS NULL OR parking_spaces >= 0\)/);
  assert.doesNotMatch(migration,/UPDATE listings/i);
});

test('proposal reads the authoritative Inventory parking value including zero',()=>{
  const source=read('src/proposal-pdf.js');
  assert.match(source,/p\.parkingSpaces===null\|\|p\.parkingSpaces===undefined\?'Not recorded':String\(p\.parkingSpaces\)/);
  const pdf=makeProposalPdf({proposal:{title:'Parking proposal',proposalNumber:'NYSA-PR-PARK'},version:1,organization:{displayName:'NYSA Realty',defaultCurrency:'AED'},recipient:{fullName:'Customer'},requirement:{businessLine:'Sale',areas:['Dubai Marina'],propertyTypes:['Apartment']},properties:[{id:'listing-1',project:'Parking Home',inventoryReference:'NYSA-INV-PARK',area:'Dubai Marina',propertyType:'Apartment',bedrooms:'2',parkingSpaces:0,sizeSqft:1200,developer:'Developer',price:2500000,currency:'AED',availabilityConfirmedAt:'2026-08-30'}],narrative:{indicativeTimeline:{stages:[]}},disclaimer:'Indicative information only.',agent:{name:'Agent'},preparedAt:'30 Aug 2026'});
  assert.match(pdf.toString('latin1'),/PARKING/);
});
