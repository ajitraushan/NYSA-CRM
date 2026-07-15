const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;

export function validateOrganizationProfile(body={}){
  const profile={
    legalName:clean(body.legalName),displayName:clean(body.displayName),tradeLicenseNumber:clean(body.tradeLicenseNumber),
    registrationAuthority:clean(body.registrationAuthority),registeredAddress:clean(body.registeredAddress),primaryPhone:clean(body.primaryPhone),
    primaryEmail:clean(body.primaryEmail)?.toLowerCase()||null,websiteUrl:clean(body.websiteUrl),defaultCurrency:String(body.defaultCurrency||'AED').trim().toUpperCase(),
    timezone:clean(body.timezone)||'Asia/Dubai',locale:clean(body.locale)||'en-AE',brandVersion:clean(body.brandVersion),
    proposalFooter:clean(body.proposalFooter),defaultDisclaimer:clean(body.defaultDisclaimer)
  };
  if(!profile.legalName||!profile.displayName||!profile.brandVersion)return {error:'Legal name, display name and brand version are required'};
  if(!/^[A-Z]{3}$/.test(profile.defaultCurrency))return {error:'Default currency must be a three-letter ISO currency code'};
  if(profile.primaryEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.primaryEmail))return {error:'Primary email is invalid'};
  if(profile.websiteUrl){try{const u=new URL(profile.websiteUrl);if(!['http:','https:'].includes(u.protocol))throw new Error();}catch{return {error:'Website must be a valid HTTP or HTTPS URL'};}}
  try{new Intl.DateTimeFormat(profile.locale,{timeZone:profile.timezone}).format(new Date());}catch{return {error:'Locale or timezone is invalid'};}
  return {profile};
}

export function publicOrganization(org){
  if(!org)return null;
  const {logoStorageKey,...safe}=org;
  return {...safe,logo:org.logoFileName?{fileName:org.logoFileName,mediaType:org.logoMediaType,fileSizeBytes:org.logoFileSizeBytes,fileHash:org.logoFileHash,downloadUrl:`/api/admin/organization-settings/${org.id}/logo`}:null};
}

export function formatOrganizationDate(value,org){
  return new Intl.DateTimeFormat(org.locale||'en-AE',{dateStyle:'medium',timeStyle:'short',timeZone:org.timezone||'Asia/Dubai'}).format(new Date(value));
}

export function organizationContactLines(org){
  return [
    org.legalName&&org.legalName!==org.displayName?`Legal entity: ${org.legalName}`:null,
    org.tradeLicenseNumber?`Trade licence: ${org.tradeLicenseNumber}${org.registrationAuthority?` | ${org.registrationAuthority}`:''}`:null,
    org.registeredAddress?`Registered address: ${org.registeredAddress}`:null,
    [org.primaryPhone,org.primaryEmail,org.websiteUrl].filter(Boolean).join(' | ')||null
  ].filter(Boolean);
}
