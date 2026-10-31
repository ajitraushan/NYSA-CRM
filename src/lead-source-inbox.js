import {randomUUID} from 'node:crypto';
import {referenceDigest} from './lead-follow-up-domain.js';

// The caller supplies the database transaction. A conflicting replay rolls back the entire batch.
export async function persistMetaReferences(events, client) {
  const receipts=[];
  for (const event of [...events].sort((a,b)=>`${a.pageId}:${a.eventId}`.localeCompare(`${b.pageId}:${b.eventId}`))) {
    const digest=referenceDigest(event);
    const inserted=await client.query(`INSERT INTO lead_source_inbox
      (id,source_system,source_account_id,source_event_id,source_form_id,reference_digest,source_created_at)
      VALUES($1,'meta',$2,$3,$4,$5,$6)
      ON CONFLICT(source_system,source_account_id,source_event_id) DO NOTHING RETURNING id,state`,
      [randomUUID(),event.pageId,event.eventId,event.formId,digest,event.sourceCreatedAt]);
    if(inserted.rows.length) { receipts.push({receiptRef:inserted.rows[0].id,state:inserted.rows[0].state,duplicate:false}); continue; }
    const existing=await client.query(`SELECT id,state,reference_digest FROM lead_source_inbox
      WHERE source_system='meta' AND source_account_id=$1 AND source_event_id=$2`,[event.pageId,event.eventId]);
    if(!existing.rows[0] || existing.rows[0].reference_digest!==digest) throw Object.assign(new Error('ALTERED_META_EVENT'),{statusCode:409});
    receipts.push({receiptRef:existing.rows[0].id,state:existing.rows[0].state,duplicate:true});
  }
  return receipts;
}
