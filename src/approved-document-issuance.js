import crypto from 'node:crypto';
import fs from 'node:fs';
import {approvedTemplatePath} from './approved-document-renderer.js';

export const APPROVED_TEMPLATE_VERSION='DEV218-v1';

function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object'&&!(value instanceof Date))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value instanceof Date?value.toISOString():value;
}

export function approvedDocumentEvidence(documentCode,data,pdf){
  const templatePath=approvedTemplatePath(documentCode);
  if(!templatePath)throw new Error(`Unknown approved document template: ${documentCode}`);
  const dataSnapshot=canonical(data),serialized=JSON.stringify(dataSnapshot);
  return{
    templateVersion:APPROVED_TEMPLATE_VERSION,
    templateHash:crypto.createHash('sha256').update(fs.readFileSync(templatePath)).digest('hex'),
    dataSnapshot,
    dataHash:crypto.createHash('sha256').update(serialized).digest('hex'),
    pdfHash:crypto.createHash('sha256').update(pdf).digest('hex')
  };
}

export async function recordApprovedDocumentIssuance({execute,uuid,client,documentCode,data,pdf,documentVersionId,sourceEntityType,sourceEntityId,issuedBy,idempotencyKey}){
  const evidence=approvedDocumentEvidence(documentCode,data,pdf);
  await execute(`INSERT INTO approved_document_issuances(id,document_code,template_version,template_hash,data_snapshot,data_hash,
    document_version_id,pdf_hash,source_entity_type,source_entity_id,issued_by,idempotency_key)
    VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12)`,[
    uuid(),documentCode,evidence.templateVersion,evidence.templateHash,JSON.stringify(evidence.dataSnapshot),evidence.dataHash,
    documentVersionId,evidence.pdfHash,sourceEntityType,sourceEntityId,issuedBy,idempotencyKey
  ],client);
  return evidence;
}
