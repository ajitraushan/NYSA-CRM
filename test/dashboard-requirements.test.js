import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EXECUTIVE_DASHBOARD_VIEWS,EXECUTIVE_KPI_CODES,buildRoleDashboardPresentation,dashboardRecordBreadcrumb,rankManagementInterventions } from '../src/dashboard-domain.js';
import { leadScopeSql } from '../src/crm-policy.js';

const now=new Date('2026-07-15T08:00:00Z');
const targetCodes=[...new Set(Object.values(EXECUTIVE_KPI_CODES).flat())];
const input=view=>({type:'executive',view,current:{leads:42,won:9,hot:10,warm:8,acceptanceBreaches:2,contactBreaches:1,noNextAction:5,staleRisk:4,unassigned:2,awaitingAcceptance:3,slaRisk:2,hotWarmAging:3},previous:{leads:36,won:7,hot:8,warm:7,acceptanceBreaches:1,contactBreaches:0,noNextAction:4,staleRisk:2,unassigned:1,slaRisk:1},previousInventory:{team_capacity_pressure:0,proposal_workload:4,customer_engagement:8,inventory_available:19,inventory_stale:4,inventory_readiness_exposure:11},
  targets:targetCodes.map(metricCode=>({metricCode,targetValue:10,exceptionThreshold:5,thresholdDirection:['new_leads','won_leads','hot_leads','inventory_available','customer_engagement'].includes(metricCode)?'low_bad':'high_bad',definition:`Approved ${metricCode} definition`,benchmarkSource:'Board-approved Release 1 benchmark'})),
  trend:[{period:'2026-06-23',value:8},{period:'2026-07-07',value:12}],tasks:{overdue:3,today:4},exceptions:{missingContact:1,missingConsent:2,integrationFailures:1},previousExceptions:{missingContact:1},proposals:{prepare:2,review:2,send:1,sent:3},calls:{total:7,followUpRequired:2},
  inventory:{available:20,stale:5,stale60:3,stale90:1,availabilityUnconfirmed:4,permitExposure:2,verificationExposure:3,mediaNotReady:2,portalNotReady:3,agingExposure:7,complianceExposure:5,readinessExposure:9},agents:[{id:'agent-1',open:12}],sources:[{label:'Website',value:24,won:6},{label:'Referral',value:18,won:3}],priorSources:[{label:'Website',value:18,won:3},{label:'Referral',value:18,won:4}],campaigns:[{label:'SUMMER26',value:20,won:5}],
  accountabilityRows:[{businessType:'Sale',teamName:'Sales Team',managerName:'Sales Manager',agentName:'Agent A1',slaBreaches:3,noNextAction:4,staleRisk:2,operationalExceptions:3},{businessType:'Rental',teamName:'Leasing Team',managerName:'Leasing Manager',agentName:'Agent B1',slaBreaches:0,noNextAction:1,staleRisk:2,operationalExceptions:1}],dataAsOf:now});

test('every Managing Director view has its own exact KPI contract and distinct panel contract',()=>{
  const presentations=EXECUTIVE_DASHBOARD_VIEWS.map(view=>buildRoleDashboardPresentation(input(view)));
  for(let i=0;i<presentations.length;i++)assert.deepEqual(presentations[i].kpis.map(k=>k.code),EXECUTIVE_KPI_CODES[EXECUTIVE_DASHBOARD_VIEWS[i]]);
  assert.equal(new Set(presentations.map(x=>x.panels.join('|'))).size,EXECUTIVE_DASHBOARD_VIEWS.length);
});

test('every executive KPI exposes target benchmark trend series threshold refresh exception definition and drill-down metadata',()=>{
  for(const view of EXECUTIVE_DASHBOARD_VIEWS)for(const kpi of buildRoleDashboardPresentation(input(view)).kpis){
    for(const field of ['current','unit','target','benchmarkSource','prior','varianceToPrior','trend','series','exceptionThreshold','exceptionStatus','lastRefresh','calculationBasis','drilldownSegment'])assert.ok(Object.hasOwn(kpi,field),`${view}/${kpi.code} missing ${field}`);
    assert.equal(kpi.benchmarkSource,'Board-approved Release 1 benchmark');
    assert.ok(kpi.series.length>=2,`${view}/${kpi.code} needs historical series`);
    assert.equal(kpi.drilldownSegment,kpi.code);
  }
});

test('inventory trend is explicitly unavailable until governed snapshot history exists',()=>{
  const withoutHistory=input('Inventory');delete withoutHistory.previousInventory;
  const inventoryKpi=buildRoleDashboardPresentation(withoutHistory).kpis.find(kpi=>kpi.code==='inventory_available');
  assert.equal(inventoryKpi.prior,null);
  assert.equal(inventoryKpi.trend,'unavailable');
  assert.equal(inventoryKpi.series.length,1);
});

test('Phase 1 leading-indicator contract is complete and contains no financial forecast',()=>{
  const codes=buildRoleDashboardPresentation(input('Executive')).leadingIndicators.map(x=>x.code);
  for(const required of ['lead_velocity','source_mix_shift','source_quality_trend','hot_warm_pipeline','hot_warm_aging','stale_risk','no_next_action','proposal_workload','team_capacity_pressure','inventory_aging_exposure','inventory_compliance_exposure','sla_risk','exception_trend'])assert.ok(codes.includes(required),`missing ${required}`);
  assert.ok(buildRoleDashboardPresentation(input('Executive')).leadingIndicators.every(x=>x.assumption&&x.unit));
  assert.ok(!codes.some(code=>/revenue|commission|booking|weighted/i.test(code)));
});

test('management interventions are ranked by severity and carry the responsible hierarchy',()=>{
  const ranked=rankManagementInterventions([{code:'stale_risk',label:'Stale',value:4,severity:'medium'},{code:'sla_breaches',label:'SLA',value:3,severity:'critical'}],input('Executive').accountabilityRows);
  assert.deepEqual(ranked.map(x=>x.code),['sla_breaches','stale_risk']);
  assert.deepEqual(ranked[0].responsibleHierarchy,['Sale','Sales Team','Sales Manager','Agent A1']);
  assert.deepEqual(ranked.map(x=>x.rank),[1,2]);
});

test('record breadcrumb contract reaches the underlying record without losing hierarchy',()=>{
  assert.deepEqual(dashboardRecordBreadcrumb({businessType:'Sale',teamName:'Sales Team',managerName:'Sales Manager',agentName:'Agent A1',title:'Lead 101'}),['NYSA CORE','Sale','Sales Team','Sales Manager','Agent A1','Lead 101']);
});

test('Lead register read scope is company-wide for operational CRM identities',()=>{
  const director=leadScopeSql('l',{id:'d',role:'internal_broker',jobRole:'director'},[]);
  const manager=leadScopeSql('l',{id:'m',role:'internal_broker',jobRole:'manager',managedTeamIds:['t1']},[]);
  const agent=leadScopeSql('l',{id:'a',role:'internal_broker',jobRole:'sales_agent',teamId:'t1'},[]);
  assert.equal(director.clause,'1=1');
  assert.equal(manager.clause,'1=1');
  assert.equal(agent.clause,'1=1');
});

test('initial Executive contract remains concise and excludes individual task and call panels',()=>{
  const panels=buildRoleDashboardPresentation(input('Executive')).panels;
  assert.ok(!panels.some(panel=>/task|call|agent_activity/.test(panel)));
  assert.ok(panels.includes('executive_interventions'));
});

test('every KPI and leading-indicator code has an implemented contributing-population path',()=>{
  const route=fs.readFileSync(new URL('../src/routes/dashboards.js',import.meta.url),'utf8');
  const directDefault=new Set(['new_leads','lead_velocity','source_mix_shift','source_quality_trend']);
  const allCodes=new Set([...targetCodes,...buildRoleDashboardPresentation(input('Executive')).leadingIndicators.map(x=>x.code)]);
  for(const code of allCodes)assert.ok(directDefault.has(code)||route.includes(`${code}:`)||route.includes(`'${code}'`),`missing drill-down path for ${code}`);
});

test('executive UI renders benchmark accountability full record breadcrumbs and hides financial forecasts',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  assert.match(ui,/Benchmark:/);
  assert.match(ui,/Responsible:/);
  assert.match(ui,/x\.breadcrumbs/);
  assert.match(ui,/unavailableMetrics/);
  assert.match(buildRoleDashboardPresentation(input('Executive')).unavailableMetrics.map(x=>x.label).join(' '),/Revenue and commission forecast/);
});

test('executive landing and Sales view cover all overview domains including campaign mix',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  for(const label of ['Lead volume & mix','Qualification & funnel','SLA & response','Capacity & workload','Inventory','Proposals & engagement','Operational exceptions','Campaign mix'])assert.match(ui,new RegExp(label.replace('&','\\&')));
  assert.match(ui,/executiveOverview\(data\)/);
  assert.match(ui,/campaignCode/);
});

test('hierarchy navigation preserves manager breadcrumb and record breadcrumbs are visually separated',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(ui,/data-dashboard-manager/);
  assert.match(ui,/managerId:b\.dataset\.dashboardManager/);
  assert.match(ui,/class="record-breadcrumb"/);
  assert.match(css,/\.record-breadcrumb\{display:block/);
});

test('manager hierarchy shows maintained teams and agents independently of period activity',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  const routes=fs.readFileSync(new URL('../src/routes/dashboards.js',import.meta.url),'utf8');
  assert.match(routes,/const organizationRows=type==='manager'/);
  assert.match(routes,/t\.manager_id=\$1 OR EXISTS\(SELECT 1 FROM team_memberships/);
  assert.match(routes,/user_role_assignments ur/);
  assert.match(routes,/b\.status='active'/);
  assert.match(routes,/businessLines:\[\],teams:\[\]/);
  assert.match(ui,/Maintained teams and active agents remain visible even when the selected period has no leads/);
  assert.match(ui,/No active managed team is assigned\. Check User Management and Team maintenance/);
  assert.match(ui,/in selected period/);
  assert.doesNotMatch(ui,/No hierarchy records in this period/);
});

test('dashboard tables explicitly map Won Overdue and Open columns to their named values',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  for(const key of ['won','overdue','open'])assert.match(ui,new RegExp(`valueKey:'${key}'`));
  assert.match(ui,/row\[options\.valueKey\]/);
  assert.doesNotMatch(ui,/row\.won\?\?row\.overdue\?\?row\.open/);
});

test('dashboard titles use the authenticated maintained name and Agent exceptions are visible',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  assert.match(ui,/const dashboardTitle=ME\.name\|\|roleName/);
  assert.match(ui,/My operational exceptions/);
});

test('Agent dashboards remove hierarchy filters fixed by maintained identity',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  assert.match(ui,/if\(likelyType==='agent'\).*\['businessType','teamId','managerId','agentId'\]/);
  assert.match(ui,/const organizationalFilters=likelyType==='agent'\?'':/);
});

test('Agent dashboard provides lifecycle counts, exact lead drill-down and stage actions',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  const routes=fs.readFileSync(new URL('../src/routes/dashboards.js',import.meta.url),'utf8');
  const domain=fs.readFileSync(new URL('../src/dashboard-domain.js',import.meta.url),'utf8');
  const page=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  for(const marker of ['MY LEAD LIFECYCLE','Pipeline at a glance','customers are represented across','Select a stage to see the exact leads and next action','agentLifecycle(data)','data-dashboard-segment="${x.segment}"','exact leads'])assert.match(ui,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const action of ['Record first contact','Complete qualification','Schedule viewing','Record viewing outcome','Progress negotiation','Review completed lead','Review loss outcome'])assert.match(domain,new RegExp(action));
  assert.match(routes,/buildAgentLifecycle\(stages\)/);
  assert.match(routes,/COUNT\(DISTINCT contact_id\)::int AS customers/);
  assert.match(routes,/const lifecycle=AGENT_LIFECYCLE_STAGES\.find/);
  assert.match(routes,/l\.stage='\$\{lifecycle\.stage\}'/);
  assert.match(ui,/result\.stageAction/);
  assert.match(ui,/id="dashboard-lifecycle"[\s\S]*id="dashboard-filters"[\s\S]*id="dashboard-kpis"/);
  assert.match(ui,/dashboard-lifecycle'\)\.innerHTML=likelyType==='agent'&&!showingTasks\?agentLifecycle\(data\):''/);
  assert.doesNotMatch(ui,/if\(data\.dashboardType==='agent'\)return \[\s*agentLifecycle\(data\)/);
  assert.match(page,/\.agent-lifecycle-track\{/);
  assert.match(page,/\.agent-lifecycle-lost\{/);
  assert.match(page,/<script src="dashboard-ui\.js\?v=r2\.5-dev52"><\/script>/);
});

test('Role dashboards show the maintained reporting structure at the top without widening access',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  const routes=fs.readFileSync(new URL('../src/routes/dashboards.js',import.meta.url),'utf8');
  const page=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(routes,/async function loadOrganizationContext/);
  assert.match(routes,/contextVersion:3,kind:'director',supervisors:\[\],reports:/);
  assert.match(routes,/contextVersion:3,kind:'manager',supervisors:directors,reports/);
  assert.match(routes,/contextVersion:3,kind:'agent',supervisors:row\?\[row\]:\[\],reports:\[\]/);
  assert.match(routes,/job_role='director'/);
  assert.match(routes,/b\.job_role IN \('sales_agent','listing_agent'\)/);
  assert.match(routes,/LEFT JOIN LATERAL/);
  assert.match(routes,/user_role_assignments/);
  assert.match(routes,/team_memberships/);
  assert.match(routes,/const organizationContext=await loadOrganizationContext\(req\.broker,type\)/);
  assert.match(routes,/organizationContext,qualification/);
  assert.match(ui,/id="dashboard-organization"/);
  assert.match(ui,/org\.contextVersion!==3/);
  assert.match(ui,/Dashboard service restart required/);
  assert.match(ui,/org\.supervisors/);
  assert.match(ui,/org\.reports/);
  assert.match(ui,/My Manager/);
  assert.match(ui,/My Direct Reports/);
  assert.doesNotMatch(ui,/My reporting line/);
  assert.doesNotMatch(ui,/My reporting agents/);
  assert.match(ui,/item\.personName/);
  assert.match(ui,/item\.unitName/);
  assert.match(ui,/No maintained reporting line/);
  assert.match(ui,/Administration → CRM teams and User management/);
  assert.match(ui,/dashboard-side/);
  assert.match(page,/\.dashboard-organization\{/);
  assert.match(page,/\.dashboard-org-list\{/);
});

test('manager and director dashboards expose a scoped proposal approval queue',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  const routes=fs.readFileSync(new URL('../src/routes/dashboards.js',import.meta.url),'utf8');
  const proposals=fs.readFileSync(new URL('../src/routes/files-proposals.js',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(ui,/Proposal approvals/);
  assert.match(ui,/data-dashboard-view/);
  assert.match(ui,/data-approval-tab/);
  assert.match(ui,/ME\.jobRole==='director'\?\['Executive','Sales','Inventory','Operations and Risk','Proposal approvals','My tasks'\]/);
  assert.match(ui,/if\(data\.view==='Proposal approvals'\)return proposalApprovals\(data\)/);
  assert.match(ui,/showingTasks\|\|showingKycReviews\|\|showingVerification\|\|showingListingApprovals\|\|showingMediaApprovals\|\|showingProposalApprovals\?'':kpiCards\(data\)/);
  assert.doesNotMatch(ui,/\[proposalApprovals\(data\),/);
  assert.match(ui,/Latest generated proposal version from each managed-team proposal awaiting review/);
  assert.match(ui,/Latest generated proposal version from each company proposal awaiting review/);
  assert.match(ui,/data-proposal-approval/);
  assert.match(ui,/window\.openProposalPdfReview/);
  assert.match(ui,/id="proposal-approval-search"/);
  assert.match(ui,/Proposal number \/ title/);
  assert.match(ui,/Pending approval/);
  assert.match(ui,/Submitted \/ waiting/);
  assert.match(ui,/minute.*waiting/);
  assert.doesNotMatch(ui,/Less than 1 hour/);
  assert.match(ui,/crm\/dashboard\/proposal-approvals/);
  assert.match(routes,/loadProposalApprovalQueue/);
  assert.match(routes,/r\.get\('\/crm\/dashboard\/proposal-approvals'/);
  assert.match(routes,/c\.full_name ILIKE/);
  assert.match(routes,/p\.proposal_number ILIKE/);
  assert.match(routes,/'pending approval' ILIKE/);
  assert.match(routes,/ORDER BY v\.created_at DESC,v\.id DESC/);
  assert.match(routes,/v\.status='generated'/);
  assert.match(routes,/MAX\(latest\.version_number\)/);
  assert.match(routes,/proposalApprovalScopeSql\('l',req\.broker,params\)/);
  assert.match(routes,/canApproveProposals=isProposalApprover\(req\.broker\)/);
  assert.match(proposals,/canApproveProposal/);
  assert.match(proposals,/proposal_number_counters/);
  assert.match(proposals,/NYSA-PR-/);
  assert.match(app,/\['manager','director'\]\.includes\(ME\.jobRole\)/);
});

test('manager dashboard exposes a team-scoped customer KYC review queue',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  const routes=fs.readFileSync(new URL('../src/routes/crm.js',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(ui,/KYC reviews/);
  assert.match(ui,/data-kyc-review-tab/);
  assert.match(ui,/\/crm\/kyc-review-queue/);
  assert.match(ui,/data-kyc-review/);
  assert.match(routes,/r\.get\('\/crm\/kyc-review-queue'/);
  assert.match(routes,/c\.kyc_status='pending_review'/);
  assert.match(routes,/reviewer\.membership_role='manager'/);
  assert.match(routes,/canReviewKyc/);
  assert.match(app,/KYC and verification · Manager review/);
  assert.match(app,/verification is not required before creating a lead/);
  for(const marker of ['Approve KYC','Reject KYC','Mark expired','Submitted KYC notes','Reviewer decision notes'])assert.match(app,new RegExp(marker));
  assert.match(app,/String\(customer\.idDocumentExpiry\|\|''\)\.slice\(0,10\)/);
  assert.match(routes,/reviewDecision\?contact\.idDocumentExpiry/);
  assert.match(routes,/kyc_review_decided/);
  assert.match(routes,/Managers may decide a pending KYC review but cannot alter the submitted identity details/);
  assert.match(routes,/Review notes are required when rejecting or marking KYC expired/);
});

test('manager dashboard consolidates Inventory approval into its verification queue',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  const listings=fs.readFileSync(new URL('../src/routes/listings.js',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(ui,/Inventory verification/);
  assert.doesNotMatch(ui,/likelyType==='manager'\?\[[^\]]*'Inventory approvals'/);
  assert.match(listings,/Inventory approval was consolidated into mandatory Inventory verification/);
  assert.match(app,/There is no separate Inventory approval/);
});

test('dashboard period presets replace manual date entry for every role',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  for(const preset of ['last_week','last_month','last_quarter','last_6_months','older_than_6_months'])assert.match(ui,new RegExp(`'${preset}'`));
  assert.match(ui,/name="periodPreset"/);
  assert.doesNotMatch(ui,/name="dateFrom" type="date"/);
  assert.doesNotMatch(ui,/name="dateTo" type="date"/);
  assert.match(ui,/Object\.assign\(out,dashboardPeriodBounds\(out\.periodPreset\)\)/);
});

test('campaign filter is a role-scoped source-dependent dropdown on every dashboard',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  const routes=fs.readFileSync(new URL('../src/routes/dashboards.js',import.meta.url),'utf8');
  assert.match(ui,/select name="campaignCode" id="dashboard-campaign"/);
  assert.match(ui,/loadCampaignOptions\(defaults\.source,defaults\.campaignCode\)/);
  assert.match(ui,/dashboard-source.*addEventListener\('change'/s);
  assert.match(routes,/\/crm\/dashboard\/filter-options/);
  assert.match(routes,/agentWorkLeadScopeSql\('l',req\.broker,params\)/);
  assert.match(routes,/if\(req\.query\.source\).*l\.source=/s);
});

test('lifecycle drill-down refreshes the filtered dashboard after a successful stage change',()=>{
  const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const page=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(app,/async function openLead\(id,\{afterStageChange=null\}=\{\}\)/);
  assert.match(app,/if\(afterStageChange\)await afterStageChange\(\)/);
  assert.match(app,/openLead\(id,\{afterStageChange\}\)/);
  assert.match(app,/if\(\$\('#crm-results'\)\)loadCRMLeads\(\)/);
  assert.match(app,/cache: opts\.cache \|\| 'no-store'/);
  assert.match(ui,/afterStageChange:async\(\)=>\{o\.remove\(\);await window\.renderCrmDashboard\(\{\.\.\.filters,_refresh:Date\.now\(\)\}\);\}/);
  assert.match(page,/app\.js\?v=r2\.6-dev79/);
  assert.match(page,/dashboard-ui\.js\?v=r2\.5-dev52/);
});

test('inventory cards identify the listing creator and make the full-detail action explicit',()=>{
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const page=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(app,/Listed by \$\{esc\(l\.postedByName\)\}/);
  assert.match(app,/View details →/);
  assert.match(page,/\.comment-ct\{display:flex/);
});

test('CloudLinux startup uses a CommonJS wrapper with dynamic ESM import',()=>{
  const wrapper=fs.readFileSync(new URL('../app.cjs',import.meta.url),'utf8');
  const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.match(wrapper,/import\('\.\/src\/server\.js'\)/);
  assert.equal(pkg.main,'app.cjs');
  assert.equal(pkg.scripts.start,'node app.cjs');
});

test('acceptance ledger keeps executive criteria partial until integrated acceptance passes',()=>{
  const ledger=fs.readFileSync(new URL('../docs/RELEASE_1_ACCEPTANCE_STATUS.md',import.meta.url),'utf8');
  for(const line of [163,165,169]){
    const row=ledger.split(/\r?\n/).find(value=>value.startsWith(`| ${line} |`));
    assert.ok(row,`missing acceptance row ${line}`);
    assert.doesNotMatch(row,/\| Implemented;/);
    assert.match(row,/pending|Partial/i);
  }
});

test('guarded dashboard fixtures satisfy nullable assignment and terminal-loss constraints',()=>{
  const seed=fs.readFileSync(new URL('../scripts/seed-dashboard-fixtures.js',import.meta.url),'utf8');
  assert.match(seed,/\$9::uuid IS NULL/);
  assert.match(seed,/lost_reason,resolution_code,resolution_reason_code/);
  assert.match(seed,/test_not_proceeding/);
});
