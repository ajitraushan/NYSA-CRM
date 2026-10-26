import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {offerApprovedDocumentData} from '../src/offer-pdf.js';
import {buildApprovedDocumentHtml} from '../src/approved-document-renderer.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV221 first Offer revision projects every approved Inventory identity field',()=>{
  const routes=read('src/routes/opportunities.js');
  for(const projection of [
    'COALESCE(li.inventory_reference,ep.external_reference) AS inventory_reference',
    'li.unit_reference,li.bedrooms,li.size_sqft',
    'li.community,li.building'
  ])assert.ok(routes.includes(projection),projection);

  const creation=routes.slice(routes.indexOf("r.post('/crm/opportunities/:id/offers'"),routes.indexOf("r.post('/crm/offers/:offerId/revisions'"));
  assert.match(creation,/listing:\{\.\.\.match,id:match\.listingId\}/);
});

test('DEV221 Offer Letter renders Inventory reference, unit, bedrooms and size',()=>{
  const data=offerApprovedDocumentData({
    offer:{offerType:'purchase',offerReference:'NYSA-OF-202610-000001'},
    revision:{revisionNumber:1,createdAt:'2026-10-06T12:00:00Z',validityExpiresAt:'2026-10-13T12:00:00Z',amount:2800000,depositAmount:280000,financingMethod:'cash'},
    opportunity:{sellerCounterpartyName:'Synthetic Seller'},
    customer:{fullName:'Synthetic Buyer'},
    listing:{project:'uat173round2',community:'TRIA',area:'DSO',propertyType:'Apartment',inventoryReference:'NYSA-INV-000071',unitReference:'9878',bedrooms:2,sizeSqft:1700},
    agent:{name:'Synthetic Agent',brn:'BRN-001'},
    organization:{displayName:'NYSA Realty'}
  });
  const values=Object.fromEntries(data.lineValues.map(item=>[item.label,item.value]));
  assert.deepEqual({
    listingReference:values['Listing Ref.'],unitNumber:values['Unit No.'],bedrooms:values.Bedrooms,sizeSqft:values['Size (sq ft)']
  },{listingReference:'NYSA-INV-000071',unitNumber:'9878',bedrooms:2,sizeSqft:1700});

  const html=buildApprovedDocumentHtml('offer_letter',data);
  for(const value of ['NYSA-INV-000071','9878','1700'])assert.ok(html.includes(value),value);
});
