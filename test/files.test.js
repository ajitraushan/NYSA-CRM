import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { decodeAndValidateFile,imageDimensions,validatePropertyImage } from '../src/private-files.js';
import { makeTextPdf } from '../src/simple-pdf.js';
import { makeProposalPdf } from '../src/proposal-pdf.js';

test('private upload validation checks type, magic, extension, size and hash',()=>{
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('safe image bytes')]);
  const file=decodeAndValidateFile({base64:png.toString('base64'),mediaType:'image/png',fileName:'floor-plan.png',maxBytes:1024,allowedTypes:['image/png']});
  assert.equal(file.error,undefined);assert.equal(file.buffer.length,png.length);assert.match(file.fileHash,/^[a-f0-9]{64}$/);
  const jpeg=Buffer.concat([Buffer.from([0xff,0xd8,0xff]),Buffer.from('safe jpeg bytes')]);
  assert.equal(decodeAndValidateFile({base64:jpeg.toString('base64'),mediaType:'image/jpeg',fileName:'WhatsApp Image.jpeg',maxBytes:1024,allowedTypes:['image/jpeg']}).error,undefined);
  assert.match(decodeAndValidateFile({base64:png.toString('base64'),mediaType:'image/png',fileName:'wrong.jpg',maxBytes:1024,allowedTypes:['image/png']}).error,/extension/);
  assert.match(decodeAndValidateFile({base64:Buffer.from('%PDF-bad').toString('base64'),mediaType:'image/png',fileName:'fake.png',maxBytes:1024,allowedTypes:['image/png']}).error,/content/);
  assert.match(decodeAndValidateFile({base64:'not base64!',mediaType:'image/png',fileName:'x.png',maxBytes:1024,allowedTypes:['image/png']}).error,/base64/);
});

test('security test content is rejected before persistence',()=>{
  const eicar=Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
  assert.match(decodeAndValidateFile({base64:eicar.toString('base64'),mediaType:'text/plain',fileName:'test.txt',maxBytes:1024,allowedTypes:['text/plain']}).error,/security/);
});

test('property image policy balances proposal quality and delivery weight',()=>{
  const png=(width,height)=>{const data=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(data);data.writeUInt32BE(width,16);data.writeUInt32BE(height,20);return data;};
  const jpeg=(width,height)=>{const data=Buffer.from([0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,0,0,0,0,0x03,1,0x11,0,2,0x11,0,3,0x11,0]);data.writeUInt16BE(height,7);data.writeUInt16BE(width,9);return data;};
  assert.deepEqual(imageDimensions(png(1600,900),'image/png'),{width:1600,height:900});
  assert.deepEqual(imageDimensions(jpeg(1920,1080),'image/jpeg'),{width:1920,height:1080});
  assert.deepEqual(validatePropertyImage(jpeg(1920,1080),'image/jpeg'),{width:1920,height:1080});
  assert.deepEqual(validatePropertyImage(png(1600,900),'image/png'),{width:1600,height:900});
  assert.match(validatePropertyImage(png(640,480),'image/png').error,/too small/);
  assert.match(validatePropertyImage(png(2400,800),'image/png').error,/aspect ratio/);
  assert.match(validatePropertyImage(png(6001,4000),'image/png').error,/too large/);
});

test('proposal generator creates a structurally complete PDF byte stream',()=>{
  const pdf=makeTextPdf(['NYSA REALTY','CUSTOMER PROPOSAL','Prepared for: Sample Customer','Prepared by: Sample Agent','',
    'PROPERTY','Marina Residence - Dubai Marina','Apartment | 2 bedrooms | AED 1,000,000','Developer: Sample Developer','',
    'FINANCIAL SCENARIO','Monthly estimate: AED 4,447','Gross yield: 7.5% | Net yield: 6.2%','',
    'DISCLAIMER','Illustrative information only; verify all details independently.'],{footer:'NYSA Realty | Approved proposal footer'});
  assert.equal(pdf.subarray(0,8).toString(),'%PDF-1.4');assert.match(pdf.toString('latin1'),/xref/);assert.match(pdf.toString('latin1'),/%%EOF/);
  assert.match(pdf.toString('latin1'),/Approved proposal footer/);
  if(process.env.PDF_FIXTURE)fs.writeFileSync(process.env.PDF_FIXTURE,pdf);
});

test('booklet proposal generator renders governed customer, property and timeline pages',()=>{
  const png=(width,height,rgb)=>{const signature=Buffer.from([137,80,78,71,13,10,26,10]),chunk=(name,data)=>{const header=Buffer.alloc(8);header.writeUInt32BE(data.length);header.write(name,4);return Buffer.concat([header,data,Buffer.alloc(4)]);},ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;const rows=[];for(let y=0;y<height;y++)rows.push(Buffer.concat([Buffer.from([0]),Buffer.from(Buffer.from(rgb).subarray(0,3).toString('binary').repeat(width),'binary')]));return Buffer.concat([signature,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);};
  const image=png(40,24,[177,139,61]),pdf=makeProposalPdf({proposal:{title:'Aisha Dubai shortlist'},version:1,organization:{displayName:'NYSA Realty',defaultCurrency:'AED',proposalFooter:'NYSA Realty | Private customer proposal'},recipient:{fullName:'Aisha Rahman',postalAddress:'Palm Jumeirah, Dubai, UAE',phone:'+971 50 123 4567',idDocumentType:'emirates_id',idDocumentLast4:'4821'},requirement:{businessLine:'Sale',purpose:'own_use',areas:['Dubai Marina'],propertyTypes:['Apartment'],bedroomsMin:2,budgetMin:2000000,budgetMax:2500000,fundingMethod:'mortgage',timelineCode:'6-12 months'},properties:[{id:'listing-1',project:'Marina View Residence',inventoryReference:'NYSA-INV-000241',area:'Dubai Marina',propertyType:'Apartment',bedrooms:'2',sizeSqft:1245,developer:'Sample Developer',price:2350000,currency:'AED',handoverDate:'Ready',availabilityConfirmedAt:'2026-07-18'}],media:[{id:'media-1',listingId:'listing-1',mediaType:'image/png',buffer:image,caption:'Marina view'}],narrative:{highlights:'Marina view, established community and practical layout.',suitability:'Preferred location, layout and budget.',assumptions:'Availability and bank valuation remain subject to confirmation.',indicativeTimeline:{stages:[{label:'Confirm requirements and shortlist',guidance:'Typically 1-2 business days.'},{label:'Viewing and selection',guidance:'Subject to access and buyer availability.'},{label:'Transfer and handover',guidance:'Scheduled after approvals are complete.'}]}},disclaimer:'Sample information only. Availability, pricing and transaction timing must be reconfirmed.',logo:{buffer:image,mediaType:'image/png'},agent:{name:'Sunita Sinha'},preparedAt:'18 Jul 2026'});
  assert.equal(pdf.subarray(0,8).toString(),'%PDF-1.4');assert.match(pdf.toString('latin1'),/\/Count 3/);assert.match(pdf.toString('latin1'),/YOUR DUBAI PROPERTY SHORTLIST/);assert.match(pdf.toString('latin1'),/NYSA-INV-000241/);assert.match(pdf.toString('latin1'),/INDICATIVE PURCHASE JOURNEY/);assert.ok(pdf.length>5000);
  if(process.env.PROPOSAL_PDF_FIXTURE)fs.writeFileSync(process.env.PROPOSAL_PDF_FIXTURE,pdf);
});
