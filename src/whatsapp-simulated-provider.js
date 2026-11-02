import crypto from 'node:crypto';

export const SIMULATED_PROVIDER_NAME='NYSA WhatsApp Simulator';
export const DEFAULT_SYNTHETIC_PREFIX='+971509';
export const SIMULATION_RATES=new Set([5,20,50]);
export const SIMULATION_FAULTS=new Set(['none','timeout','rate_limited','server_error','invalid_number','invalid_payload','template_paused']);
export const SIMULATION_BACKDATE_HOURS=new Set([23,25,71,73]);

const bool=value=>String(value||'').trim().toLowerCase()==='true';
const stable=value=>{
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
};

export function simulatedPayloadHash(payload){
  return crypto.createHash('sha256').update(JSON.stringify(stable(payload))).digest('hex');
}

export function simulatedProviderConfig(env=process.env){
  const enabled=bool(env.WHATSAPP_SIMULATED_PROVIDER_ENABLED);
  const environment=String(env.LEAD_RESPONSE_ENVIRONMENT||env.NYSA_ENVIRONMENT||'').trim().toLowerCase();
  const port=Number(env.PORT||3000);
  const baseUrl=String(env.WHATSAPP_SIMULATED_PROVIDER_URL||`http://127.0.0.1:${port}/api/providers/whatsapp-simulated`).replace(/\/$/,'');
  const callbackToken=String(env.WHATSAPP_SIMULATED_PROVIDER_TOKEN||'');
  const syntheticPrefix=String(env.WHATSAPP_SIMULATED_PHONE_PREFIX||DEFAULT_SYNTHETIC_PREFIX).trim();
  const syntheticDigits=Number(env.WHATSAPP_SIMULATED_PHONE_SUFFIX_DIGITS||6);
  return {enabled,environment,baseUrl,callbackToken,syntheticPrefix,syntheticDigits,provider:SIMULATED_PROVIDER_NAME};
}

export function assertSimulatedProviderEnvironment(env=process.env){
  const config=simulatedProviderConfig(env);
  if(!config.enabled)return config;
  if(config.environment!=='crm-test')throw new Error('WhatsApp simulator may be enabled only when LEAD_RESPONSE_ENVIRONMENT=crm-test');
  const url=new URL(config.baseUrl);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','::1'].includes(url.hostname))throw new Error('WhatsApp simulator provider URL must be loopback HTTP');
  if(!url.pathname.startsWith('/api/providers/whatsapp-simulated'))throw new Error('WhatsApp simulator provider URL must use the isolated simulated-provider route');
  if(config.callbackToken.length<32)throw new Error('WHATSAPP_SIMULATED_PROVIDER_TOKEN must contain at least 32 characters when the simulator is enabled');
  if(!/^\+[1-9][0-9]{4,10}$/.test(config.syntheticPrefix))throw new Error('WHATSAPP_SIMULATED_PHONE_PREFIX must be an E.164 prefix');
  if(!Number.isInteger(config.syntheticDigits)||config.syntheticDigits<4||config.syntheticDigits>9||config.syntheticPrefix.length+config.syntheticDigits>16)throw new Error('WHATSAPP_SIMULATED_PHONE_SUFFIX_DIGITS must define a valid bounded E.164 test range');
  if(env.LEAD_WHATSAPP_API_KEY||env.WHATSAPP_API_KEY||env.META_WHATSAPP_ACCESS_TOKEN)throw new Error('Live WhatsApp credentials must not be present when the CRM Test simulator is enabled');
  return config;
}

export function isSyntheticWhatsAppPhone(value,config=simulatedProviderConfig()){
  const phone=String(value||'').replace(/[\s()-]/g,'');
  const suffix=phone.startsWith(config.syntheticPrefix)?phone.slice(config.syntheticPrefix.length):'';
  return /^\+[1-9][0-9]{7,14}$/.test(phone)&&suffix.length===config.syntheticDigits&&/^\d+$/.test(suffix);
}

export function assertSyntheticWhatsAppPhone(value,config=simulatedProviderConfig()){
  const phone=String(value||'').replace(/[\s()-]/g,'');
  if(!isSyntheticWhatsAppPhone(phone,config))throw Object.assign(new Error(`Simulator recipients must use the agreed ${config.syntheticPrefix} synthetic range`),{statusCode:409,code:'SIMULATED_RECIPIENT_REQUIRED'});
  return phone;
}

export function assertSimulatedProviderUrl(url,config=simulatedProviderConfig()){
  const expected=new URL(config.baseUrl),candidate=new URL(String(url));
  if(candidate.origin!==expected.origin||!candidate.pathname.startsWith(`${expected.pathname}/`)){
    console.error(JSON.stringify({component:'whatsapp-simulator',event:'external-provider-host-blocked'}));
    throw Object.assign(new Error('External WhatsApp provider hosts are blocked while simulation mode is active'),{statusCode:409,code:'SIMULATED_EXTERNAL_HOST_BLOCKED'});
  }
  return candidate.toString();
}

export function simulationStatusSequence({failure=false}={}){
  return failure?['sent','failed']:['sent','delivered','read'];
}

export function normalizeSimulationFault(value){
  const fault=String(value||'none').trim().toLowerCase();
  if(!SIMULATION_FAULTS.has(fault))throw new Error('Unsupported simulated provider fault');
  return fault;
}

export function normalizeSimulationRate(value){
  const rate=Number(value||5);
  if(!SIMULATION_RATES.has(rate))throw new Error('Simulation rate must be 5, 20 or 50 messages per second');
  return rate;
}

export function normalizeBackdateHours(value){
  const hours=Number(value);
  if(!SIMULATION_BACKDATE_HOURS.has(hours))throw new Error('Backdate hours must be 23, 25, 71 or 73');
  return hours;
}

export function deterministicRandom(seed){
  let state=crypto.createHash('sha256').update(String(seed)).digest().readUInt32LE(0)||1;
  return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/0x100000000;};
}

export function syntheticPhoneAt(index,config=simulatedProviderConfig()){
  const suffixLength=config.syntheticDigits;
  const max=10**suffixLength;
  const suffix=String(Number(index)%max).padStart(suffixLength,'0');
  return assertSyntheticWhatsAppPhone(`${config.syntheticPrefix}${suffix}`,config);
}

export function buildSimulatedOutbound({to,type='text',text='',templateVersionId=null,actorId=null,conversationId=null,correlationId=crypto.randomUUID()},config=simulatedProviderConfig()){
  return {messaging_product:'whatsapp',simulation:true,correlation_id:correlationId,to:assertSyntheticWhatsAppPhone(to,config),type,text:String(text||'').slice(0,4096),template_version_id:templateVersionId,actor_id:actorId,conversation_id:conversationId};
}

export function buildSimulatedInbound({from,name='Synthetic WhatsApp Prospect',text='Hello from the simulator',teamId,agentId=null,actorId,sourceType='other',ctwa=false,button=null,media=null,eventId=crypto.randomUUID(),occurredAt=new Date().toISOString(),simulationRunId=null},config=simulatedProviderConfig()){
  return {id:eventId,type:'inbound_message',simulation:true,from:assertSyntheticWhatsAppPhone(from,config),name:String(name).slice(0,160),text:String(text||'').slice(0,4096),team_id:teamId,agent_id:agentId,actor_id:actorId,source_type:ctwa?'website_ctwa':sourceType,ctwa_referral:ctwa?{source_url:'https://example.invalid/synthetic-ctwa',headline:'Synthetic CTWA'}:null,button:button||null,media:media||null,occurred_at:occurredAt,simulation_run_id:simulationRunId};
}

export function simulationBadge(value){return value?'SIMULATED':null;}
