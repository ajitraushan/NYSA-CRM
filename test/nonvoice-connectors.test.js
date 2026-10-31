import test from 'node:test';
import assert from 'node:assert/strict';
import {sendLeadEmail,pollLeadEmailInbox,cpanelEmailConfiguration} from '../src/cpanel-lead-email.js';
import {sendLeadWhatsAppTemplate} from '../src/lead-whatsapp.js';
import {mapMetaLead,retrieveMetaLead,sealLeadEvidence,readLeadEvidence} from '../src/meta-lead-retrieval.js';
const env={LEAD_RESPONSE_ENVIRONMENT:'crm-test',LEAD_EMAIL_ENABLED:'true',LEAD_EMAIL_PASSWORD:'synthetic-only',LEAD_EMAIL_TEST_RECIPIENTS:'team@example.invalid',LEAD_EVIDENCE_KEY:'a'.repeat(64)};
test('cPanel sends only from approved mailbox with verified TLS, test recipient and opaque message correlation',async()=>{
 let options,message;
 const createTransport=input=>{options=input;return {sendMail:async value=>{message=value;return {accepted:['team@example.invalid']};},close(){}};};
 const result=await sendLeadEmail({to:'team@example.invalid',subject:'Synthetic test',text:'Synthetic content',attemptRef:'11111111-1111-4111-8111-111111111111'},{env,createTransport});
 assert.equal(options.host,'mail.nysarealty.com');assert.equal(options.port,465);assert.equal(options.secure,true);assert.equal(options.tls.rejectUnauthorized,true);
 assert.equal(message.from.address,'lead@nysarealty.com');assert.equal(result.providerRef,message.messageId);assert.equal(result.state,'accepted');
 await assert.rejects(()=>sendLeadEmail({to:'unapproved@example.invalid',subject:'Test',text:'test',attemptRef:'11111111-1111-4111-8111-111111111111'},{env,createTransport}),/NOT_APPROVED/);
 assert.equal(cpanelEmailConfiguration({}).enabled,false);
});
test('IMAP cutover is read-only, skips history, preserves Outlook flags and stores subsequent replies once',async()=>{
 let cursor=null,saved=0,fetchCount=0,opened;
 const transaction=async work=>work({query:async(sql,p)=>{
  if(sql.startsWith('SELECT * FROM lead_email'))return {rows:cursor?[cursor]:[]};
  if(sql.startsWith('INSERT INTO lead_email'))cursor={uid_validity:p[1],last_uid:p[2]};
  if(sql.startsWith('INSERT INTO lead_response_provider'))saved++;
  if(sql.startsWith('UPDATE lead_email'))cursor.last_uid=p[1];return {rows:[]};
 }});
 let highest=4;
 const imapFactory=options=>{assert.equal(options.port,993);assert.equal(options.secure,true);assert.equal(options.logger,false);return {
  connect:async()=>{},mailboxOpen:async(name,flags)=>{opened=flags;return {uidValidity:1n,uidNext:highest+1};},search:async()=>[highest],
  fetchOne:async(uid,fields)=>{fetchCount++;return fields.size?{size:100}:{source:Buffer.from('synthetic')};},logout:async()=>{}
 };};
 const parseEmail=async()=>({text:'Please call tomorrow',subject:'Re: enquiry',inReplyTo:'<nysa-11111111-1111-4111-8111-111111111111@nysarealty.com>',from:{value:[{address:'team@example.invalid'}]}});
 assert.equal((await pollLeadEmailInbox({transaction,env,imapFactory,parseEmail})).status,'initialized');assert.equal(fetchCount,0);assert.equal(opened.readOnly,true);
 highest=5;assert.equal((await pollLeadEmailInbox({transaction,env,imapFactory,parseEmail})).received,1);assert.equal(saved,1);
 assert.equal((await pollLeadEmailInbox({transaction,env,imapFactory,parseEmail})).status,'idle');assert.equal(saved,1);
});
test('WhatsApp adapter requires approved test recipients and returns acceptance without claiming contact',async()=>{
 const waEnv={LEAD_RESPONSE_ENVIRONMENT:'crm-test',LEAD_WHATSAPP_ENABLED:'true',LEAD_WHATSAPP_API_KEY:'synthetic',LEAD_WHATSAPP_TEST_RECIPIENTS:'+919900000003'};
 let called=false;const fetchImpl=async(url,options)=>{called=true;assert.equal(url,'https://waba-v2.360dialog.io/messages');assert.equal(JSON.parse(options.body).type,'template');return {ok:true,json:async()=>({messages:[{id:'synthetic:wa:1'}]})};};
 assert.equal((await sendLeadWhatsAppTemplate({to:'+919900000003',templateName:'synthetic_ack'},{env:waEnv,fetchImpl})).state,'accepted');assert.equal(called,true);
 await assert.rejects(()=>sendLeadWhatsAppTemplate({to:'+919900000004',templateName:'synthetic_ack'},{env:waEnv,fetchImpl}),/NOT_APPROVED/);
});
test('Meta retrieval binds response to event/form and never includes tokens in URL or error output',async()=>{
 const data=await retrieveMetaLead({eventId:'100',formId:'200'},{accessToken:'synthetic-token',graphVersion:'v99.0',fetchImpl:async(url,options)=>{
 assert.ok(!url.includes('synthetic-token'));assert.equal(options.headers.Authorization,'Bearer synthetic-token');return {ok:true,text:async()=>JSON.stringify({id:'100',form_id:'200',field_data:[]})};}});
 assert.equal(data.id,'100');
 await assert.rejects(()=>retrieveMetaLead({eventId:'100',formId:'200'},{accessToken:'synthetic-token',graphVersion:'v99.0',fetchImpl:async()=>({ok:false})}),/META_RETRIEVAL_UNAVAILABLE/);
});
test('raw answers remain encrypted and absent permission cannot become opt-in',()=>{
 const data={id:'100',form_id:'200',field_data:[{name:'full_name',values:['Synthetic']},{name:'email',values:['team@example.invalid']}]};
 const mapped=mapMetaLead(data,{formIds:['200'],statementVersion:'v2',consentField:'permission',consentAcceptedValue:'yes'});
 assert.equal(mapped.permission.email,false);assert.equal(mapped.locationConfirmed,false);assert.equal(mapped.phoneVerified,false);
 const sealed=sealLeadEvidence(data,'a'.repeat(64));assert.ok(!sealed.includes('team@example.invalid'));assert.deepEqual(readLeadEvidence(sealed,'a'.repeat(64)),data);
});
