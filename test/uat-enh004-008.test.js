import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {viewingReadiness,VIEWING_NEXT_DECISIONS} from '../src/viewing-readiness.js';
import {validateViewingOutcome} from '../src/matching-viewing-domain.js';
import {validateBookingCreate,validateBookingTransition,validateBookingExtension} from '../src/booking-domain.js';
import {BEDROOMS,normalizeBulkUnits} from '../src/inventory-domain.js';
import {buildMatchEvidence} from '../src/ai-domain.js';
import {scoreInventoryCandidateV2} from '../src/inventory-eligibility-domain.js';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const context=()=>{const c={esc:x=>String(x??'').replaceAll('<','&lt;'),fmtDate:x=>String(x),fmtPrice:(x,c)=>`${c} ${x}`,offerTypeLabels:{purchase:'Purchase'},Set,Date,Intl,LISTING_WORKFLOW_LABELS:{draft:'Draft',approved:'Approved',changes_requested:'Changes requested'},handoverLabel:()=> 'Ready',canEditListing:()=>false};vm.createContext(c);vm.runInContext(read('public/offer-ui.js'),c);return c;};
const completed=(decision,updatedAt='2026-10-25T10:00:00Z')=>({id:'v1',propertyMatchId:'m1',status:'completed',feedback:'Customer feedback',customerNextDecision:decision,updatedAt});

test('ENH-005 exact fractional Inventory values survive bulk normalization and matching',()=>{
 for(const value of ['Studio','1','1.5','2','2.5','3','4','5+'])assert.ok(BEDROOMS.includes(value));
 const rows=['1.5','2.5'].map((bedrooms,i)=>({unitReference:'SYN-'+i,propertyType:'Apartment',bedrooms,sizeSqft:1000,price:1000000}));
 assert.deepEqual(normalizeBulkUnits('Bulk deal',rows).units.map(x=>x.bedrooms),['1.5','2.5']);
 for(const bedrooms of ['1.5','2.5']){
  const evidence=buildMatchEvidence({bedroomsMin:Number(bedrooms),bedroomsMax:Number(bedrooms)},{bedrooms,effectiveStatus:'Available'});
  assert.equal(evidence.failed.filter(x=>/bedrooms/.test(x.criterion)).length,0);
  const less=buildMatchEvidence({bedroomsMin:Number(bedrooms)+0.5},{bedrooms,effectiveStatus:'Available'});
  assert.ok(less.failed.some(x=>x.criterion==='Minimum bedrooms'));
  const score=scoreInventoryCandidateV2({bedroomsMin:Number(bedrooms),bedroomsMax:Number(bedrooms)},{bedrooms});
  assert.equal(score.criteria.find(x=>x.code==='bedrooms').state,'met');
 }
});

test('ENH-006 new completions require explicit decision and cancellation requires reason',()=>{
 const body={status:'completed',outcome:'positive',feedback:'Would like more',followUpAction:'Schedule follow-up',followUpDueAt:'2099-01-01',expectedVersion:1};
 assert.match(validateViewingOutcome(body).error,/next decision/);
 for(const decision of VIEWING_NEXT_DECISIONS)assert.equal(validateViewingOutcome({...body,customerNextDecision:decision}).value.customerNextDecision,decision);
 assert.match(validateViewingOutcome({...body,customerNextDecision:'made_up'}).error,/next decision/);
 assert.match(validateViewingOutcome({status:'cancelled',expectedVersion:1}).error,/reason/);
 assert.equal(validateViewingOutcome({status:'cancelled',outcome:'Customer cancelled',expectedVersion:1}).value.followUpDueAt,null);
});

test('ENH-006 browser/server readiness parity includes legacy, exact property, pending and latest decision',()=>{
 const c=context(),sets=[[],[completed(null)],[completed('ready_for_offer')],[completed('more_viewings_required')],[completed('undecided')],[completed('not_proceeding')],[completed('ready_for_offer'),{status:'scheduled'}],[completed('ready_for_offer'),completed('more_viewings_required','2026-10-25T11:00:00Z')],[completed('more_viewings_required'),completed('ready_for_offer','2026-10-25T11:00:00Z')],[completed('ready_for_offer'),{status:'cancelled',outcome:'Cancelled with reason'}]];
 for(const rows of sets)assert.deepEqual(JSON.parse(JSON.stringify(c.viewingReadiness(rows))),viewingReadiness(rows));
 assert.equal(viewingReadiness([completed(null)]).ready,true,'Approved historical eligibility retained');
 assert.equal(viewingReadiness([completed('ready_for_offer'),{status:'scheduled'}]).ready,false);
 assert.equal(viewingReadiness([completed('more_viewings_required')]).ready,false);
});

test('ENH-006 unrelated pending appointment does not hide ready property in Offer UI',()=>{
 const c=context(),base={opportunity:{customerObjective:'buy'},offers:[],matches:[{id:'m1',externalPropertyId:'e1',externalStatus:'approved_for_opportunity',project:'Synthetic property'}],inventoryAssignments:[],writable:true};
 const ready=c.offerWorkspaceHTML({...base,viewings:[completed('ready_for_offer'),{status:'scheduled',propertyMatchId:'m2'}]});
 assert.match(ready,/id="offer-create-form"/);
 const blocked=c.offerWorkspaceHTML({...base,viewings:[completed('ready_for_offer'),{status:'scheduled',propertyMatchId:'m1'}]});
 assert.doesNotMatch(blocked,/id="offer-create-form"/);
 for(const decision of ['more_viewings_required','undecided','not_proceeding'])assert.doesNotMatch(c.offerWorkspaceHTML({...base,viewings:[completed(decision)]}),/id="offer-create-form"/);
});

test('ENH-007 confirmation has no file dependency; legacy evidence remains downloadable',()=>{
 const c=context(),base={opportunity:{},offers:[{id:'o1',status:'accepted',acceptedRevisionId:'r1',listingStatus:'Available',revisions:[{id:'r1',revisionNumber:1,currency:'AED',depositAmount:12000}]}],bookings:[],writable:true};
 const html=c.bookingWorkspaceHTML(base);assert.match(html,/Confirm seven-day reservation/);assert.doesNotMatch(html,/name="evidence"|disabled>Create/);
 const booking={id:'b1',status:'released',refundableState:'refundable',evidenceDocumentVersionId:'legacy-file',evidenceFileName:'legacy.pdf',history:[]};
 assert.match(c.bookingWorkspaceHTML({...base,offers:[],bookings:[booking]}),/Download exact evidence/);
 assert.doesNotMatch(c.bookingWorkspaceHTML({...base,offers:[],bookings:[{...booking,evidenceDocumentVersionId:null}]}),/Download exact evidence/);
 const now=new Date('2026-10-25T10:00:00Z'),created=validateBookingCreate({refundableState:'refundable',expiresAt:'2099-01-01'},now).value;
 assert.equal(created.expiresAt,'2026-11-01T10:00:00.000Z');
 assert.ok(validateBookingTransition('reserved',{toStatus:'released'}).error);
 assert.ok(validateBookingExtension({status:'reserved',reservationStartsAt:now,expiresAt:created.expiresAt},{expiresAt:'2026-11-10',reason:'Valid longer reason'},now).error);
});

test('ENH-007 submit sends evidence-free confirmation through existing endpoint',async()=>{
 const c=context(),listeners={},calls=[],output={},form={elements:{offerId:{selectedOptions:[{dataset:{deposit:'12000',currency:'AED'}}],addEventListener(){}}},querySelector:()=>output,addEventListener:(event,fn)=>listeners[event]=fn};
 Object.assign(c,{$:()=>form,FormData:class{constructor(){return new Map([['offerId','offer-1'],['refundableState','refundable']]);}},api:async(path,options)=>calls.push({path,...options}),toast(){}});
 c.bindBookingWorkspace({querySelectorAll:()=>[],refreshOpportunity(){}},{onChanged(){}});
 await listeners.submit({preventDefault(){},target:form});assert.equal(calls.length,1);assert.equal(calls[0].path,'/crm/offers/offer-1/bookings');assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body)),{offerId:'offer-1',refundableState:'refundable'});
});

test('ENH-004/007 cards distinguish workflow and show actual confirming Agent in Dubai time',()=>{
 const c=context(),source=read('public/app.js'),a=source.indexOf('function reservationDubaiDate'),b=source.indexOf('/* ============ DETAIL',a);vm.runInContext(source.slice(a,b),c);
 const base={id:'synthetic',status:'Available',workflowStatus:'draft',verificationStatus:'unverified',propertyType:'Apartment',inventoryHeadline:'Synthetic home',bedrooms:'2.5',currency:'AED',price:1000000};
 assert.match(c.cardHTML(base),/Current status: Draft/);assert.match(c.cardHTML({...base,verificationStatus:'pending'}),/Current status: Pending verification/);
 assert.match(c.cardHTML({...base,workflowStatus:'approved',verificationStatus:'verified'}),/Current status: Approved/);
 const reserved=c.cardHTML({...base,status:'Reserved',activeBookingReference:'SYN-BK',activeBookingAgentName:'Confirming Agent',postedByName:'Listing maintainer',activeBookingStartsAt:'2026-10-25T10:00:00Z',activeBookingExpiresAt:'2026-11-01T10:00:00Z'});
 assert.match(reserved,/Reserved by Confirming Agent/);assert.match(reserved,/14:00 Dubai/);assert.match(reserved,/Listed by Listing maintainer/);assert.match(reserved,/2.5 BR/);
 assert.doesNotMatch(c.cardHTML({...base,activeBookingReference:'expired'}),/Reserved by/);
});

test('ENH-008 readable summary uses linked property/customer and retains immutable reference',()=>{
 const server=read('src/routes/document-compliance.js'),ui=read('public/document-compliance-ui.js');
 assert.match(server,/COALESCE\(li\.inventory_headline,li\.project,ep\.project_or_building,o\.title\) AS property_description/);
 assert.match(server,/customerName:deal.customerName/);assert.match(ui,/Deal: \$\{safe\(data\.deal\.propertyDescription/);assert.match(ui,/Reference: \$\{safe\(data\.deal\.dealReference/);
});

test('ENH-005 Lead/Customer fractional inputs, reviewed suggestions and import validation agree',()=>{
 const app=read('public/app.js'),api=read('src/routes/lead-operations.js'),ai=read('src/ai-service.js'),intake=read('src/purchased-data-import.js');
 assert.match(app,/\['bedroomsMin','Bedrooms minimum','any'\],\['bedroomsMax','Bedrooms maximum','any'\]/);
 assert.match(app,/name="bedroomsMin" type="number" min="0" step="any"/);assert.match(app,/name="bedroomsMax" type="number" min="0" step="any"/);
 assert.match(app,/currentRequirement\?\.\[name\]\?\?''/);
 assert.match(api,/bedroomsMax cannot be below bedroomsMin/);assert.match(api,/Number\.isFinite\(value\)/);
 assert.match(ai,/bedroomsMin:nullableNumber,bedroomsMax:nullableNumber/);assert.match(intake,/Minimum bedrooms must be a non-negative number/);
});
