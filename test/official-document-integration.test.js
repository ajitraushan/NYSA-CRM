import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import {fileURLToPath}from'node:url';
import {
  evidenceFingerprint,evaluateOfficialDocumentRequirements,followupTaskPlan,validateDefinitionDraft,
  validateEvidenceReview,validateEvidenceSubmission,validateStepRuleDraft
}from'../src/official-document-integration-domain.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const now='2026-08-13T08:00:00.000Z',hash='a'.repeat(64);

test('definition and rule drafts reject arbitrary or incomplete configuration',()=>{
  assert.equal(validateDefinitionDraft({stableCode:'dld_contract_f',label:'Contract F',expectedIssuer:'Dubai REST',acceptedStatus:'official_captured'}).valid,true);
  assert.equal(validateDefinitionDraft({stableCode:'Bad Code',label:'x',expectedIssuer:'x',acceptedStatus:'accepted'}).valid,false);
  assert.equal(validateStepRuleDraft({stepCode:'transfer',definitionId:'definition-1',requirementLevel:'required',businessReason:'Transfer evidence'}).valid,true);
  assert.equal(validateStepRuleDraft({stepCode:'invented_step',definitionId:'definition-1',requirementLevel:'required',businessReason:'Transfer evidence'}).valid,false);
});

test('evidence validation requires exact case, context, idempotency and valid dates',()=>{
  const valid=validateEvidenceSubmission({definitionVersionId:'version-1',officialReference:'DLD-SYN-1',issuerReference:'DUBAI-REST-SYN',issuedAt:'2026-08-12T08:00:00.000Z',expiresAt:'2027-01-01T00:00:00.000Z',dealId:'deal-1',contextHash:hash,idempotencyKey:'submission-001'},now);
  assert.equal(valid.valid,true);assert.match(valid.requestFingerprint,/^[a-f0-9]{64}$/);
  assert.equal(validateEvidenceSubmission({...valid.value,idempotencyKey:'x',issuedAt:'2027-01-01T00:00:00.000Z'},now).valid,false);
});

test('review requires a terminal decision, confirmation and meaningful adverse reason',()=>{
  assert.equal(validateEvidenceReview({decision:'verified',reviewConfirmation:true}).valid,true);
  assert.equal(validateEvidenceReview({decision:'rejected',reason:'short',reviewConfirmation:true}).valid,false);
  assert.equal(validateEvidenceReview({decision:'returned',reason:'Wrong case association',reviewConfirmation:true}).valid,true);
});

test('required evidence fails closed while advisory evidence never blocks',()=>{
  const rules=[{ruleVersionId:'r1',definitionId:'d1',stepCode:'transfer',documentLabel:'Contract F',requirementLevel:'required',acceptedStatus:'official_captured'},{ruleVersionId:'r2',definitionId:'d2',stepCode:'transfer',documentLabel:'Optional note',requirementLevel:'advisory',acceptedStatus:'external_verified'}];
  let result=evaluateOfficialDocumentRequirements({rules,evidence:[],contextHash:hash,now});assert.equal(result.stepCanComplete,false);assert.equal(result.requirements[0].state,'missing');assert.equal(result.requirements[1].blocking,false);
  result=evaluateOfficialDocumentRequirements({rules,evidence:[{definitionId:'d1',evidenceReference:'E1',contextHash:hash,acceptedStatus:'official_captured',uploadedAt:now,review:{decision:'verified'}}],contextHash:hash,now});assert.equal(result.stepCanComplete,true);
  result=evaluateOfficialDocumentRequirements({rules,evidence:[{definitionId:'d1',evidenceReference:'E1',contextHash:'b'.repeat(64),acceptedStatus:'official_captured',uploadedAt:now,review:{decision:'verified'}}],contextHash:hash,now});assert.equal(result.requirements[0].state,'context_mismatch');
});

test('expired, pending and rejected evidence do not satisfy a required rule',()=>{
  const rule={ruleVersionId:'r1',definitionId:'d1',stepCode:'transfer',documentLabel:'e-NOC',requirementLevel:'required',acceptedStatus:'external_verified'},base={definitionId:'d1',evidenceReference:'E1',contextHash:hash,acceptedStatus:'external_verified',uploadedAt:now};
  assert.equal(evaluateOfficialDocumentRequirements({rules:[rule],evidence:[base],contextHash:hash,now}).requirements[0].state,'pending_verification');
  assert.equal(evaluateOfficialDocumentRequirements({rules:[rule],evidence:[{...base,review:{decision:'rejected'}}],contextHash:hash,now}).requirements[0].state,'rejected');
  assert.equal(evaluateOfficialDocumentRequirements({rules:[rule],evidence:[{...base,expiresAt:'2026-08-12T00:00:00.000Z',review:{decision:'verified'}}],contextHash:hash,now}).requirements[0].state,'expired');
});

test('fingerprints are stable and follow-up plans cannot verify evidence',()=>{
  assert.equal(evidenceFingerprint({b:2,a:1}),evidenceFingerprint({a:1,b:2}));
  const plan=followupTaskPlan({requirement:{documentLabel:'Contract F',stepCode:'transfer'},reason:'rejected',ownerId:'broker-1',now});assert.equal(plan.priority,'high');assert.match(plan.subject,/Official document follow-up/);assert.doesNotMatch(JSON.stringify(plan),/verified|official_captured/);
});

test('migration is additive, immutable and contains no external or portal capability',()=>{
  const sql=read('src/migrations/086_release4_official_document_evidence.sql');
  for(const marker of ['official_document_definitions','official_document_definition_versions','official_document_step_rule_versions','official_document_evidence_versions','official_document_evidence_review_events','official_document_followup_task_links','document_versions(id)','prevent_release2_immutable_evidence_mutation','OfficialDocumentEvidence'])assert.match(sql,new RegExp(marker.replace(/[()]/g,'\\$&')));
  assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM|property_finder|recipient|phone|email/i);
});

test('routes reuse private Documents, enforce separation and create existing CRM Tasks',()=>{
  const source=read('src/routes/official-document-evidence.js');
  for(const marker of ["savePrivate(file.buffer","removePrivate(key)","INSERT INTO documents","INSERT INTO document_versions","INSERT INTO document_links","uploadedBy===req.broker.id","official_document_evidence_review_events","INSERT INTO tasks","pg_advisory_xact_lock","idempotency_key","contextHash"] )assert.match(source,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(source,/Property Finder|sendBeacon|WebSocket|recipient|ownerPhone|ownerEmail/i);
});

test('server mounts the official document evidence API',()=>{assert.match(read('src/server.js'),/officialDocumentEvidenceRoutes/);});

test('Deal UI exposes controlled evidence, exact PDF review and existing Task follow-up',()=>{
  const ui=read('public/official-document-ui.js'),deal=read('public/deal-ui.js'),bootstrap=read('public/bootstrap.js'),html=read('public/index.html');
  for(const marker of ['CONTROLLED EXTERNAL EVIDENCE','CORE does not generate or submit official forms','Upload official PDF evidence','Independent evidence review','Review exact PDF','Create or reuse follow-up Task','reviewConfirmation','idempotencyKey'])assert.match(ui,new RegExp(marker,'i'));
  assert.match(deal,/officialDocumentWorkspaceHTML/);assert.match(deal,/bindOfficialDocumentWorkspace/);assert.match(bootstrap,/official-document-ui\.js/);assert.match(html,/official-document-workspace/);
  assert.doesNotMatch(ui,/Property Finder|recipient|ownerPhone|ownerEmail|authorityName/i);
});

test('real CRM Admin can choose Required or Advisory and Inventory consumes the active external-listing rule',()=>{
  const app=read('public/app.js'),ui=read('public/official-document-ui.js'),html=read('public/index.html');
  for(const marker of ['official-document-definition-form','official-document-rule-form','Required — mandatory for this step','Advisory — visible, non-blocking','loadOfficialDocumentAdministration','data-activate-official-rule','data-retire-official-rule'])assert.match(app,new RegExp(marker,'i'));
  for(const marker of ['officialDocumentInventoryWorkspaceHTML','bindOfficialDocumentInventoryWorkspace','external_listing','never blocks ordinary Internal Inventory maintenance','data-inventory-official-upload'])assert.match(ui,new RegExp(marker,'i'));
  assert.match(app,/officialDocumentInventoryWorkspaceHTML/);assert.match(app,/bindOfficialDocumentInventoryWorkspace/);assert.match(html,/official-document-admin-grid/);
});

test('full Admin configuration needs no maker-checker while uploaded evidence retains independent review',()=>{
  const routes=read('src/routes/official-document-evidence.js'),migration=read('src/migrations/086_release4_official_document_evidence.sql');
  assert.doesNotMatch(routes,/draft creator cannot activate this (?:version|rule)|version creator cannot retire|rule creator cannot retire/i);
  assert.doesNotMatch(migration,/approved_by\s*<>\s*created_by/);
  assert.match(routes,/evidence\.uploadedBy===req\.broker\.id/);
  assert.match(routes,/The evidence uploader cannot review their own submission/);
});
