export const MEDIA_RIGHTS_BASES=Object.freeze([
  'owner_authorized',
  'developer_authorized',
  'agency_authorized',
  'documented_other',
  'legacy_approved'
]);

const text=value=>typeof value==='string'?value.trim():'';

export function normalizeMediaGovernance(body={},now=new Date()){
  const usageRightsConfirmed=body.usageRightsConfirmed===true||body.usageRightsConfirmed==='true'||body.usageRightsConfirmed==='on';
  const rightsBasis=text(body.rightsBasis);
  const rightsExpiresAt=text(body.rightsExpiresAt)||null;
  if(!usageRightsConfirmed)return{error:'Confirm that NYSA is permitted to use this media'};
  if(!MEDIA_RIGHTS_BASES.includes(rightsBasis)||rightsBasis==='legacy_approved')return{error:'Select the documented media-rights basis'};
  if(rightsExpiresAt){
    const expiry=new Date(rightsExpiresAt);
    if(Number.isNaN(expiry.valueOf()))return{error:'Media-rights expiry must be a valid date'};
    if(expiry<=now)return{error:'Media-rights expiry must be in the future'};
  }
  return{usageRightsConfirmed:true,rightsBasis,rightsExpiresAt};
}

export function mediaRightsAreCurrent(media,now=new Date()){
  if(!media?.usageRightsConfirmed||!MEDIA_RIGHTS_BASES.includes(media.rightsBasis))return false;
  return !media.rightsExpiresAt||new Date(media.rightsExpiresAt)>now;
}

export function validateMediaReview(media,{approvalStatus,reason}={},now=new Date()){
  if(!['approved','rejected'].includes(approvalStatus))return'Choose Approve or Reject';
  if(approvalStatus==='rejected'&&!text(reason))return'A rejection reason is required';
  if(approvalStatus==='approved'&&!mediaRightsAreCurrent(media,now))return'Current documented media-use rights are required before approval';
  return null;
}

export function mediaApprovalPlan(reviewer,actorId,now=new Date()){
  if(reviewer?.managerId)return{
    approvalStatus:'pending',
    approvedBy:null,
    approvedAt:null,
    automatic:false
  };
  return{
    approvalStatus:'approved',
    approvedBy:actorId,
    approvedAt:now,
    automatic:true
  };
}
