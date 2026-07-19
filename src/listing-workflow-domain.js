export const LISTING_WORKFLOW_STATUSES=['draft','in_review','approved','changes_requested','blocked'];

export const LISTING_WORKFLOW_LABELS={
  draft:'Draft',
  in_review:'Awaiting review',
  approved:'Approved',
  changes_requested:'Changes requested',
  blocked:'Blocked'
};

export function listingWorkflowTransition(current,action){
  const transitions={
    draft:{submit:'in_review',block:'blocked'},
    changes_requested:{submit:'in_review',block:'blocked'},
    in_review:{approve:'approved',request_changes:'changes_requested',block:'blocked'},
    approved:{block:'blocked'},
    blocked:{restore:'draft'}
  };
  return transitions[current]?.[action]||null;
}

export function validateListingWorkflowAction({current,action,reason,isOwner=false,canReview=false}){
  const next=listingWorkflowTransition(current,action);
  if(!next)return `Cannot ${String(action||'').replaceAll('_',' ')} a listing while it is ${LISTING_WORKFLOW_LABELS[current]||current}`;
  if(action==='submit'&&!isOwner&&!canReview)return 'Only the Listing Executive who owns the record or an authorized reviewer can submit it';
  if(['approve','request_changes','block','restore'].includes(action)&&!canReview)return 'Only the responsible Manager or Administrator can perform this review action';
  if(['request_changes','block','restore'].includes(action)&&!String(reason||'').trim())return 'A review reason is required';
  return null;
}

export function listingWorkflowQueue(listing,now=new Date()){
  if(listing.workflowStatus==='changes_requested')return 'changes_requested';
  if(listing.workflowStatus==='draft')return 'incomplete_drafts';
  if(listing.workflowStatus==='in_review')return 'approval_queue';
  if(listing.workflowStatus==='blocked')return 'blocked';
  if(listing.status==='Closed')return 'closed';
  const availability=listing.availabilityConfirmedAt?new Date(listing.availabilityConfirmedAt):null;
  if(!availability||now-availability>7*86400000)return 'availability_refresh';
  const expiry=[listing.permitExpiresAt,listing.verificationExpiresAt].filter(Boolean).map(value=>new Date(value)).sort((a,b)=>a-b)[0];
  if(expiry&&expiry-now<30*86400000)return 'permit_verification_expiry';
  if(Number(listing.approvedMediaCount||0)===0)return 'media_incomplete';
  return listing.publicationReadiness?.ready?'ready':'readiness_blocks';
}
