import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('migration 090 is additive and contains no activated legal requirement seeds',()=>{const sql=read('src/migrations/090_release6_customer_transaction_document_compliance.sql');for(const marker of ['document_compliance_requirements','document_compliance_requirement_versions','deal_document_compliance_snapshots','deal_document_requirement_instances','document_compliance_evidence_versions','document_compliance_evidence_review_events','document_compliance_official_evidence_links','document_compliance_followup_task_links'])assert.match(sql,new RegExp(marker));assert.doesNotMatch(sql,/INSERT INTO document_compliance_requirements/i);assert.match(sql,/090_release6_customer_transaction_document_compliance\.sql/);});

test('migration freezes exact role kind gate and evidence authority',()=>{const sql=read('src/migrations/090_release6_customer_transaction_document_compliance.sql');for(const marker of ["party_role IN('buyer','seller','landlord','tenant')","party_kind IN('individual','organization')","before_pending_approval","before_approval","before_close_won","generic_document","official_document"])assert.match(sql,new RegExp(marker.replace(/[()]/g,'\\$&')));});

test('migration reuses existing tasks and protects immutable evidence',()=>{const sql=read('src/migrations/090_release6_customer_transaction_document_compliance.sql');assert.match(sql,/document_compliance_follow_up/);assert.match(sql,/document_compliance_task_links_immutable/);assert.match(sql,/document_compliance_reviews_immutable/);assert.match(sql,/REFERENCES tasks\(id\)/);});

test('server mounts authenticated document compliance routes',()=>{const server=read('src/server.js'),routes=read('src/routes/document-compliance.js');assert.match(server,/documentComplianceRoutes/);assert.match(routes,/r\.use\(requireAuth/);assert.match(routes,/hasInternalCrmIdentity/);});

test('Admin is direct while Admin Assistant remains draft only',()=>{const routes=read('src/routes/document-compliance.js');assert.match(routes,/fullAdmin\(req\.broker\).*activation required/);assert.match(routes,/configReader\(req\.broker\)/);assert.match(routes,/adminDirect/);});

test('API provides matrix resolve Deal customer evidence review official link and Task operations',()=>{const routes=read('src/routes/document-compliance.js');for(const endpoint of ['/admin/document-compliance/requirements','/crm/deals/:dealId/document-compliance/resolve','/crm/deals/:dealId/document-compliance','/crm/customers/:customerId/document-compliance','/crm/document-compliance/instances/:instanceId/evidence','/crm/document-compliance/instances/:instanceId/official-evidence-link','/crm/document-compliance/evidence/:evidenceId/review','/crm/document-compliance/instances/:instanceId/follow-up-task'])assert.ok(routes.includes(endpoint),endpoint);});

test('generic upload is private atomic and cleans stored content on failure',()=>{const routes=read('src/routes/document-compliance.js');assert.match(routes,/savePrivate/);assert.match(routes,/removePrivate/);assert.match(routes,/'restricted'/);assert.match(routes,/document_compliance_evidence_versions/);assert.match(routes,/idempotency_key/);});

test('Release 4 evidence is linked without copying issuer or official metadata',()=>{const sql=read('src/migrations/090_release6_customer_transaction_document_compliance.sql'),routes=read('src/routes/document-compliance.js');assert.match(sql,/official_evidence_id UUID NOT NULL REFERENCES official_document_evidence_versions/);assert.doesNotMatch(sql,/document_compliance_official_evidence_links[\s\S]{0,500}(issuer_reference|official_reference)/);assert.match(routes,/exact frozen definition version/);});

test('Deal approval and Close Won call exact document compliance gates',()=>{const routes=read('src/routes/opportunities.js');assert.match(routes,/before_pending_approval/);assert.match(routes,/before_approval/);assert.match(routes,/before_close_won/);assert.match(routes,/Required document compliance is incomplete/);});

test('restricted file reads enforce compliance Deal scope',()=>{const files=read('src/routes/files-proposals.js');assert.match(files,/document_compliance_evidence_versions/);assert.match(files,/document_compliance_official_evidence_links/);assert.match(files,/canReadOpportunity\(req\.broker,item\)/);});

test('UI combines existing Deal checklist with compliance and supports Admin customer and Task views',()=>{const deal=read('public/deal-ui.js'),app=read('public/app.js'),ui=read('public/document-compliance-ui.js'),bootstrap=read('public/bootstrap.js');assert.match(deal,/documentComplianceWorkspaceHTML/);assert.match(deal,/bindDocumentComplianceWorkspace/);assert.match(app,/documentComplianceAdminHTML/);assert.match(app,/openCustomerDocumentCompliance/);assert.match(ui,/My Task Queue/);assert.match(ui,/Activate directly/);assert.match(bootstrap,/document-compliance-ui\.js/);});

test('Task and API copy prohibit private content and external capabilities',()=>{const sources=[read('src/document-compliance-domain.js'),read('src/routes/document-compliance.js'),read('public/document-compliance-ui.js')].join('\n');for(const prohibited of ['Property Finder','ownerPhone','ownerEmail','passportNumber','storageKey:','fetch(','XMLHttpRequest','WebSocket','sendBeacon'])assert.doesNotMatch(sources,new RegExp(prohibited.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));});
