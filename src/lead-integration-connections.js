import {randomUUID} from 'node:crypto';
import {sealLeadEvidence,readLeadEvidence} from './meta-lead-retrieval.js';
const schemas={meta:['appSecret','pageAccessToken','verifyToken','graphVersion'],email:['password'],whatsapp:['apiKey','webhookPassword','phoneId','accountId']};
export function validateLeadConnection(provider,body){
 const fields=schemas[provider];if(!fields||!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!fields.includes(key)))throw Object.assign(new Error('Unsupported protected connection fields'),{statusCode:400});
 for(const key of fields)if(typeof body[key]!=='string'||!body[key]||body[key].length>4096)throw Object.assign(new Error('Complete the protected connection fields'),{statusCode:400});
 if(provider==='meta'&&(!/^v\d+\.\d+$/.test(body.graphVersion)||body.appSecret.length<32||body.verifyToken.length<32))throw Object.assign(new Error('Use the approved Graph version and strong webhook secrets'),{statusCode:400});
 if(provider==='whatsapp'&&(!/^\d+$/.test(body.phoneId)||!/^\d+$/.test(body.accountId)||body.webhookPassword.length<32))throw Object.assign(new Error('Use provider account IDs and a strong webhook secret'),{statusCode:400});
 return Object.fromEntries(fields.map(key=>[key,body[key]]));
}
export async function saveLeadConnection({provider,body,actorId,key},client){
 const credentials=validateLeadConnection(provider,body),sealed=sealLeadEvidence(credentials,key);
 const record=(await client.query(`INSERT INTO lead_integration_connections(id,provider,encrypted_credentials,updated_by)
 VALUES($1,$2,$3,$4) ON CONFLICT(provider) DO UPDATE SET encrypted_credentials=EXCLUDED.encrypted_credentials,
 revision=lead_integration_connections.revision+1,updated_by=EXCLUDED.updated_by,updated_at=NOW() RETURNING id,revision`,[randomUUID(),provider,sealed,actorId])).rows[0];
 await client.query(`INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details) VALUES($1,'LeadIntegrationConnection',$2,'credentials_saved',$3,$4)`,
 [randomUUID(),record.id,actorId,JSON.stringify({provider,revision:record.revision,liveSendingEnabled:false})]);
 return {provider,revision:record.revision,credentialsSaved:true,liveSendingEnabled:false};
}
export async function leadConnectionEnvironment(client,key){
 const rows=(await client.query('SELECT provider,encrypted_credentials FROM lead_integration_connections')).rows;const env={};
 for(const row of rows){const value=readLeadEvidence(row.encrypted_credentials,key);
  if(row.provider==='meta')Object.assign(env,{META_APP_SECRET:value.appSecret,META_LEAD_ACCESS_TOKEN:value.pageAccessToken,META_WEBHOOK_VERIFY_TOKEN:value.verifyToken,META_GRAPH_VERSION:value.graphVersion});
  if(row.provider==='email')env.LEAD_EMAIL_PASSWORD=value.password;
  if(row.provider==='whatsapp')Object.assign(env,{LEAD_WHATSAPP_API_KEY:value.apiKey,LEAD_WHATSAPP_WEBHOOK_PASSWORD:value.webhookPassword,LEAD_WHATSAPP_PHONE_ID:value.phoneId,LEAD_WHATSAPP_ACCOUNT_ID:value.accountId});
 }
 return env;
}
