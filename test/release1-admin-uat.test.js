import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('Release 1 and 1.1 migrations remain sequential and include governed inventory and area controls',()=>{
  const migrations=readdirSync(join(root,'src','migrations')).filter(x=>x.endsWith('.sql')).sort();
  assert.deepEqual(migrations.slice(-27),['011_organization_profile_governance.sql','012_release1_admin_uat_corrections.sql','013_customer_proposal_address.sql','014_customer_kyc_summary.sql','015_inventory_business_reference.sql','016_ai_assistance_runs.sql','017_operational_qualification_questionnaire.sql','018_team_queue_only_lead_intake.sql','019_ai_assistance_audit_constraint.sql','020_proposal_business_numbers.sql','021_password_reset_requests.sql','022_proposal_changes_requested.sql','023_proposal_correction_tasks.sql','024_team_reporting_lines.sql','025_manager_director_reporting.sql','026_routing_rule_governance.sql','027_inventory_commercial_readiness.sql','028_governed_areas_and_routing.sql','029_listing_executive_workflow.sql','030_property_media_governance.sql','031_orphaned_property_media_approval.sql','032_listing_location_and_bulk_deals.sql','033_property_media_approval_policy.sql','034_property_media_policy_audit.sql','035_listing_approval_policy.sql','036_provider_neutral_listing_intake.sql','037_listing_mapping_governance.sql']);
  assert.match(read('src/migrations/015_inventory_business_reference.sql'),/inventory_reference/);
  assert.match(read('src/migrations/017_operational_qualification_questionnaire.sql'),/Unassessed/);
  assert.match(read('src/migrations/019_ai_assistance_audit_constraint.sql'),/'AiAssistanceRun'/);
  assert.match(read('src/migrations/020_proposal_business_numbers.sql'),/NYSA-PR-/);
  assert.match(read('src/migrations/023_proposal_correction_tasks.sql'),/proposal_correction/);
  assert.match(read('src/migrations/024_team_reporting_lines.sql'),/team_memberships_one_active_manager_uq/);
  assert.match(read('src/migrations/025_manager_director_reporting.sql'),/reports_to_id/);
  assert.match(read('src/migrations/026_routing_rule_governance.sql'),/routing_rules_active_match_uq/);
  assert.match(read('src/migrations/027_inventory_commercial_readiness.sql'),/handover_status/);
  assert.match(read('src/migrations/028_governed_areas_and_routing.sql'),/primary_routing_area_id/);
  assert.match(read('src/migrations/029_listing_executive_workflow.sql'),/workflow_status/);
  assert.match(read('src/migrations/032_listing_location_and_bulk_deals.sql'),/CREATE TABLE listing_units/);
  assert.match(read('src/migrations/035_listing_approval_policy.sql'),/ListingApprovalPolicy/);
  assert.match(read('src/migrations/036_provider_neutral_listing_intake.sql'),/listing_intake_events/);
  assert.match(read('src/migrations/037_listing_mapping_governance.sql'),/listing_mapping_versions/);
  const sql=read('src/migrations/012_release1_admin_uat_corrections.sql');
  for(const contract of ['controlled_value_consumers','queue_cycle_no','user_role_assignments','pending_activation','admin_assistant','approval_reason'])assert.match(sql,new RegExp(contract));
  for(const column of ['exception_threshold','threshold_direction','benchmark_source'])assert.match(sql,new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
});

test('password recovery is private administrator-governed and revokes existing sessions',()=>{
  const auth=read('src/routes/auth.js'),admin=read('src/routes/admin.js'),ui=read('public/app.js'),migration=read('src/migrations/021_password_reset_requests.sql');
  assert.match(ui,/Forgot password\?/);assert.match(ui,/Confirm new password/);assert.match(ui,/Password reset requests/);
  assert.match(auth,/RESET_RESPONSE/);assert.match(auth,/password-reset-requests/);assert.match(auth,/password-resets\/redeem/);
  assert.match(auth,/DELETE FROM sessions WHERE broker_id=\$1/);assert.match(auth,/Reset code is invalid or expired/);
  assert.match(admin,/Administrator access required/);assert.match(admin,/code_hash/);assert.match(admin,/INTERVAL '30 minutes'/);
  assert.match(migration,/password_reset_requests_one_open_uq/);assert.match(migration,/code_hash CHAR\(64\)/);
});

test('assignment queue supports scoped visibility atomic claim and repeat-cycle deadlines',()=>{
  const source=read('src/routes/lead-operations.js'),crm=read('src/routes/crm.js'),website=read('src/routes/website-intake.js'),ui=read('public/app.js'),migration=read('src/migrations/018_team_queue_only_lead_intake.sql');
  assert.match(source,/\/crm\/assignment-queue/);
  assert.match(source,/FOR UPDATE/);
  assert.match(source,/self_claimed/);
  assert.match(source,/queue_cycle_no=queue_cycle_no\+1/);
  assert.match(source,/first_contact_due_at=\$4,accepted_at=NULL,first_contact_at=NULL/);
  assert.match(source,/self-claim is available only after SLA recycling/);
  assert.ok(source.indexOf("selfClaim&&lead.assignmentStatus!=='reassignment_due'")<source.indexOf("if(!agentId||!teamId)"),'new-lead self-claim denial must precede team eligibility validation');
  assert.match(crm,/New leads must enter an unassigned team queue/);
  assert.doesNotMatch(crm,/rule\?\.agentId/);
  assert.doesNotMatch(website,/rule\?\.agentId/);
  assert.doesNotMatch(ui,/Assign broker/);
  assert.doesNotMatch(ui,/Named agent \(optional\)/);
  assert.doesNotMatch(crm,/\/crm\/leads\/:id\/claim/);
  assert.match(ui,/A team lead or Director assigns the lead from the Pending Assignment Queue/);
  assert.match(crm,/Broker must be an eligible active member of the selected team/);
  assert.match(migration,/routing_rules_team_queue_only_ck/);
  for(const team of ['Dubai Rental Team','Dubai Off-plan Team','Dubai Secondary Sales Team'])assert.match(source,new RegExp(team));
});

test('proposal creation consumes administrator-defined prompts and snapshots their answers',()=>{
  const ui=read('public/app.js'),api=read('src/routes/files-proposals.js');
  assert.match(ui,/configured-proposal-inputs/);
  assert.match(ui,/data-proposal-input/);
  assert.match(ui,/f\.inputs=Object\.fromEntries/);
  assert.match(api,/Mandatory proposal content is missing/);
  assert.match(api,/buildIndicativePurchaseTimeline/);
  assert.match(api,/approvedText\.purchase_timeline=indicativeTimeline\.text/);
  assert.match(api,/configuration:template\.configuration/);
  assert.match(api,/inputs:agentInputs/);
  assert.match(api,/makeProposalPdf/);
});

test('Admin Assistant can maintain routine teams settings and listings without approval authority',()=>{
  const crm=read('src/routes/crm.js'),governance=read('src/routes/governance.js'),qualification=read('src/routes/qualification-finance.js'),files=read('src/routes/files-proposals.js'),listings=read('src/routes/listings.js');
  assert.match(crm,/Admin Assistants can create teams/);
  assert.match(crm,/Admin Assistants can edit teams/);
  assert.match(governance,/Administrator or Admin Assistant access required/);
  assert.match(qualification,/admin_assistant.*approve\|activate/);
  assert.match(files,/admin_assistant.*approve\|activate/);
  assert.match(listings,/admin_assistant/);
});

test('user-management API returns effective role assignments with browser-facing field names',()=>{
  const source=read('src/routes/admin.js');
  for(const field of ["'jobRole',r.job_role","'teamId',r.team_id","'isPrimary',r.is_primary=1","'startsAt',r.starts_at"])assert.match(source,new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('team manager is the authoritative reporting line shown in user management',()=>{
  const admin=read('src/routes/admin.js'),crm=read('src/routes/crm.js'),auth=read('src/routes/auth.js'),ui=read('public/app.js'),migration=read('src/migrations/024_team_reporting_lines.sql');
  assert.match(admin,/reporting_manager_name/);assert.match(admin,/syncManagerAssignment/);
  assert.match(admin,/already managed by .*Change its manager deliberately in Team maintenance/);
  assert.match(crm,/eligibleTeamManager/);assert.match(crm,/Select an active user with a Manager role/);
  assert.match(crm,/isCompanyReader\(req\.broker\)\|\|req\.broker\.jobRole==='admin_assistant'/);
  assert.match(auth,/already has a Manager/);assert.match(auth,/UPDATE teams SET manager_id=\$1/);
  assert.match(ui,/Team \/ reporting line/);assert.match(ui,/Reports to:/);assert.match(ui,/Manages:/);
  assert.match(ui,/Reporting manager not assigned/);assert.match(ui,/s\.jobRole==='manager'/);
  assert.match(migration,/HAVING COUNT\(\*\)=1/);assert.match(migration,/membership_role='member'/);
});

test('manager to director reporting is explicit governed maintenance',()=>{
  const admin=read('src/routes/admin.js'),ui=read('public/app.js'),dashboard=read('src/routes/dashboards.js'),migration=read('src/migrations/025_manager_director_reporting.sql');
  assert.match(admin,/reportsToId/);assert.match(admin,/Select an active Managing Director/);assert.match(admin,/direct_supervisor_name/);
  assert.match(ui,/Reports to Director/);assert.match(ui,/data-reports-to/);
  assert.match(dashboard,/manager\.reports_to_id/);assert.match(dashboard,/m\.reports_to_id=\$1/);
  assert.match(migration,/HAVING COUNT\(\*\)=1/);assert.match(migration,/brokers_reports_to_not_self_ck/);
});

test('administration navigation consolidates read-only website intake into audit operations',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/Audit and Operations/);
  assert.match(ui,/WebsiteIntake/);
  assert.doesNotMatch(ui,/data-admin-section="website-intake"/);
});

test('operational qualification is questionnaire-driven and not manually selectable',()=>{
  const ui=read('public/app.js'),api=read('src/routes/qualification-finance.js'),crm=read('src/routes/crm.js');
  assert.match(ui,/Assess qualification/);assert.match(ui,/Question shown to agent/);assert.match(ui,/data-qualification-answer/);
  assert.doesNotMatch(ui,/id="lead-temp"/);assert.doesNotMatch(ui,/id="lead-assessment"/);
  assert.match(api,/qualification-questionnaire/);assert.match(crm,/New leads begin Unassessed/);assert.match(crm,/Qualification can be changed only through an approved model assessment/);
  assert.match(ui,/Override this result/);assert.match(ui,/never asks for the answers again/);
  assert.match(api,/qualification-assessments\/:assessmentId\/override/);
  assert.match(api,/sourceAssessmentId/);assert.match(api,/manager_override/);
});

test('qualification maintenance guides business users through governed activation',()=>{
  const ui=read('public/app.js'),styles=read('public/index.html'),api=read('src/routes/qualification-finance.js');
  for(const label of ['All business lines','Draft','Test','Approve','Activate','Factor name','Question shown to agent','Answer format','Weight %','Move up','Move down','Active questionnaire coverage','No active version'])assert.match(ui,new RegExp(label));
  assert.match(ui,/<select name="businessLine">/);assert.doesNotMatch(ui,/<input name="businessLine">/);
  assert.match(ui,/qualification-model-form" class="form-grid hidden"/);
  assert.match(styles,/qualification-factor-card/);assert.match(styles,/qualification-lifecycle/);
  assert.match(api,/BUSINESS_TYPES\.includes\(clean\(b\.businessLine\)\)/);
  assert.match(api,/ORDER BY \(business_line=\$1\) DESC/);
  assert.match(api,/Ask an administrator to test, approve and activate a version/);
});

test('customers are a primary workspace and lead KYC links to the customer master',()=>{
  const ui=read('public/app.js'),crm=read('src/routes/crm.js'),files=read('src/routes/files-proposals.js');
  assert.match(ui,/data-tab="customers">Customers/);assert.match(ui,/renderCustomers\(\)/);
  assert.match(ui,/Maintain customer identity, contact channels, consent and KYC once/);
  assert.match(ui,/Open customer record/);assert.match(ui,/switchTab\('customers'\)/);
  assert.doesNotMatch(ui,/id="lead-verify"/);assert.doesNotMatch(ui,/id="lead-governance"/);
  assert.match(crm,/r\.get\('\/crm\/customers\/:id'/);assert.match(crm,/canReadLead/);
  assert.match(ui,/Private linked documents/);assert.match(crm,/FROM documents WHERE contact_id=\$1 OR lead_id=ANY/);
  assert.match(crm,/status='executed' AND effective_at<=NOW\(\)/);assert.doesNotMatch(crm,/status='granted' AND effective_from/);
  assert.match(ui,/Create lead for this customer/);assert.match(ui,/openNewLeadForm\(id\)/);assert.match(ui,/Open customer documents/);
  assert.match(files,/r\.get\('\/crm\/customers\/:id\/documents'/);assert.match(files,/d\.lead_id IN \(SELECT id FROM leads WHERE contact_id=\$1\)/);
  assert.match(ui,/contactId:customer\.id/);assert.match(ui,/Private customer document uploaded/);
  assert.match(ui,/id="customer-add">\+ Create customer/);assert.match(ui,/openNewCustomerForm/);assert.match(ui,/Customer created/);
  assert.match(crm,/New customers require email, phone and preferred channel/);
  assert.match(crm,/kyc_verified_by=CASE WHEN \$4='verified' THEN \$5::uuid ELSE NULL::uuid END/);
  const styles=read('public/index.html');assert.match(styles,/#customer-results td small\{display:block/);assert.match(styles,/#customer-results table\{min-width:1120px;table-layout:fixed/);
});

test('Sales Agent customer loading is scope-first and opened leads show a distinct lifecycle',()=>{
  const ui=read('public/app.js'),crm=read('src/routes/crm.js'),styles=read('public/index.html');
  assert.match(crm,/SELECT c\.id FROM contacts c WHERE \$\{where\.join\(' AND '\)\}/);
  assert.match(crm,/WHERE c\.id=ANY\(\$1::uuid\[\]\)/);
  assert.match(crm,/res\.json\(\{ count: contacts\.length, contacts \}\)/);
  assert.match(crm,/stageHistory/);
  assert.match(ui,/Customer.*Lead.*Contacted.*Qualified.*Viewing.*Negotiation.*Won/s);
  assert.match(ui,/One customer may have several leads, and each lead can be at a different stage\./);
  assert.match(ui,/lead\.stage==='Lost'/);
  assert.match(ui,/aria-current="step"/);
  assert.match(styles,/\.lead-lifecycle-step\.current/);
  assert.match(styles,/\.lead-lifecycle-lost\.current/);
});

test('existing customer selection ranks typed matches first and alphabetizes both groups',()=>{
  const ui=read('public/app.js'),crm=read('src/routes/crm.js');
  assert.match(ui,/Select existing customer \(optional\)/);
  assert.match(ui,/id="existing-customer-select" name="contactId"/);
  assert.match(ui,/sorted dropdown/);
  assert.match(ui,/Type a name, email or phone, e\.g\. Ajit/);
  assert.match(ui,/rankCustomerChoices/);
  assert.match(ui,/shown first; names are alphabetical within each group/);
  assert.match(ui,/all customers remain available alphabetically/);
  assert.match(crm,/ORDER BY LOWER\(c\.full_name\)/);
});

test('customer-originated lead creation carries a locked Customer Master reference',()=>{
  const ui=read('public/app.js'),styles=read('public/index.html');
  assert.match(ui,/const preselectedCustomer=preselectedCustomerId\?contacts\.find/);
  assert.match(ui,/Customer carried from Customer Master/);
  assert.match(ui,/type="hidden" name="contactId" value=/);
  assert.match(ui,/This lead will be linked to the existing customer record/);
  assert.match(ui,/if\(!preselectedCustomerId\)\(\{companies\}=await api\('\/crm\/companies'\)\)/);
  assert.match(styles,/\.customer-lead-feed\{/);
  assert.match(ui,/Search existing leads/);
  assert.match(ui,/Opportunity or linked customer name/);
  assert.match(ui,/Customers appear here only after a lead has been created/);
  assert.doesNotMatch(ui,/placeholder="Lead or customer name"/);
});

test('lead capture explains the original property link in business language',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/Property that prompted this enquiry \(optional\)/);
  assert.match(ui,/No specific property linked/);
  assert.match(ui,/It does not restrict later inventory matching/);
  assert.match(ui,/Original property enquiry/);
  assert.doesNotMatch(ui,/Related listing \(optional\)/);
  assert.match(ui,/Preferred areas \(comma-separated\)/);
  assert.match(ui,/will prefill Structured requirements/);
  assert.match(ui,/initialAreas=.*lead\.preferredAreas/);
});

test('structured requirements use governed property choices and save blank bedroom limits safely',()=>{
  const ui=read('public/app.js'),routes=read('src/routes/lead-operations.js'),ai=read('src/ai-service.js');
  assert.match(ui,/Property types \(select one or more\)/);assert.match(ui,/name="propertyTypes" multiple/);
  assert.match(ui,/fd\.getAll\('propertyTypes'\)/);assert.match(ui,/Requirement not saved:/);
  assert.match(ui,/Suggestion not generated/);assert.match(ui,/details are shown in the panel/);
  assert.match(ui,/requirement-version-card/);assert.match(read('public/index.html'),/\.requirement-version-card\{display:block;width:100%/);
  assert.match(routes,/REQUIREMENT_PROPERTY_TYPES/);assert.match(routes,/Select property types from the approved list/);
  assert.match(routes,/String\(b\[n\]\)\.trim\(\)===\x27\x27\?null/);
  assert.match(routes,/,bedroomsMin,bedroomsMax,/);assert.match(ai,/propertyTypeArray/);
});

test('administration uses a left maintenance menu and proposal designer enforces buyer booklet controls',()=>{
  const app=read('public/app.js'),routes=read('src/routes/files-proposals.js'),pdf=read('src/proposal-pdf.js');
  assert.match(app,/setupAdminWorkspace\(\)/);
  assert.match(app,/className='admin-workspace'/);
  assert.match(app,/admin-maintenance-nav/);
  assert.match(app,/\['users','User management'\]/);
  assert.match(app,/Maximum matched properties/);
  assert.match(app,/max="3"/);
  assert.match(app,/Approved media per property/);
  assert.match(app,/max="2"/);
  assert.match(app,/Property information and display rules/);
  assert.match(app,/Generate branded draft sample/);
  assert.match(app,/Print \/ Save draft PDF/);
  assert.match(app,/DRAFT SAMPLE/);
  assert.match(app,/Save the draft, generate and review its sample, then approve and activate/);
  assert.match(app,/CUSTOMER ADDRESS/);
  assert.match(app,/proposal-timeline-step/);
  assert.match(app,/Verify finance readiness/);
  assert.match(app,/PROPERTY IMAGE 1/);
  assert.match(app,/Emirates ID:<\/b> ending 4821/);
  assert.doesNotMatch(app,/class="proposal-kyc"/);
  assert.match(app,/Recommended matches/);
  assert.match(app,/NYSA-INV-000241/);
  assert.match(app,/MATCH \$\{i\+1\} OF \$\{sampleCount\}/);
  assert.match(app,/Final four characters only/);
  assert.match(routes,/'contact\.phone':recipient\.phone/);
  assert.match(routes,/'contact\.kyc_status':recipient\.kycStatus/);
  assert.match(pdf,/p\.inventoryReference/);
  assert.match(pdf,/Identity reference/);
  assert.match(pdf,/YOUR DUBAI PROPERTY SHORTLIST/);
  assert.doesNotMatch(routes,/KYC summary: \$\{maskedKyc\}/);
  const crm=read('src/routes/crm.js');
  assert.match(crm,/never enter the full ID number/);
  assert.match(crm,/kyc_summary_updated/);
  assert.match(routes,/'contact\.postal_address':recipient\.postalAddress/);
  assert.match(app,/organizationVersions\.find\(x=>x\.status==='active'\)/);
  assert.match(app,/approved logo/);
  assert.match(app,/proposal-preview-brand/);
  assert.match(app,/Create new version/);
  assert.match(routes,/proposal\.templateType==='Quick'.*listingIds\.length<1/);
  assert.match(routes,/requireAvailabilityCheck/);
  assert.match(routes,/maxMediaPerProperty/);
  assert.match(routes,/Only approved media with current permitted-use rights from selected properties/);
});

test('proposals receive immutable monthly business references used across workflow and PDF',()=>{
  const routes=read('src/routes/files-proposals.js'),ui=read('public/app.js'),pdf=read('src/proposal-pdf.js'),migration=read('src/migrations/020_proposal_business_numbers.sql');
  assert.match(migration,/ROW_NUMBER\(\) OVER/);
  assert.match(migration,/CREATE UNIQUE INDEX proposals_proposal_number_uq/);
  assert.match(migration,/proposal_number_counters/);
  assert.match(routes,/ON CONFLICT\(period_code\) DO UPDATE SET last_value=/);
  assert.match(routes,/proposalNumber=`NYSA-PR-/);
  assert.match(routes,/document_reference/);
  assert.match(ui,/p\.proposalNumber/);
  assert.match(pdf,/proposal\.proposalNumber/);
});

test('proposal builder guides shortlist media narrative and governed assumptions',()=>{
  const app=read('public/app.js'),routes=read('src/routes/files-proposals.js'),domain=read('src/ai-domain.js'),styles=read('public/index.html'),http=read('src/lib/http-kit.js');
  assert.match(routes,/proposal-builder-context/);
  assert.match(routes,/rankInventoryMatches\(requirement,listings\)/);
  assert.match(routes,/approval_status='approved'/);
  assert.match(routes,/property-media\/:mediaId\/view/);
  assert.match(routes,/Activate a \$\{b\.templateType\} proposal template before starting this proposal/);
  assert.match(domain,/export function rankInventoryMatches/);
  assert.match(domain,/Preferred area',25/);
  assert.match(domain,/Property type',25/);
  assert.match(domain,/Budget range',25/);
  assert.match(domain,/Bedroom range',15/);
  assert.match(domain,/Availability confirmation',10/);
  assert.match(app,/Preparation required/);
  assert.match(app,/Use top suggested matches/);
  assert.match(app,/The score is a transparent comparison/);
  assert.match(app,/Only approved media belonging to a selected property can be included/);
  assert.match(app,/Add it to this Inventory record and obtain manager approval/);
  assert.match(app,/Maintain structured requirements/);
  assert.match(app,/Open Inventory maintenance/);
  assert.match(app,/Add or approve property media/);
  assert.match(app,/proposalGapLabels/);
  assert.match(app,/Built-up area/);
  assert.match(app,/Property media and approval/);
  assert.match(app,/Send selected photos to \$\{esc\(reviewer\?\.managerName/);
  assert.match(app,/Upload selected photos and approve automatically/);
  assert.match(app,/Images must meet the maintained size and aspect-ratio policy/);
  assert.match(app,/documented authority to use every photo/);
  assert.match(app,/validatePropertyMediaFile/);
  assert.match(app,/Internal coordination notes \(optional\)/);
  assert.match(app,/It is not required to edit the listing, change availability or maintain property media/);
  assert.match(app,/Enter a broker coordination note before selecting Add note/);
  assert.match(app,/data-gap-listing/);
  assert.match(app,/Draft highlights and suitability/);
  assert.match(app,/It cannot select inventory, change the score or save the proposal/);
  assert.match(app,/Customer-facing assumptions/);
  assert.match(app,/it is not another calculation input/);
  assert.match(app,/Generate immutable draft PDF/);
  assert.match(app,/Review on screen/);
  assert.match(app,/Approve for external delivery/);
  assert.match(app,/Request changes/);
  assert.match(app,/mandatory when requesting changes/);
  assert.match(app,/Record external delivery/);
  assert.match(app,/This does not send the PDF/);
  assert.match(app,/Open Lead Documents/);
  assert.match(app,/Generated customer proposals appear here automatically/);
  assert.match(routes,/document-versions\/:versionId\/view/);
  assert.match(routes,/Content-Disposition',`inline;/);
  assert.match(routes,/reviewConfirmation!==true/);
  assert.match(routes,/reviewMethod:'onscreen_pdf'/);
  assert.match(routes,/proposal-versions\/:versionId\/request-changes/);
  assert.match(routes,/status='changes_requested'/);
  assert.match(routes,/A meaningful change-request reason/);
  assert.match(routes,/INSERT INTO tasks/);
  assert.match(routes,/task_type.*proposal_id.*proposal_version_id/);
  assert.match(routes,/completed_by_proposal_version/);
  assert.match(routes,/returnedTo:current\.createdBy/);
  assert.match(app,/My action requests/);
  assert.match(app,/Work returned to you appears here/);
  assert.match(app,/crm\/tasks\?mine=1&bucket=open/);
  assert.match(read('src/routes/lead-operations.js'),/req\.query\.mine==='1'/);
  assert.match(read('src/routes/lead-operations.js'),/proposal correction completes automatically/);
  assert.doesNotMatch(app,/data-tab="tasks">Tasks/);
  assert.match(app,/PERSONAL WORK QUEUE/);
  assert.match(app,/Search my tasks/);
  assert.match(app,/Proposal changes requested/);
  assert.match(app,/Reviewer remarks/);
  assert.match(app,/View returned PDF/);
  assert.match(app,/Revise same proposal/);
  assert.match(app,/Generate corrected immutable version/);
  assert.match(app,/task completes automatically/);
  assert.match(read('public/dashboard-ui.js'),/\['My dashboard','My tasks'\]/);
  assert.match(read('public/dashboard-ui.js'),/id="dashboard-task-workspace"/);
  assert.match(read('public/dashboard-ui.js'),/window\.renderTaskWorkspace/);
  assert.doesNotMatch(read('public/dashboard-ui.js'),/id="dashboard-tasks"/);
  assert.match(routes,/UPDATE document_versions SET status='reviewed'/);
  assert.match(http,/frame-src blob:/);
  assert.match(http,/frame-ancestors 'none'/);
  assert.match(http,/X-Frame-Options', 'DENY'/);
  assert.match(styles,/\.proposal-builder-modal\{max-width:1100px/);
  assert.match(styles,/\.proposal-media-choices/);
  assert.match(styles,/\.proposal-review-modal\{max-width:1180px/);
});

test('organization profile copy action cannot silently clear an unsaved first profile',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/Copy active profile into form/);
  assert.match(ui,/button\.disabled=!active/);
  assert.match(ui,/No active profile exists to copy/);
  assert.match(ui,/It is listed below and remains inactive until approved and activated/);
});

test('organization profile save ignores an unselected logo and reports partial logo failure accurately',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/rawFile\?\.name\?rawFile:null/);
  assert.match(ui,/Company profile saved; logo not attached/);
  assert.match(ui,/form remains linked to draft/);
  assert.match(ui,/selected logo file is empty/);
});

test('organization profile retries reuse the saved draft and unused duplicates can be deleted safely',()=>{
  const ui=read('public/app.js'),routes=read('src/routes/governance.js');
  assert.match(ui,/fillOrganizationForm\(saved\)/);
  assert.match(ui,/Delete unused draft/);
  assert.match(ui,/Compare changes shows what differs from the immediately preceding version/);
  assert.match(routes,/r\.delete\('\/admin\/organization-settings\/:id'/);
  assert.match(routes,/status='draft'/);
  assert.match(routes,/unused_draft_deleted/);
  assert.match(routes,/approved, active and historical versions are retained/);
});

test('fee maintenance is business-labelled and drives contextual scenario calculations',()=>{
  const ui=read('public/app.js'),domain=read('src/admin-governance.js'),routes=read('src/routes/qualification-finance.js');
  for(const label of ['Calculation formula','Calculated on','VAT added to this charge','Transaction applicability','Funding method applicability','Property type applicability','Service channel','Usually paid by','Official source/reference','Include in calculated total','Conditional amount bands'])assert.match(ui,new RegExp(label));
  for(const formula of ['conditional_fixed','percentage_plus_fixed','estimate_range','quantity'])assert.match(domain,new RegExp(formula));
  assert.match(domain,/mortgage_amount/);assert.match(domain,/bank_finance/);assert.match(domain,/totalMinimum/);assert.match(domain,/matchedBand/);
  assert.match(routes,/regulatoryFeeDetails/);assert.match(routes,/regulatoryFeeTotalMinimum/);assert.match(routes,/fundingMethod:inputs/);assert.match(routes,/propertyType:inputs/);assert.match(routes,/serviceChannel:inputs/);
});

test('fee rule-set lifecycle supports safe draft editing comparison approval activation and retirement',()=>{
  const ui=read('public/app.js'),styles=read('public/index.html'),routes=read('src/routes/qualification-finance.js');
  for(const contract of ['fillAssumptionForm','closeAssumptionForm','form-grid hidden','Start new rule set','Save draft changes','Saved versions are read-only','Create new version','Compare changes','Edit draft','Retirement reason'])assert.match(ui,new RegExp(contract));
  assert.match(ui,/method:id\?'PATCH':'POST'/);
  assert.match(routes,/r\.patch\('\/admin\/regulatory-assumptions\/:assumptionId'/);
  assert.match(routes,/r\.post\('\/admin\/regulatory-assumptions\/:assumptionId\/retire'/);
  assert.match(routes,/status IN \('draft','approved'\)/);
  assert.match(routes,/activate a replacement to retire the active version/);
  assert.match(routes,/Rule-set name, authority\/reference and disclaimer are required/);
  assert.match(ui,/Authority\/reference:/);assert.match(ui,/fee-rule-summary/);assert.match(styles,/fee-version-table td small\{display:block/);assert.match(styles,/#assumption-table>\.tool-note\{margin:0 0 12px/);
});

test('browser typography is increased consistently for operational readability',()=>{
  const styles=read('public/index.html');
  for(const contract of ['font-size:16.1px','font-size:14.95px','font-size:12.65px','font-size:13.8px','font-size:39.1px'])assert.match(styles,new RegExp(contract.replace('.','\\.')));
  assert.match(styles,/\.ai-suggestion-meta\{font-size:12\.65px/);
  assert.match(styles,/\.requirement-version-card small\{display:block;color:var\(--muted\);font-size:12\.65px/);
});

test('routing maintenance supports audited edit retirement and a safe company fallback',()=>{
  const ui=read('public/app.js'),routes=read('src/routes/lead-operations.js'),migration=read('src/migrations/026_routing_rule_governance.sql'),areaMigration=read('src/migrations/028_governed_areas_and_routing.sql');
  for(const contract of ['data-edit-routing','data-toggle-routing','Save rule changes','Cancel edit','Routing rule updated','Routing rule retired'])assert.match(ui,new RegExp(contract));
  assert.match(routes,/Reason is required to edit a routing rule/);
  assert.match(routes,/Reason is required to .*retire.*routing rule/);
  assert.match(routes,/Any source \/ Any business \/ All areas is reserved for the Company Unassigned Queue/);
  assert.match(routes,/An active rule already covers this source, business and area combination/);
  assert.match(routes,/await audit\('RoutingRule',row\.id,'edited'/);
  assert.match(migration,/routing_rules_active_fallback_ck/);
  assert.match(migration,/routing_rules_active_match_uq/);
  assert.match(areaMigration,/routing_rules_active_match_area_uq/);
  assert.doesNotMatch(ui,/\$\$\(/);
  assert.match(ui,/No destination team queue is selected/);
});

test('administration entry forms keep labels controls help and actions aligned',()=>{
  const ui=read('public/app.js'),styles=read('public/index.html');
  for(const contract of ['admin-values-form','admin-sla-form','admin-routing-form','admin-team-form','admin-entry-actions','admin-secondary-actions'])assert.match(ui,new RegExp(contract));
  assert.match(styles,/\.admin-entry-form\{display:grid/);
  assert.match(styles,/\.admin-entry-form>div>label\{display:block;min-height:22px/);
  assert.match(styles,/\.admin-entry-actions\{display:flex;gap:8px;align-items:center;margin-top:27px/);
  assert.match(styles,/\.admin-routing-form\{grid-template-columns:/);
  assert.match(styles,/@media\(max-width:800px\)\{\.admin-entry-form/);
  assert.doesNotMatch(ui,/id="team-create" style=/);
});

test('listing workflow history reserves a marker column and a readable content column',()=>{
  const ui=read('public/app.js'),styles=read('public/index.html');
  assert.match(ui,/class="listing-workflow-history"/);
  assert.match(ui,/activity-row listing-workflow-row/);
  assert.match(ui,/class="activity-marker"/);
  assert.match(styles,/\.listing-workflow-history \.listing-workflow-row\{grid-template-columns:34px minmax\(0,1fr\)\}/);
});
