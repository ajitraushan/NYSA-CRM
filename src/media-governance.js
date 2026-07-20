export const MEDIA_RIGHTS_BASES=Object.freeze([
  'owner_authorized',
  'developer_authorized',
  'agency_authorized',
  'documented_other',
  'legacy_approved'
]);

export const PROPERTY_MEDIA_BATCH_POLICY=Object.freeze({maxFiles:10,maxTotalBytes:20*1024*1024});

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

export function mediaApprovalPlan(reviewer,actorId,now=new Date(),policy={managerApprovalRequired:true}){
  if(policy.managerApprovalRequired!==false&&reviewer?.managerId)return{
    approvalStatus:'pending',
    approvedBy:null,
    approvedAt:null,
    automatic:false,
    automaticReason:null
  };
  return{
    approvalStatus:'approved',
    approvedBy:actorId,
    approvedAt:now,
    automatic:true,
    automaticReason:policy.managerApprovalRequired===false?'approval_policy_disabled':'no_responsible_manager'
  };
}

export function validateMediaBatch(files,policy=PROPERTY_MEDIA_BATCH_POLICY){
  if(!Array.isArray(files)||!files.length)return'Select at least one property photo';
  if(files.length>policy.maxFiles)return`Select no more than ${policy.maxFiles} files in one batch`;
  const totalBytes=files.reduce((sum,file)=>sum+Number(file?.buffer?.length||0),0);
  if(totalBytes>policy.maxTotalBytes)return`The selected batch exceeds ${Math.round(policy.maxTotalBytes/1024/1024)} MB`;
  const hashes=files.map(file=>file?.fileHash).filter(Boolean);
  if(new Set(hashes).size!==hashes.length)return'The selected batch contains the same file more than once';
  return null;
}
