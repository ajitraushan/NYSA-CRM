import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  RELEASE3C_POLICY_VERSION,deriveTransactionalSharePolicy,prepareGovernedResponseEvidence,release3cEvidenceHash,
  validateGovernedShareCancellation,validateGovernedSharePrepareRequest,validateGovernedShareReportQuery
} from '../src/release3c-crm-integration-domain.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const actor='00000000-0000-0000-0000-000000000001',contactId='00000000-0000-0000-0000-000000000002',opportunityId='00000000-0000-0000-0000-000000000003';
const policyBase={actorAuthorized:true,actorRef:actor,evaluatedAt:'2026-08-13T08:00:00.000Z',
  channel:{id:'channel-1',channelKind:'Phone',whatsappEnabled:1,verificationStatus:'verified',restrictionStatus:'allowed'},
  agreement:{id:'agreement-1',status:'executed',consentScope:['transactional_share'],permittedChannels:['WhatsApp'],effectiveAt:'2026-08-01T00:00:00Z',expiresAt:'2026-09-01T00:00:00Z'},
  contact:{id:contactId,lifecycleStatus:'active',doNotContact:0,archivedAt:null},opportunity:{id:opportunityId,contactId,stage:'Matching'}};

test('prepare request requires optimistic version, broker confirmation and one-to-six exact selection triples',()=>{
  const valid=validateGovernedSharePrepareRequest({expectedOpportunityVersion:2,title:'Customer selection',brokerReviewConfirmed:true,selections:[
    {propertyMatchId:'match-1',matchingCandidateId:'candidate-1',matchDecisionId:'decision-1'}]});
  assert.equal(valid.value.selections.length,1);
  assert.match(validateGovernedSharePrepareRequest({...valid.value,brokerReviewConfirmed:false}).error,/confirmed/);
  assert.match(validateGovernedSharePrepareRequest({...valid.value,selections:[]}).error,/between one and 6/);
  assert.match(validateGovernedSharePrepareRequest({...valid.value,selections:Array.from({length:7},(_,i)=>({propertyMatchId:`m${i}`,matchingCandidateId:`c${i}`,matchDecisionId:`d${i}`}))}).error,/between one and 6/);
});

test('prepare request rejects duplicate identity at every authoritative selection layer',()=>{
  const rows=[{propertyMatchId:'m1',matchingCandidateId:'c1',matchDecisionId:'d1'},{propertyMatchId:'m2',matchingCandidateId:'c1',matchDecisionId:'d2'}];
  assert.match(validateGovernedSharePrepareRequest({expectedOpportunityVersion:1,title:'Selection',brokerReviewConfirmed:true,selections:rows}).error,/matchingCandidateId/);
});

test('communication policy is server-derived, allowed and bound to fifteen minutes',()=>{
  const result=deriveTransactionalSharePolicy(policyBase);assert.equal(result.value.outcome,'allowed');
  assert.equal(result.value.policyVersion,RELEASE3C_POLICY_VERSION);assert.equal(result.value.validUntil,'2026-08-13T08:15:00.000Z');
  assert.match(result.value.evidenceHash,/^[a-f0-9]{64}$/);assert.deepEqual(result.value.reasonCodes,[]);
});

test('communication policy fails closed for every missing authoritative control',()=>{
  const cases=[
    {...policyBase,actorAuthorized:false},
    {...policyBase,channel:{...policyBase.channel,restrictionStatus:'do_not_contact'}},
    {...policyBase,agreement:null},
    {...policyBase,contact:{...policyBase.contact,doNotContact:1}},
    {...policyBase,opportunity:{...policyBase.opportunity,stage:'Closed Won'}}
  ];
  for(const input of cases){const result=deriveTransactionalSharePolicy(input);assert.equal(result.value.outcome,'denied');assert.ok(result.value.reasonCodes.length);}
});

test('policy decision exposes references and checks but no contact channel value',()=>{
  const value=deriveTransactionalSharePolicy({...policyBase,channel:{...policyBase.channel,rawValue:'private',normalizedValue:'private'}}).value;
  assert.equal('rawValue' in value,false);assert.equal('normalizedValue' in value,false);assert.equal('phone' in value,false);
});

const responseBase={shortlistEvidenceHash:'a'.repeat(64),shareItemId:'share-item-1',propertyReference:'NYSA-SYN-1',recordedBy:actor,preparedAt:'2026-08-13T08:00:00Z',now:'2026-08-13T09:00:00Z'};
test('all standard responses map to the approved authoritative Task subject, priority and due time',()=>{
  const expectations={interested:['Follow up on customer interest','high',4],viewing_requested:['Coordinate property viewing','urgent',2],
    information_required:['Prepare requested property information','high',4],more_options:['Review requirement and prepare more options','normal',8]};
  for(const [outcome,[subject,priority,hours]] of Object.entries(expectations)){const result=prepareGovernedResponseEvidence({...responseBase,body:{outcome,notes:'Recorded customer response',occurredAt:'2026-08-13T08:15:00Z'}});
    assert.equal(result.value.task.subject,subject);assert.equal(result.value.task.priority,priority);assert.equal(result.value.task.dueAt,new Date(Date.parse('2026-08-13T08:15:00Z')+hours*3600000).toISOString());}
});

test('not-suitable property-only response leaves requirement unchanged and creates normal follow-up',()=>{
  const result=prepareGovernedResponseEvidence({...responseBase,body:{outcome:'not_suitable',notes:'Property-specific layout issue',occurredAt:'2026-08-13T08:15:00Z',
    rejectionReason:'layout_or_size',preferenceImpact:'property_only'}});assert.equal(result.value.task.subject,'Record property feedback and continue matching');assert.equal(result.value.task.priority,'normal');
});

test('possible and confirmed preference changes produce review/version Tasks without automatic changes',()=>{
  const possible=prepareGovernedResponseEvidence({...responseBase,body:{outcome:'not_suitable',notes:'Review requested',occurredAt:'2026-08-13T08:15:00Z',rejectionReason:'price_or_budget',preferenceImpact:'review_required',preferenceChangeDetail:'Review the budget range'}}),
    confirmed=prepareGovernedResponseEvidence({...responseBase,body:{outcome:'not_suitable',notes:'Change confirmed',occurredAt:'2026-08-13T08:15:00Z',rejectionReason:'location_or_community',preferenceImpact:'confirmed_change',preferenceChangeDetail:'Customer confirmed a different area'}});
  assert.equal(possible.value.task.subject,'Review possible preference change');assert.equal(confirmed.value.task.subject,'Prepare a new governed requirement version');
});

test('response evidence is deterministic and rejects pre-package or invalid controlled evidence',()=>{
  const body={outcome:'interested',notes:'Recorded interest',occurredAt:'2026-08-13T08:15:00Z'},first=prepareGovernedResponseEvidence({...responseBase,body}),second=prepareGovernedResponseEvidence({...responseBase,body});
  assert.equal(first.value.response.evidenceHash,second.value.response.evidenceHash);assert.match(first.value.response.evidenceHash,/^[a-f0-9]{64}$/);
  assert.match(prepareGovernedResponseEvidence({...responseBase,body:{...body,occurredAt:'2026-08-13T07:59:00Z'}}).error,/before package/);
  assert.match(prepareGovernedResponseEvidence({...responseBase,body:{outcome:'unknown',notes:'Invalid',occurredAt:'2026-08-13T08:15:00Z'}}).error,/controlled/);
});

test('canonical evidence hash is key-order stable',()=>{assert.equal(release3cEvidenceHash({a:1,b:{c:2}}),release3cEvidenceHash({b:{c:2},a:1}));});

test('cancellation and report range validation preserve controlled boundaries',()=>{
  assert.equal(validateGovernedShareCancellation({expectedVersion:1,reason:'Broker withdrew this prepared selection'}).value.expectedVersion,1);
  assert.match(validateGovernedShareCancellation({expectedVersion:1,reason:'short'}).error,/between 10 and 500/);
  assert.equal(validateGovernedShareReportQuery({from:'2026-08-01',to:'2026-08-13'}).value.ownerId,null);
  assert.match(validateGovernedShareReportQuery({from:'2026-01-01',to:'2026-08-13'}).error,/93 days/);
});

test('migration reuses authoritative share, feedback and Task records with immutable provenance',()=>{
  const sql=read('src/migrations/085_release3c_governed_share_response.sql');
  for(const marker of ['CREATE TABLE communication_policy_decisions','ALTER TABLE opportunity_property_shares','request_fingerprint','ALTER TABLE opportunity_property_share_items',
    'CREATE TABLE opportunity_property_share_events','ALTER TABLE inventory_match_feedback','customer_response_follow_up','CREATE TABLE customer_response_task_provenance',
    'prevent_release2_immutable_evidence_mutation','prevent_governed_property_share_fact_mutation'])assert.match(sql,new RegExp(marker));
  assert.doesNotMatch(sql,/CREATE TABLE opportunity_property_responses/);assert.doesNotMatch(sql,/INSERT INTO schema_migrations/);
});

test('migration governed shape prohibits recipient and public-token values',()=>{
  const sql=read('src/migrations/085_release3c_governed_share_response.sql');
  for(const marker of ['recipient_phone IS NULL','recipient_name IS NULL','customer_message IS NULL','public_token_hash IS NULL','public_expires_at IS NULL'])assert.match(sql,new RegExp(marker));
});

test('routes enforce scope, Internal Inventory, current decisions, idempotency and one Task transaction',()=>{
  const route=read('src/routes/release3c-governed-shares.js');
  for(const marker of ['canWriteOpportunity','canReadOpportunity','externalPropertyId','latest','requestFingerprint','FOR UPDATE OF pm,c,d,l',
    'inventory_match_feedback','customer_response_task_provenance','customer_response_follow_up','responsible_agent_unavailable','automaticViewing:false',
    'changesOpportunityStage:false','changesInventory:false'])assert.match(route,new RegExp(marker));
});

test('read-only UI options expose the exact current match candidate and decision chain',()=>{
  const route=read('src/routes/release3c-governed-shares.js');
  for(const marker of ['governed-property-share-options','DISTINCT ON(pm.id)','matching_candidate_id','match_decision_id','JOIN LATERAL','internalInventoryOnly:true','preparedNotSentOnly:true'])assert.ok(route.includes(marker),`missing ${marker}`);
});

test('routes derive policy from CRM state and never accept recipient or provider data',()=>{
  const route=read('src/routes/release3c-governed-shares.js');
  for(const marker of ['contact_channels','marketing_agreements','deriveTransactionalSharePolicy','policy_denied','connectorEnabled:false'])assert.match(route,new RegExp(marker));
  for(const prohibited of ['req.body.recipient','req.body.phone','req.body.publicToken','fetch(','XMLHttpRequest','WebSocket','property-finder'])assert.doesNotMatch(route,new RegExp(prohibited.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});

test('reporting exposes exact unavailable connected states and no free-text response notes',()=>{
  const route=read('src/routes/release3c-governed-shares.js'),report=route.slice(route.indexOf("r.get('/crm/reports/governed-property-shares"));
  assert.match(report,/shared:'unavailable'/);assert.match(report,/delivered:'unavailable'/);assert.match(report,/opened:'unavailable'/);assert.match(report,/isManager/);assert.doesNotMatch(report,/f\.notes/);
});

test('server mounts the Release 3C integration without replacing legacy Opportunity routes',()=>{
  const server=read('src/server.js');assert.match(server,/release3cGovernedShareRoutes/);assert.match(server,/opportunityRoutes/);
});

test('Opportunity UI clearly separates governed prepared-not-sent work from the legacy launcher',()=>{
  const ui=read('public/app.js');
  for(const marker of ['Governed customer selection','PREPARED — NOT SENT','Prepare — do not send','No delivery has occurred','Legacy WhatsApp launcher and history'])assert.match(ui,new RegExp(marker));
  assert.match(ui,/governed-property-share-options/);assert.match(ui,/governed-property-shares/);
});

test('Opportunity UI supports controlled property responses and displays the one governing Task',()=>{
  const ui=read('public/app.js');
  for(const marker of ['Record customer response','One response creates one CRM Task','Record response and create Task','viewing_requested','information_required','preferenceImpact','Task:'])assert.match(ui,new RegExp(marker));
  assert.match(ui,/automatic|does not create a viewing/i);
});

test('governed UI contains no send, public-link, recipient or provider control',()=>{
  const ui=read('public/app.js'),start=ui.indexOf("const governedShareSection="),end=ui.indexOf("const inventorySelectionSection=",start),block=ui.slice(start,end);
  assert.ok(start>0&&end>start);for(const prohibited of ['window.open','wa.me','recipientPhone','recipientName','publicToken','providerKey','Send now'])assert.doesNotMatch(block,new RegExp(prohibited.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});
