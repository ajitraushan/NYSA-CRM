import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {audit,execute,one,transaction,uuid} from '../db.js';
import {decodeAndValidateFile} from '../private-files.js';
import {getContactSuppression} from '../contact-suppression.js';
import {parseProspectUpload,uploadTemplate,XLSX_TYPE} from '../prospect-upload.js';

const CSV_TYPE = 'text/csv';
const ROOT = '/crm/prospect-diary/upload';
const isUuid = value => typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
const reviewKey = randomBytes(32);
const token = payload => createHmac('sha256',reviewKey).update(JSON.stringify(payload)).digest('hex');
const savedStatuses = ['ready', 'do_not_contact'];
const statuses = ['ready','error','duplicate_in_file','existing_prospect','matches_customer_or_lead','do_not_contact'];

async function uploadOwner(ownerId, actor, client) {
  return one(`SELECT b.id,b.team_id FROM brokers b
    WHERE b.id=$1 AND b.status='active' AND b.role='internal_broker' AND b.job_role='sales_agent'
      AND (($2='sales_agent' AND b.id=$3) OR $2='director' OR ($2='manager' AND EXISTS(
        SELECT 1 FROM team_memberships manager JOIN team_memberships member
          ON member.team_id=manager.team_id AND member.ends_at IS NULL
        WHERE manager.broker_id=$3 AND manager.membership_role='manager' AND manager.ends_at IS NULL
          AND member.broker_id=b.id AND member.team_id=b.team_id)))`,
  [ownerId,actor.jobRole,actor.id],client);
}

async function classify(rows, actor, client, duplicateSummary) {
  const phones = new Set(), emails = new Set();
  const outcomes = [];
  for (const row of rows) {
    const {rowNumber,phone,email,error} = row;
    const outcome = (status, reason) => ({rowNumber,status,reason});
    if (error) { outcomes.push(outcome('error', error)); continue; }
    const duplicate = phones.has(phone) || emails.has(email);
    if (phone) phones.add(phone);
    if (email) emails.add(email);
    if (duplicate) {
      outcomes.push(outcome('duplicate_in_file','This phone or email already appears in the file'));
      continue;
    }
    const matches = await duplicateSummary(phone,email,actor,client);
    if (matches.prospects.length) outcomes.push(outcome('existing_prospect','An existing Prospect matches'));
    else if (matches.customers.length || matches.leads.length) outcomes.push(outcome('matches_customer_or_lead','A Customer or Lead matches'));
    else if (matches.globalMatch) outcomes.push(outcome('error','This row cannot be uploaded'));
    else {
      const suppression = phone && await getContactSuppression(phone,client);
      outcomes.push(suppression?.blocked
        ? outcome('do_not_contact','Shared Do-not-contact restriction')
        : outcome('ready',null));
    }
  }
  return outcomes;
}

function sendDownload(res, name, contentType, content) {
  res.setHeader('Content-Type',contentType);
  res.setHeader('Content-Disposition',`attachment; filename="${name}"`);
  res.setHeader('Cache-Control','no-store');
  res.end(content);
}

export function registerProspectUpload(r, {duplicateSummary,inferredTimezone}) {
  r.use((req,res,next) => {
    if (req.path.startsWith('/api' + ROOT) &&
        (req.broker.role === 'admin' || !['sales_agent','manager','director'].includes(req.broker.jobRole))) {
      return res.status(403).json({error:'Prospect upload access is restricted'});
    }
    next();
  });

  r.get(ROOT + '/template/:format', (req,res) => {
    const {format} = req.params;
    if (!['csv','xlsx'].includes(format)) return res.status(404).json({error:'Template format not found'});
    sendDownload(res,`nysa-prospect-upload.${format}`,format === 'csv' ? CSV_TYPE : XLSX_TYPE,uploadTemplate(format));
  });

  async function upload(req,res,commit) {
    const body = req.body || {};
    const ownerId = body.ownerId || (req.broker.jobRole === 'sales_agent' ? req.broker.id : null);
    if (!isUuid(ownerId)) return res.status(400).json({error:'Select a Sales Agent'});
    const fileName = typeof body.fileName === 'string' ? body.fileName.slice(0,240) : '';
    const mediaType = /\.xlsx$/i.test(fileName) ? XLSX_TYPE : CSV_TYPE;
    const file = decodeAndValidateFile({base64:body.base64,mediaType,fileName,maxBytes:5*1024*1024,allowedTypes:[CSV_TYPE,XLSX_TYPE]});
    if (file.error) return res.status(400).json({error:file.error});
    if (!await uploadOwner(ownerId,req.broker)) return res.status(403).json({error:'That Sales Agent is outside your upload scope'});
    let rows;
    try {
      rows = await parseProspectUpload(file.buffer,mediaType);
    } catch (error) {
      const message = /^(Use the template|Upload is limited|The file contains|CSV contains|Workbook is too large)/.test(error.message)
        ? error.message : 'The upload file could not be read';
      return res.status(400).json({error:message});
    }
    if (commit && (!isUuid(body.batchId) || !/^[a-f\d]{64}$/.test(body.reviewToken || ''))) {
      return res.status(400).json({error:'Preview the file before committing'});
    }
    const batchId = commit ? body.batchId : uuid();
    const result = await transaction(async client => {
      if (commit) await execute("SET LOCAL lock_timeout='3s'",[],client);
      if (commit) await one("SELECT pg_advisory_xact_lock(hashtextextended('prospect-upload',0)) AS locked",[],client);
      const owner = await uploadOwner(ownerId,req.broker,client);
      if (!owner) return {code:403,error:'That Sales Agent is outside your upload scope'};
      const identity = {batchId,ownerId,actorId:req.broker.id,fileName:file.fileName,fileHash:file.fileHash};
      if (commit) {
        const prior = await one('SELECT * FROM prospect_upload_batches WHERE id=$1',[batchId],client);
        if (prior) return prior.createdBy === req.broker.id && prior.ownerId === ownerId &&
          prior.fileSha256 === file.fileHash && prior.fileName === file.fileName
          ? {batchId,counts:prior.statusCounts,skippedRows:prior.skippedRows}
          : {code:409,error:'Preview the current file again'};
        // Block identity changes during reclassification and insertion, including manual CRM writes.
        await execute('LOCK TABLE contacts, contact_channels, leads, prospects IN SHARE ROW EXCLUSIVE MODE',[],client);
        // Serialize with writers of the shared suppression source before reclassification.
        const phones = [...new Set(rows.flatMap(row => row.error || !row.phone ? [] : [row.phone]))].sort();
        for (const phone of phones) {
          await one('SELECT pg_advisory_xact_lock(hashtextextended($1,0)) AS locked',[`contact-suppression:${phone}`],client);
        }
      }
      const outcomes = await classify(rows,req.broker,client,duplicateSummary);
      const counts = Object.fromEntries(statuses.map(status => [status,0]));
      for (const row of outcomes) counts[row.status]++;
      const reviewToken = token({...identity,session:req.token,outcomes});
      if (!commit) return {batchId,counts,rows:outcomes,reviewToken};
      if (!timingSafeEqual(Buffer.from(reviewToken,'hex'),Buffer.from(body.reviewToken,'hex'))) {
        return {code:409,error:'The upload or its row statuses changed. Preview the current file again'};
      }
      const skippedRows = outcomes.filter(row => !savedStatuses.includes(row.status));
      await execute(`INSERT INTO prospect_upload_batches
        (id,created_by,owner_id,file_name,file_sha256,status_counts,skipped_rows) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [batchId,req.broker.id,ownerId,file.fileName,file.fileHash,counts,JSON.stringify(skippedRows)],client);
      for (const [index,outcome] of outcomes.entries()) {
        if (!savedStatuses.includes(outcome.status)) continue;
        const row = rows[index], id = uuid(), blocked = outcome.status === 'do_not_contact';
        const suppression = blocked ? await getContactSuppression(row.phone,client) : null;
        await execute(`INSERT INTO prospects
          (id,display_name,phone,normalized_phone,email,normalized_email,source,source_batch_reference,upload_batch_id,
           status,owner_id,team_id,timezone,timezone_source,suppression_snapshot,do_not_contact_reason,do_not_contact_at,created_by)
          VALUES($1,$2,$3,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,'phone_inferred',$12,$13,
                 CASE WHEN $13::text IS NOT NULL THEN NOW() END,$14)`,
        [id,row.name,row.phone,row.email,row.source,batchId,batchId,blocked?'do_not_contact':'not_contacted',
          ownerId,owner.teamId,inferredTimezone(row.phone),suppression?.restrictions || {},
          blocked?`Shared restriction: ${suppression.strongest}`:null,req.broker.id],client);
        if (row.notes) await execute(`INSERT INTO prospect_activities
          (id,prospect_id,activity_type,notes,created_by) VALUES($1,$2,'note',$3,$4)`,
        [uuid(),id,row.notes,req.broker.id],client);
      }
      await audit('Prospect',batchId,'upload_committed',req.broker.id,
        {ownerId,fileName:file.fileName,fileSha256:file.fileHash,counts},client);
      return {batchId,counts,skippedRows};
    });
    res.status(result.code || (commit ? 201 : 200)).json(result.error ? {error:result.error} : result);
  }

  r.post(ROOT + '/preview',(req,res) => upload(req,res,false));
  r.post(ROOT + '/commit',(req,res) => upload(req,res,true));
  r.get(ROOT + '/:id/result',async (req,res) => {
    if (!isUuid(req.params.id)) return res.status(404).json({error:'Upload result not found'});
    const batch = await one('SELECT * FROM prospect_upload_batches WHERE id=$1 AND created_by=$2',[req.params.id,req.broker.id]);
    if (!batch || !await uploadOwner(batch.ownerId,req.broker)) return res.status(404).json({error:'Upload result not found'});
    const quote = value => '"' + String(value ?? '').replaceAll('"','""') + '"';
    const csv = ['Row,Status,Reason',...batch.skippedRows.map(row => [row.rowNumber,row.status,row.reason].map(quote).join(','))].join('\r\n');
    sendDownload(res,'nysa-prospect-upload-result.csv',CSV_TYPE + '; charset=utf-8',csv);
  });
}
