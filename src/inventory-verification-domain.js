const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;

export function validateVerificationSubmission({currentStatus,requestType,reason,evidenceReference}={}){
  if(!['verification','exemption'].includes(requestType))return {error:'Select verification or a Not required exemption request'};
  if(requestType==='verification'&&!['unverified','expired'].includes(currentStatus))return {error:currentStatus==='pending'?'Verification is already pending':currentStatus==='verified'?'Verified Inventory does not require verification':'This Inventory cannot be submitted for verification'};
  if(requestType==='exemption'&&!['unverified','expired'].includes(currentStatus))return {error:'Only unverified or expired Inventory can request a Not required exemption'};
  if(!clean(reason))return {error:requestType==='exemption'?'An exemption reason is required':'A verification submission reason is required'};
  if(requestType==='verification'&&!clean(evidenceReference))return {error:'Verification evidence reference is required'};
  return {value:{requestType,reason:clean(reason),evidenceReference:clean(evidenceReference)}};
}

export function validateVerificationDecision({requestStatus,requestType,decision,reason}={}){
  if(requestStatus!=='pending')return {error:'Only a pending verification request can receive a decision'};
  const allowed=requestType==='exemption'?['exempted','returned','rejected']:['verified','returned','rejected'];
  if(!allowed.includes(decision))return {error:`Select ${requestType==='exemption'?'Approve exemption, Return, or Reject':'Verify, Return, or Reject'}`};
  if(!clean(reason))return {error:'Decision reason is required'};
  return {value:{decision,reason:clean(reason)}};
}

export function listingStatusForVerificationDecision(requestType,decision){
  if(decision==='verified')return 'verified';
  if(decision==='exempted')return 'not_required';
  return 'unverified';
}
