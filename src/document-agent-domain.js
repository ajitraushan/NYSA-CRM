const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const cleanDate=value=>{
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10);
  const normalized=clean(value);
  return normalized&&/^\d{4}-\d{2}-\d{2}$/.test(normalized)?normalized:null;
};

export function validateBrnDetails({brn,brnIssuedOn}={}){
  const value=clean(brn),issued=cleanDate(brnIssuedOn),hasIssued=brnIssuedOn!==undefined&&brnIssuedOn!==null&&brnIssuedOn!=='';
  if(!value&&hasIssued)return {error:'BRN issue date cannot be maintained without a BRN'};
  if(value&&!issued)return {error:'BRN issue date is required when a BRN is maintained'};
  if(hasIssued&&!issued)return {error:'BRN issue date must be a valid date'};
  return {value:{brn:value,brnIssuedOn:issued}};
}

export function selectDocumentAgent(assignedAgent,defaultAgent){
  const complete=agent=>Boolean(agent&&clean(agent.brn)&&cleanDate(agent.brnIssuedOn));
  if(complete(assignedAgent))return {...assignedAgent,documentAgentSource:'assigned_agent'};
  if(complete(defaultAgent))return {...defaultAgent,documentAgentSource:'default_document_agent'};
  return {error:'A document Agent with both BRN and BRN issue date is required'};
}

export function validateDefaultDocumentAgent(agent){
  if(!agent||agent.status!=='active'||agent.role!=='internal_broker')return {error:'Select an active internal NYSA user as Default Document Agent'};
  if(!clean(agent.brn)||!cleanDate(agent.brnIssuedOn))return {error:'The Default Document Agent requires both BRN and BRN issue date'};
  return {value:agent};
}
