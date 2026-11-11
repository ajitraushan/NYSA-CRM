export const DEFAULT_PROSPECT_OUTSIDE_CALLING_HOURS_MODE='warning';
export const PROSPECT_OUTSIDE_CALLING_HOURS_MODES=Object.freeze(['warning','refuse']);

let configured;

export function parseProspectCallingPolicyConfig(env=process.env){
  const mode=String(env.PROSPECT_OUTSIDE_CALLING_HOURS_MODE||DEFAULT_PROSPECT_OUTSIDE_CALLING_HOURS_MODE).trim().toLowerCase();
  if(!PROSPECT_OUTSIDE_CALLING_HOURS_MODES.includes(mode))throw new Error('PROSPECT_OUTSIDE_CALLING_HOURS_MODE must be warning or refuse');
  return Object.freeze({outsideCallingHoursMode:mode,source:Object.prototype.hasOwnProperty.call(env,'PROSPECT_OUTSIDE_CALLING_HOURS_MODE')?'environment':'default'});
}

export function configureProspectCallingPolicy(env=process.env){
  const next=parseProspectCallingPolicyConfig(env);
  if(configured&&configured.outsideCallingHoursMode!==next.outsideCallingHoursMode)throw new Error('Prospect calling-policy configuration is already frozen for this process');
  configured??=next;
  return configured;
}

export function prospectCallingPolicyConfig(){return configured??configureProspectCallingPolicy(process.env);}

export function resetProspectCallingPolicyForTests(){configured=undefined;}
