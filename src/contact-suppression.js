import {audit,one,uuid} from './db.js';

export const SUPPRESSION_TYPES=Object.freeze(['opt_out','do_not_contact','dncr','wrong_number']);
const PRECEDENCE=['wrong_number','dncr','do_not_contact','opt_out'];
const clean=value=>typeof value==='string'?(value.trim()||null):value??null;

export function activeRestrictions(row){
  const source=row?.restrictions&&typeof row.restrictions==='object'?row.restrictions:{};
  return Object.fromEntries(SUPPRESSION_TYPES.filter(type=>source[type]?.active===true).map(type=>[type,source[type]]));
}

export function strongestRestriction(restrictions){return PRECEDENCE.find(type=>restrictions?.[type]?.active===true)||null;}

export async function getContactSuppression(phone,client,{forUpdate=false}={}){
  const row=await one(`SELECT * FROM wa_contact_suppressions WHERE normalized_phone=$1${forUpdate?' FOR UPDATE':''}`,[phone],client);
  const restrictions=activeRestrictions(row),strongest=strongestRestriction(restrictions);
  return{row,restrictions,strongest,blocked:Boolean(strongest)};
}

export async function recordContactSuppression({phone,type,evidenceReference,actorId,auditExpiresAt=null,reason=null},client){
  if(!SUPPRESSION_TYPES.includes(type))throw new Error('Invalid suppression type');
  if(!clean(evidenceReference))throw new Error('Suppression evidence reference is required');
  await one('SELECT pg_advisory_xact_lock(hashtextextended($1,0)) AS locked',[`contact-suppression:${phone}`],client);
  const prior=await getContactSuppression(phone,client,{forUpdate:true}),now=new Date(),expiry=new Date(now);
  expiry.setUTCFullYear(expiry.getUTCFullYear()+1);
  const recordedAt=now.toISOString(),effectiveAuditExpiresAt=auditExpiresAt||expiry.toISOString();
  const restrictions={...prior.restrictions,[type]:{active:true,recordedAt,recordedBy:actorId,evidenceReference:clean(evidenceReference),auditExpiresAt:effectiveAuditExpiresAt,reason:clean(reason)}};
  const strongest=strongestRestriction(restrictions),row=await one(`INSERT INTO wa_contact_suppressions
    (normalized_phone,suppression_type,evidence_reference,recorded_by,audit_expires_at,restrictions,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(normalized_phone) DO UPDATE SET
      suppression_type=EXCLUDED.suppression_type,evidence_reference=EXCLUDED.evidence_reference,
      recorded_by=EXCLUDED.recorded_by,recorded_at=NOW(),audit_expires_at=EXCLUDED.audit_expires_at,
      restrictions=EXCLUDED.restrictions,updated_at=NOW() RETURNING *`,
    [phone,strongest,evidenceReference,actorId,effectiveAuditExpiresAt,restrictions],client);
  await audit('ContactSuppression',uuid(),'restriction_recorded',actorId,{normalizedPhone:phone,type,strongest,activeTypes:Object.keys(activeRestrictions(row))},client);
  return row;
}

export async function releaseContactSuppression({phone,type,reason,actorId,actorRole,consentEvidenceReference=null,consentRecordedAt=null},client){
  if(!SUPPRESSION_TYPES.includes(type))throw new Error('Invalid suppression type');
  if(!['manager','director'].includes(actorRole))throw new Error('Manager or Director authority is required');
  if(!clean(reason)||clean(reason).length<5)throw new Error('A meaningful release reason is required');
  await one('SELECT pg_advisory_xact_lock(hashtextextended($1,0)) AS locked',[`contact-suppression:${phone}`],client);
  const prior=await getContactSuppression(phone,client,{forUpdate:true});
  if(!prior.restrictions[type]?.active)throw new Error('This restriction is not active');
  if(type==='opt_out'){
    const consentAt=Date.parse(consentRecordedAt||''),optOutAt=Date.parse(prior.restrictions[type].recordedAt||'');
    if(!clean(consentEvidenceReference)||!Number.isFinite(consentAt)||consentAt<=optOutAt)throw new Error('Opt-out release requires new customer consent evidence recorded after the opt-out');
  }
  const restrictions={...prior.restrictions,[type]:{...prior.restrictions[type],active:false,releasedAt:new Date().toISOString(),releasedBy:actorId,releaseReason:clean(reason),consentEvidenceReference:clean(consentEvidenceReference),consentRecordedAt:consentRecordedAt||null}};
  const strongest=strongestRestriction(restrictions);
  if(!strongest){await one('DELETE FROM wa_contact_suppressions WHERE normalized_phone=$1 RETURNING normalized_phone',[phone],client);}
  else await one(`UPDATE wa_contact_suppressions SET suppression_type=$1,evidence_reference=$2,recorded_by=$3,
    recorded_at=($4::jsonb->$5->>'recordedAt')::timestamptz,audit_expires_at=($4::jsonb->$5->>'auditExpiresAt')::timestamptz,
    restrictions=$4,updated_at=NOW() WHERE normalized_phone=$6 RETURNING *`,
    [strongest,restrictions[strongest].evidenceReference,restrictions[strongest].recordedBy,restrictions,strongest,phone],client);
  await audit('ContactSuppression',uuid(),'restriction_released',actorId,{normalizedPhone:phone,type,reason:clean(reason),remainingTypes:Object.keys(activeRestrictions({restrictions})),strongest},client);
  return{released:type,strongest,restrictions:activeRestrictions({restrictions})};
}

export function blocksOutbound(suppression){return Boolean(suppression?.strongest);}
