import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {inspectWhatsAppRecipientFile,parseWhatsAppRecipientFile,validateRecipientBatchMetadata} from '../src/whatsapp-recipient-import.js';

test('recipient CSV contract parses maintained consent and optional requirements',async()=>{
  const buffer=Buffer.from('\uFEFFname,phone,email,tags,source_detail,consent_status,consent_evidence_ref,business_type,area,budget_max\nAmal,+971500000001,amal@example.test,investor|vip,event,verified,form-1,Sale,Dubai Marina|JBR,3500000\n');
  const rows=await parseWhatsAppRecipientFile({buffer,mediaType:'text/csv'});
  assert.equal(rows[0].name,'Amal');assert.equal(rows[0].consentStatus,'verified');assert.deepEqual(rows[0].requirements.areas,['Dubai Marina','JBR']);
});

test('recipient files support explicit arbitrary mapping and reject one file column mapped twice',async()=>{
  const buffer=Buffer.from('Person,Mobile,Need\nAmal,+971500000001,2.5\n');
  const inspected=await inspectWhatsAppRecipientFile({buffer,mediaType:'text/csv'});
  assert.equal(inspected.rowCount,1);assert.equal(inspected.headers[0].label,'Person');
  const rows=await parseWhatsAppRecipientFile({buffer,mediaType:'text/csv',columnMapping:{name:0,phone:1,bedrooms:2}});
  assert.equal(rows[0].name,'Amal');assert.equal(rows[0].requirements.bedrooms,2.5);
  await assert.rejects(()=>parseWhatsAppRecipientFile({buffer,mediaType:'text/csv',columnMapping:{name:0,phone:0}}),/only once/);
});

test('recipient metadata keeps purchased provenance separate from consent',()=>{
  const invalid=validateRecipientBatchMetadata({sourceType:'purchased_list'});assert.equal(invalid.valid,false);
  const valid=validateRecipientBatchMetadata({sourceType:'purchased_list',supplierName:'Approved supplier',supplierBatchReference:'B-001',acquisitionDate:'2026-11-01',sourceEvidenceRef:'contract-1'});assert.equal(valid.valid,true);
  assert.equal(validateRecipientBatchMetadata({sourceType:'event'}).valid,true);
});

test('approved XLSX template exposes the explicit Recipients sheet contract',async()=>{
  const buffer=await fs.readFile(new URL('../public/templates/whatsapp-recipient-import-template.xlsx',import.meta.url));
  const rows=await parseWhatsAppRecipientFile({buffer,mediaType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  assert.equal(rows.length,1);assert.equal(rows[0].consentStatus,'evidence_pending');
});
