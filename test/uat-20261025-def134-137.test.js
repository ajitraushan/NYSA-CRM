import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {acceptancePdfData,makeAcceptancePdf} from '../src/offer-acceptance-pdf.js';
import {canReadAllCrmDocuments,isCrmDocumentReadRequest} from '../src/document-read-policy.js';
import {governedRoleRequestDecision} from '../src/role-access.js';
import {accountantRequestAllowed} from '../src/accountant-access.js';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const revision={id:'revision-1',revisionNumber:1,amount:'3100000',currency:'AED',fileName:'Synthetic_Offer_Rev-1.pdf',fileHash:'a'.repeat(64)};
const offer={offerReference:'SYN-OF-001',acceptedRevisionId:revision.id,opportunityReference:'SYN-OP-001',listingProject:'Synthetic Marina',inventoryReference:'SYN-INV-001'};
const events=['buyer','seller'].map((side,index)=>({eventType:'accepted',offerRevisionId:revision.id,acceptingSide:side,acceptingPartyId:'party-'+side,partyName:'Synthetic '+side,acceptanceEvidence:'Written confirmation '+side,occurredAt:`2026-10-25T${index?18:17}:15:16Z`,actorName:'Synthetic Agent'}));

test('Acceptance PDF follows existing all-role document-read policy without granting writes',()=>{
  const path='/crm/offers/00000000-0000-4000-8000-000000000001/acceptance.pdf';
  assert.equal(isCrmDocumentReadRequest('GET',path),true);assert.equal(isCrmDocumentReadRequest('POST',path),false);
  for(const role of ['admin','internal_broker','partner_broker','viewer'])assert.equal(canReadAllCrmDocuments({role,status:'active'}),true);
  assert.equal(canReadAllCrmDocuments({role:'viewer',status:'suspended'}),false);
  assert.equal(governedRoleRequestDecision({role:'admin'},'GET',path).allowed,true);
  assert.equal(governedRoleRequestDecision({role:'admin'},'POST',path).allowed,false);
  assert.equal(accountantRequestAllowed({role:'internal_broker',jobRole:'accountant'},'GET',path),true);
});

test('DEF-136 acceptance PDF requires both exact-revision events, party identity and evidence',()=>{
  assert.equal(acceptancePdfData(offer,revision,events).parties.length,2);
  for(const invalid of [events.slice(0,1),[events[0],{...events[1],eventType:'acknowledged'}],[events[0],{...events[1],offerRevisionId:'old'}],[events[0],{...events[1],acceptanceEvidence:''}],[events[0],{...events[1],acceptingPartyId:null}],[events[0],{...events[1],partyName:null}],[...events,events[1]]])assert.throws(()=>acceptancePdfData(offer,revision,invalid),/Both parties/);
  assert.throws(()=>acceptancePdfData({...offer,acceptedRevisionId:null},revision,events),/not the accepted/);
});

test('DEF-136 PDF has exact identities, Dubai timestamps and original hash without signing claims',()=>{
  const input=acceptancePdfData(offer,revision,events),before=JSON.stringify(input),pdf=makeAcceptancePdf(input,{displayName:'NYSA Realty'}),text=pdf.toString();
  assert.match(text,/^%PDF/);for(const value of ['Accepted by both parties','Synthetic buyer','Synthetic seller','21:15:16','22:15:16','Asia\/Dubai',revision.fileHash,'does not add party signatures'])assert.match(text,new RegExp(value));
  assert.equal(JSON.stringify(input),before);
  const long=makeAcceptancePdf({...input,parties:input.parties.map(p=>({...p,evidence:'Evidence '.repeat(600)+'FINAL-EVIDENCE-MARKER'}))}).toString();
  assert.match(long,/FINAL-EVIDENCE-MARKER/);assert.ok((long.match(/\/Type \/Page\b/g)||[]).length>1);
});

test('DEF-136 explicit outcome and party survive submit; evidence and final button identify acceptance',async()=>{
  const source=read('public/offer-ui.js'),forms=[],calls=[],messages=[];
  const control=(value,tagName='SELECT')=>({value,tagName,selectedOptions:[{textContent:'Seller'}],listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}});
  const outcome=control(''),party=control(''),evidence=control('','INPUT'),button={};
  const form={elements:{eventType:outcome,counterpartyRole:party,acceptanceEvidence:evidence},dataset:{currentDirection:'outbound'},querySelector:()=>button,reportValidity:()=>Boolean(outcome.value&&party.value&&(outcome.value!=='accepted'||evidence.value)),closest:()=>({dataset:{offerId:'synthetic-offer',offerVersion:4}}),addEventListener(type,fn){this[type]=fn;}};
  forms.push(form);
  const root={querySelectorAll:selector=>selector==='.offer-event-form'?forms:[],refreshOpportunity:()=>{},matches:()=>false};
  const context={console,FormData:class{constructor(form){return new Map(Object.entries(form.elements).map(([key,c])=>[key,c.value]));}},installBusinessAmountInputs:()=>{},$:()=>null,toast:message=>messages.push(message),api:async(path,options)=>{calls.push({path,...options});return{status:'accepted',requiresBilateralAcceptance:true};}};
  vm.createContext(context);vm.runInContext(source,context);vm.runInContext('globalThis.bind=bindOfferWorkspace',context);context.bind(root,{opportunityId:'synthetic-opportunity',onChanged:()=>{}});
  const submit=()=>form.submit({preventDefault(){}});
  await submit();assert.equal(calls.length,0);
  outcome.value='accepted';outcome.listeners.change();assert.equal(evidence.required,true);await submit();assert.equal(calls.length,0);
  party.value='seller';party.listeners.change();assert.equal(button.textContent,'Record Seller acceptance');evidence.value='Synthetic written confirmation';await submit();
  assert.equal(calls.length,1);assert.equal(calls[0].body.eventType,'accepted');assert.equal(calls[0].body.counterpartyRole,'seller');assert.equal(calls[0].body.acceptanceEvidence,evidence.value);assert.match(messages[0],/Both parties/);
  outcome.value='acknowledged';outcome.listeners.change();assert.equal(evidence.required,false);await submit();assert.equal(calls[1].body.eventType,'acknowledged');
});

test('DEF-135 reset clears all filters before reloading and restarts page one',()=>{
  const source=read('public/app.js'),handler=source.match(/reset.addEventListener\('click',\(\)=>\{(.*?)\}\);\$\('#customer-q'\)/s)[1],fields=Object.fromEntries(['q','mobile','passportLast4','emiratesIdLast4','kyc','duplicate','sort'].map(k=>['#customer-'+k,{value:'old'}]));let reloads=0;
  vm.runInNewContext(handler,{$:id=>fields[id],restart(){reloads++;assert.equal(fields['#customer-mobile'].value,'');}});
  for(const [key,field] of Object.entries(fields))assert.equal(field.value,key.endsWith('sort')?'newest':'');assert.equal(reloads,1);assert.match(source,/const restart=\(\)=>\{page=1;load\(\);\}/);
});

test('DEF-134 effective routing loader populates options supplied by Admin API and retains selection',async()=>{
  const source=read('public/app.js'),body=source.slice(source.lastIndexOf('loadRoutingRules=async function(){')).split('\n')[0],nodes={},business={value:'Rental'};
  for(const id of ['#routing-team','#routing-area','#inv-team','#add-user-team','#routing-table'])nodes[id]={innerHTML:'',querySelectorAll:()=>[]};nodes['#routing-form']={elements:{businessType:business}};
  const ctx={api:async path=>path==='/admin/routing-rules'?{rules:[],businessTypes:['Sale','Rental','Off-plan']} :path==='/crm/teams'?{teams:[]}:{areas:[]},$:id=>nodes[id],esc:s=>s};
  vm.createContext(ctx);vm.runInContext(body,ctx);await ctx.loadRoutingRules();assert.match(business.innerHTML,/Rental/);assert.match(business.innerHTML,/Off-plan/);assert.equal(business.value,'Rental');
});

test('DEF-134 Admin options come from catalogue and maintained rules, not an operational access exception',async()=>{
  const source=read('src/routes/lead-operations.js'),start=source.indexOf("r.get('/admin/routing-rules',async(req,res)=>{"),end=source.indexOf('\n});',start),body=source.slice(start+"r.get('/admin/routing-rules',async(req,res)=>{".length,end);
  const response={json(value){this.body=value;},status(code){this.code=code;return this;}},catalogue={mappings:[{targetContext:'derived_transaction',targetValueCode:'sale'},{targetContext:'derived_transaction',targetValueCode:'rental'},{targetContext:'derived_transaction',targetValueCode:'other'}]};
  const ctx={res:response,req:{},operationalAdmin:()=>true,loadActiveClassificationCatalogue:async()=>catalogue,many:async()=>[{businessType:'Off-plan'},{businessType:'Commercial'}],legacyBusinessType:code=>code==='sale'?'Sale':code==='rental'?'Rental':'Unconfirmed'};
  await vm.runInNewContext('(async()=>{'+body+'})()',ctx);assert.deepEqual(Array.from(response.body.businessTypes),['Sale','Rental','Off-plan','Commercial']);
  ctx.operationalAdmin=()=>false;response.body=null;await vm.runInNewContext('(async()=>{'+body+'})()',ctx);assert.equal(response.code,403);assert.equal(response.body.error,'Admin access required');
});

test('DEF-137 issued Offer row includes revision, accepted marker, original and acceptance downloads',()=>{
  const source=read('public/app.js'),expression=source.slice(source.indexOf('const issuedRows=issued.map')+'const issuedRows='.length).split(';\n')[0].split(';\r\n')[0];
  const item={documentCode:'offer_letter',offerReference:'SYN-OF-001',revisionNumber:1,acceptedRevision:true,acceptanceOfferId:'synthetic-offer',documentVersionId:'original-version',pdfHash:'a'.repeat(64)};
  const html=vm.runInNewContext(expression,{issued:[item],esc:String,fmtDate:()=>''});assert.match(html,/Accepted revision/);assert.match(html,/original-version\/download/);assert.match(html,/synthetic-offer\/acceptance.pdf/);
});
