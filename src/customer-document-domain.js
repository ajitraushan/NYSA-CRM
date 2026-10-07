const clean=value=>String(value??'').trim();

export const CUSTOMER_IDENTITY_TYPES=Object.freeze(['passport','emirates_id','power_of_attorney']);
export const CORPORATE_IDENTITY_TYPES=Object.freeze(['trade_license','certificate_of_incorporation','memorandum_of_association','power_of_attorney']);
export const CUSTOMER_DOCUMENT_TYPES=Object.freeze([...new Set([...CUSTOMER_IDENTITY_TYPES,...CORPORATE_IDENTITY_TYPES])]);
export const CUSTOMER_IDENTITY_STATES=Object.freeze(['pending_review','verified','expired','rejected']);

export function normalizeCustomerReminderOffsets(value=[0,7,14,30]){
  const input=Array.isArray(value)?value:String(value??'').split(',');
  const result=[...new Set(input.map(Number).filter(Number.isInteger))].sort((a,b)=>a-b);
  return result.length&&result.every(day=>day>=0&&day<=365)?result:null;
}

export function validateCustomerDocumentRequirement(input={}){
  const accepted=[...new Set((Array.isArray(input.acceptedDocumentTypes)?input.acceptedDocumentTypes:[]).map(clean))],
    reminders=normalizeCustomerReminderOffsets(input.reminderOffsetsDays),minimum=Number(input.minimumValidDocuments),
    effectiveFrom=clean(input.effectiveFrom),groups=Array.isArray(input.requiredDocumentGroups)?input.requiredDocumentGroups:[],value={requirementCode:clean(input.requirementCode),label:clean(input.label),
      businessReason:clean(input.businessReason),customerKind:clean(input.customerKind)||'individual',acceptedDocumentTypes:accepted,
      requiredDocumentGroups:groups,
      minimumValidDocuments:minimum,reviewRequired:input.reviewRequired!==false&&input.reviewRequired!=='false',
      expiryRequired:input.expiryRequired!==false&&input.expiryRequired!=='false',reminderOffsetsDays:reminders,
      effectiveFrom:effectiveFrom&&Number.isFinite(Date.parse(effectiveFrom))?new Date(effectiveFrom).toISOString():null},errors=[];
  if(!/^[a-z][a-z0-9_]*$/.test(value.requirementCode))errors.push('Requirement code must be lowercase snake_case');
  if(value.label.length<3)errors.push('Document requirement name is required');
  if(value.businessReason.length<10)errors.push('A meaningful business reason is required');
  if(!['individual','organization'].includes(value.customerKind))errors.push('Select Individual or Organization');
  if(!accepted.length||accepted.some(type=>!CUSTOMER_DOCUMENT_TYPES.includes(type)))errors.push('Select supported Customer document types');
  if(!groups.length||groups.some(group=>!Array.isArray(group)||!group.length||group.some(type=>!accepted.includes(type))))errors.push('Each required document group must contain accepted Customer document types');
  if(!Number.isInteger(minimum)||minimum<1||minimum>accepted.length)errors.push('Minimum valid documents must be one or the number of accepted documents');
  if(!reminders)errors.push('Reminder days must be unique values from 0 to 365');
  if(!value.effectiveFrom)errors.push('A valid effective date is required');
  return{valid:errors.length===0,errors,value};
}

export function effectiveIdentityState(document,now=Date.now()){
  if(!document)return'unverified';
  if(document.status==='verified'&&document.expiryDate&&Date.parse(document.expiryDate)<now)return'expired';
  return CUSTOMER_IDENTITY_STATES.includes(document.status)?document.status:'unverified';
}

export function deriveCustomerKycStatus(documents=[],requirement={minimumValidDocuments:1},now=Date.now()){
  const states=documents.map(document=>effectiveIdentityState(document,now)),groups=Array.isArray(requirement.requiredDocumentGroups)?requirement.requiredDocumentGroups:[],verifiedTypes=new Set(documents.filter(document=>effectiveIdentityState(document,now)==='verified').map(document=>document.documentType)),minimum=Number(requirement.minimumValidDocuments||1),groupsSatisfied=groups.length?groups.every(group=>group.some(type=>verifiedTypes.has(type))):verifiedTypes.size>=minimum;
  if(groupsSatisfied)return'verified';
  if(states.includes('pending_review'))return'pending_review';
  if(states.includes('expired'))return'expired';
  if(states.includes('rejected'))return'rejected';
  return'unverified';
}

export function validateIdentitySubmission(input={},now=Date.now()){
  const type=clean(input.documentType),last4=clean(input.maskedFinalFour).toUpperCase(),expiryDate=clean(input.expiryDate),errors=[];
  if(!CUSTOMER_IDENTITY_TYPES.includes(type))errors.push('Select Passport, Emirates ID or Power of Attorney');
  if(type!=='power_of_attorney'&&!/^[A-Z0-9]{4}$/.test(last4))errors.push('Record exactly the final four letters or digits');
  if(type!=='power_of_attorney'&&(!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)||!Number.isFinite(Date.parse(`${expiryDate}T00:00:00Z`))))errors.push('A valid expiry date is required');
  else if(expiryDate&&Date.parse(`${expiryDate}T23:59:59Z`)<=now)errors.push('An expired document cannot be submitted for verification');
  return{valid:errors.length===0,errors,value:{documentType:type,maskedFinalFour:last4||null,expiryDate:expiryDate||null,notes:clean(input.notes)||null,
    documentId:clean(input.documentId)||null,documentVersionId:clean(input.documentVersionId)||null}};
}

export function validateCompanyDocumentSubmission(input={},now=Date.now()){
  const type=clean(input.documentType),last4=clean(input.maskedFinalFour).toUpperCase(),expiryDate=clean(input.expiryDate),errors=[];
  if(!CORPORATE_IDENTITY_TYPES.includes(type))errors.push('Select a supported corporate document type');
  if(['trade_license','certificate_of_incorporation'].includes(type)&&!/^[A-Z0-9]{4}$/.test(last4))errors.push('Record exactly the final four letters or digits of the registration reference');
  if(type==='trade_license'&&(!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)||!Number.isFinite(Date.parse(`${expiryDate}T00:00:00Z`))))errors.push('Trade Licence expiry date is required');
  if(expiryDate&&Date.parse(`${expiryDate}T23:59:59Z`)<=now)errors.push('An expired corporate document cannot be submitted for verification');
  return{valid:errors.length===0,errors,value:{documentType:type,maskedFinalFour:last4||null,expiryDate:expiryDate||null,notes:clean(input.notes)||null,documentId:clean(input.documentId)||null,documentVersionId:clean(input.documentVersionId)||null}};
}
