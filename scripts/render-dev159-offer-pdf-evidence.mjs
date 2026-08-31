import fs from 'node:fs/promises';
import path from 'node:path';
import { makeOfferPdf } from '../src/offer-pdf.js';

const output=path.resolve('output/pdf/NYSA_CORE_dev159_expected_offer_to_purchase.pdf');
await fs.mkdir(path.dirname(output),{recursive:true});
const pdf=makeOfferPdf({
  offer:{offerReference:'NYSA-OF-UAT-000159',offerType:'purchase'},
  revision:{revisionNumber:2,createdAt:'2026-08-24T12:00:00.000Z',amount:2450000,currency:'AED',depositAmount:245000,validityExpiresAt:'2026-09-01T12:00:00.000Z',financingMethod:'Cash',paymentTerms:'10% deposit on execution of the definitive agreement; balance as agreed by the transaction parties.',conditions:'Subject to final property verification, continued availability, satisfactory due diligence and execution of definitive transaction documents.'},
  opportunity:{},
  customer:{fullName:'UAT Sample Customer'},
  listing:{inventoryReference:'NYSA-INV-UAT-0159',project:'Marina Vista Residences',community:'Dubai Marina',area:'Dubai',building:'Marina Vista Tower 1',unitReference:'UAT-1204',propertyType:'Apartment',bedrooms:'2',sizeSqft:1320,handoverStatus:'ready'},
  agent:{name:'UAT Sample Agent'},
  organization:{displayName:'NYSA Realty',registeredAddress:'Dubai, United Arab Emirates'}
});
await fs.writeFile(output,pdf);
process.stdout.write(JSON.stringify({output,bytes:pdf.length})+'\n');
