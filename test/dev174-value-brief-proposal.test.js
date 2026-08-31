import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeProposalPdf } from '../src/proposal-pdf.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('proposal builder exposes and submits exact Lead Value Brief selections',()=>{
  const app=read('public/app.js');
  assert.match(app,/Value Brief evidence/);
  assert.match(app,/latest saved Value Brief for each shortlisted Inventory is included automatically/i);
  assert.match(app,/valueBriefIds=\[\.\.\.form\.elements\.valueBriefIds\.selectedOptions\]/);
  assert.match(app,/financialScenarioId:[\s\S]{0,160}valueBriefIds/);
});

test('proposal API governs Value Brief ownership, shortlisted Inventory and immutable snapshot',()=>{
  const route=read('src/routes/files-proposals.js');
  assert.match(route,/FROM value_briefs v JOIN listings l ON l\.id=v\.listing_id WHERE v\.lead_id=\$1/);
  assert.match(route,/v\.id=ANY\(\$1::uuid\[\]\) AND v\.lead_id=\$2/);
  assert.match(route,/Every selected Value Brief must belong to shortlisted Inventory/);
  assert.match(route,/Select no more than one Value Brief for each shortlisted Inventory/);
  assert.match(route,/financialScenario:scenario,valueBriefs,narrative/);
  assert.match(route,/media:mediaFiles,valueBriefs,narrative/);
});

test('proposal PDF renders the selected Value Brief financial evidence and recommendation',()=>{
  const property={id:'listing-1',project:'Marina Home',inventoryReference:'NYSA-INV-1',area:'Dubai Marina',propertyType:'Apartment',bedrooms:'2',sizeSqft:1200,developer:'Developer',price:2500000,currency:'AED',handoverDate:'Ready',availabilityConfirmedAt:'2026-08-30'};
  const pdf=makeProposalPdf({proposal:{title:'Value Brief proposal',proposalNumber:'NYSA-PR-1'},version:1,organization:{displayName:'NYSA Realty',defaultCurrency:'AED'},recipient:{fullName:'Customer'},requirement:{businessLine:'Sale',areas:['Dubai Marina'],propertyTypes:['Apartment']},properties:[property],valueBriefs:[{listingId:property.id,expectedAnnualRent:120000,estimatedAnnualCosts:12000,roiPercent:4.32,currency:'AED',strengths:'Established community and practical layout',recommendation:'Within budget and meets the recorded checklist'}],narrative:{indicativeTimeline:{stages:[]}},disclaimer:'Indicative information only.',agent:{name:'Agent'},preparedAt:'30 Aug 2026'});
  const text=pdf.toString('latin1');
  assert.match(text,/VALUE BRIEF FINANCIALS/);
  assert.match(text,/Expected annual rent/);
  assert.match(text,/Estimated net ROI/);
  assert.match(text,/DEAL STRENGTHS/);
  assert.match(text,/VALUE BRIEF RECOMMENDATION/);
  assert.match(text,/Within budget and meets the recorded checklist/);
});
