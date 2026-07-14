import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeAndValidateFile } from '../src/private-files.js';
import { makeTextPdf } from '../src/simple-pdf.js';

test('private upload validation checks type, magic, extension, size and hash',()=>{
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('safe image bytes')]);
  const file=decodeAndValidateFile({base64:png.toString('base64'),mediaType:'image/png',fileName:'floor-plan.png',maxBytes:1024,allowedTypes:['image/png']});
  assert.equal(file.error,undefined);assert.equal(file.buffer.length,png.length);assert.match(file.fileHash,/^[a-f0-9]{64}$/);
  assert.match(decodeAndValidateFile({base64:png.toString('base64'),mediaType:'image/png',fileName:'wrong.jpg',maxBytes:1024,allowedTypes:['image/png']}).error,/extension/);
  assert.match(decodeAndValidateFile({base64:Buffer.from('%PDF-bad').toString('base64'),mediaType:'image/png',fileName:'fake.png',maxBytes:1024,allowedTypes:['image/png']}).error,/content/);
  assert.match(decodeAndValidateFile({base64:'not base64!',mediaType:'image/png',fileName:'x.png',maxBytes:1024,allowedTypes:['image/png']}).error,/base64/);
});

test('security test content is rejected before persistence',()=>{
  const eicar=Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
  assert.match(decodeAndValidateFile({base64:eicar.toString('base64'),mediaType:'text/plain',fileName:'test.txt',maxBytes:1024,allowedTypes:['text/plain']}).error,/security/);
});

test('proposal generator creates a structurally complete PDF byte stream',()=>{
  const pdf=makeTextPdf(['NYSA REALTY','CUSTOMER PROPOSAL','Prepared for: Sample Customer','Prepared by: Sample Agent','',
    'PROPERTY','Marina Residence - Dubai Marina','Apartment | 2 bedrooms | AED 1,000,000','Developer: Sample Developer','',
    'FINANCIAL SCENARIO','Monthly estimate: AED 4,447','Gross yield: 7.5% | Net yield: 6.2%','',
    'DISCLAIMER','Illustrative information only; verify all details independently.']);
  assert.equal(pdf.subarray(0,8).toString(),'%PDF-1.4');assert.match(pdf.toString('latin1'),/xref/);assert.match(pdf.toString('latin1'),/%%EOF/);
  if(process.env.PDF_FIXTURE)fs.writeFileSync(process.env.PDF_FIXTURE,pdf);
});
