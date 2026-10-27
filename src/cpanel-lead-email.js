import crypto from 'node:crypto';
import {sealLeadEvidence} from './meta-lead-retrieval.js';
const enabled=env=>env.LEAD_EMAIL_ENABLED==='true'&&['local','crm-test'].includes(env.LEAD_RESPONSE_ENVIRONMENT);
export function cpanelEmailConfiguration(env=process.env){
 return {enabled:enabled(env)&&Boolean(env.LEAD_EMAIL_PASSWORD),host:'mail.nysarealty.com',smtpPort:465,imapPort:993,
 username:'lead@nysarealty.com',secure:true};
}
export async function sendLeadEmail({to,subject,text,attemptRef},{env=process.env,createTransport}={}){
 const config=cpanelEmailConfiguration(env);if(!config.enabled)throw new Error('CPANEL_EMAIL_DISABLED');
 if(typeof to!=='string'||/\r|\n/.test(to)||!/^\S+@\S+\.\S+$/.test(to)||typeof subject!=='string'||/[\r\n]/.test(subject)||
  subject.length>200||typeof text!=='string'||text.length>20000||!/^[a-f0-9-]{36}$/.test(attemptRef))throw new Error('EMAIL_ENVELOPE_INVALID');
 if(env.LEAD_RESPONSE_ENVIRONMENT==='crm-test' && !String(env.LEAD_EMAIL_TEST_RECIPIENTS||'').split(',').map(v=>v.trim().toLowerCase()).includes(to.toLowerCase()))throw new Error('EMAIL_TEST_RECIPIENT_NOT_APPROVED');
 const factory=createTransport||(await import('nodemailer')).default.createTransport;
 const transport=factory({host:config.host,port:465,secure:true,auth:{user:config.username,pass:env.LEAD_EMAIL_PASSWORD},
  tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},logger:false,debug:false,connectionTimeout:10000,socketTimeout:15000});
 const messageId=`<nysa-${attemptRef}@nysarealty.com>`;
 try{
  const result=await transport.sendMail({from:{name:'NYSA Realty',address:config.username},to,subject,text,messageId,
    headers:{'Auto-Submitted':'auto-generated','List-Unsubscribe':`<mailto:lead@nysarealty.com?subject=STOP%20${encodeURIComponent(messageId)}>`}});
  if(!result.accepted?.length)throw new Error('EMAIL_NOT_ACCEPTED');return {providerRef:messageId,state:'accepted'};
 }catch{throw new Error('EMAIL_SUBMISSION_OUTCOME_UNKNOWN');}finally{transport.close?.();}
}
export async function pollLeadEmailInbox({transaction,env=process.env,imapFactory,parseEmail}={}){
 const config=cpanelEmailConfiguration(env);if(!config.enabled)return {status:'disabled'};
 if(!env.LEAD_EVIDENCE_KEY)throw new Error('EMAIL_EVIDENCE_KEY_REQUIRED');
 const ImapClass=imapFactory?null:(await import('imapflow')).ImapFlow;
 const make=imapFactory||(options=>new ImapClass(options));
 const parser=parseEmail||(await import('mailparser')).simpleParser;
 const client=make({host:config.host,port:993,secure:true,auth:{user:config.username,pass:env.LEAD_EMAIL_PASSWORD},
  logger:false,emitLogs:false,disableAutoIdle:true,tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},socketTimeout:15000});
 const connectionRef='cpanel:lead',digest=value=>crypto.createHash('sha256').update(value).digest('hex');
 try{
  await client.connect();const box=await client.mailboxOpen('INBOX',{readOnly:true});
  const validity=String(box.uidValidity),highest=Math.max(0,Number(box.uidNext)-1);
  const cursor=await transaction(async c=>(await c.query('SELECT * FROM lead_email_mailbox_cursors WHERE connection_ref=$1',[connectionRef])).rows[0]);
  if(!cursor){
   // Establish the cutover before outbound email is enabled; never import historical mail.
   await transaction(c=>c.query('INSERT INTO lead_email_mailbox_cursors(connection_ref,uid_validity,last_uid) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[connectionRef,validity,highest]));
   return {status:'initialized',historicalMailSkipped:true};
  }
  if(cursor.uid_validity!==validity)throw new Error('EMAIL_UID_VALIDITY_CHANGED_REVIEW_REQUIRED');
  if(highest<=Number(cursor.last_uid))return {status:'idle',received:0};
  const uids=(await client.search({uid:`${Number(cursor.last_uid)+1}:${highest}`},{uid:true})).filter(uid=>uid>Number(cursor.last_uid)&&uid<=highest).sort((a,b)=>a-b).slice(0,20);
  let received=0;
  for(const uid of uids){
   const size=await client.fetchOne(uid,{size:true},{uid:true});
   if(!size||Number(size.size)>256*1024){
    const event={provider:'email',connectionRef,eventRef:`oversize:${validity}:${uid}`,messageRef:'',type:'unsupported',text:'Message requires manual mailbox review'};
    await transaction(async c=>{
     await c.query(`INSERT INTO lead_response_provider_inbox(id,provider,event_ref,connection_ref,event_digest,encrypted_payload,state,error_code,expires_at)
       VALUES($1,'email',$2,$3,$4,$5,'needs_review','EMAIL_MESSAGE_TOO_LARGE',NOW()+INTERVAL '12 months') ON CONFLICT(provider,connection_ref,event_ref) DO NOTHING`,
       [crypto.randomUUID(),event.eventRef,connectionRef,digest(JSON.stringify(event)),sealLeadEvidence(event,env.LEAD_EVIDENCE_KEY)]);
     await c.query('UPDATE lead_email_mailbox_cursors SET last_uid=GREATEST(last_uid,$2),updated_at=NOW() WHERE connection_ref=$1',[connectionRef,uid]);
    });continue;
   }
   const message=await client.fetchOne(uid,{source:true},{uid:true});if(!message?.source)throw new Error('EMAIL_SOURCE_UNAVAILABLE');
   const parsed=await parser(message.source,{skipHtmlToText:true,skipTextToHtml:true,skipImageLinks:true});
   const auto=String(parsed.headers?.get?.('auto-submitted')||'no').toLowerCase();
   if(auto!=='no'){
    await transaction(c=>c.query('UPDATE lead_email_mailbox_cursors SET last_uid=GREATEST(last_uid,$2),updated_at=NOW() WHERE connection_ref=$1',[connectionRef,uid]));continue;
   }
   const rawText=String(parsed.text||'').slice(0,10000),subject=String(parsed.subject||'').slice(0,200);
   const refs=[parsed.inReplyTo,...(Array.isArray(parsed.references)?parsed.references:[parsed.references])].filter(Boolean);
   const ref=refs.find(r=>/^<nysa-[a-f0-9-]{36}@nysarealty\.com>$/.test(String(r)))||subject.match(/<nysa-[a-f0-9-]{36}@nysarealty\.com>/)?.[0]||'';
   const type=/^\s*(stop|unsubscribe|do not contact)\b/i.test(rawText)||/^STOP\b/i.test(subject)?'opt_out':'reply';
   const event={provider:'email',occurredAt:new Date().toISOString(),sender:String(parsed.from?.value?.[0]?.address||'').toLowerCase(),connectionRef,eventRef:`${validity}:${uid}`,messageRef:ref,type,text:rawText};
   await transaction(async c=>{
    await c.query(`INSERT INTO lead_response_provider_inbox(id,provider,event_ref,connection_ref,event_digest,encrypted_payload,expires_at)
     VALUES($1,'email',$2,$3,$4,$5,NOW()+INTERVAL '12 months') ON CONFLICT(provider,connection_ref,event_ref) DO NOTHING`,
     [crypto.randomUUID(),event.eventRef,connectionRef,digest(JSON.stringify(event)),sealLeadEvidence(event,env.LEAD_EVIDENCE_KEY)]);
    await c.query('UPDATE lead_email_mailbox_cursors SET last_uid=GREATEST(last_uid,$2),updated_at=NOW() WHERE connection_ref=$1',[connectionRef,uid]);
   });received++;
  }
  return {status:'received',received};
 }catch(error){throw new Error(/^EMAIL_[A-Z_]+$/.test(error?.message||'')?error.message:'EMAIL_POLL_UNAVAILABLE');}
 finally{await client.logout().catch(()=>{});}
}
