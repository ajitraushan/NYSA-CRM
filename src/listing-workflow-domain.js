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

export function listingWorkflowNextStep(queue){
  const steps={
    incomplete_drafts:{kind:'action',title:'Complete this listing draft',detail:'Finish the required listing information, then submit it for review.',buttonLabel:'Continue draft',destination:'edit'},
    changes_requested:{kind:'action',title:'Correct and resubmit this listing',detail:'Review the manager\'s correction instructions, update the listing and resubmit it.',buttonLabel:'Review corrections',destination:'detail'},
    approval_queue:{kind:'waiting',title:'Waiting for manager review',detail:'No action is required from you unless the reviewer returns the listing.',buttonLabel:'View review status',destination:'detail'},
    blocked:{kind:'waiting',title:'Listing is blocked',detail:'Review the recorded reason and contact the responsible manager before proceeding.',buttonLabel:'View block reason',destination:'detail'},
    availability_refresh:{kind:'action',title:'Reconfirm current availability',detail:'Update when availability was last confirmed so brokers receive current information.',buttonLabel:'Refresh availability',destination:'availability'},
    permit_verification_expiry:{kind:'action',title:'Update verification or permit evidence',detail:'Review the verification status and any permit or evidence expiry dates.',buttonLabel:'Update verification',destination:'verification'},
    media_incomplete:{kind:'action',title:'Add approved property media',detail:'Upload compliant property photos and maintain the cover photo.',buttonLabel:'Complete media',destination:'media'},
    readiness_blocks:{kind:'action',title:'Resolve publication-readiness blockers',detail:'Review the missing information identified by NYSA CORE and complete it.',buttonLabel:'Review blockers',destination:'detail'}
  };
  return steps[queue]||{kind:'waiting',title:'Review listing status',detail:'Open the listing to review its current workflow status.',buttonLabel:'Open listing',destination:'detail'};
}
