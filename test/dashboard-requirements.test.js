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

test('dashboard drill-down scope remains company-wide for director team-only for manager and own-record for agent',()=>{
  const director=leadScopeSql('l',{id:'d',role:'internal_broker',jobRole:'director'},[]);
  const manager=leadScopeSql('l',{id:'m',role:'internal_broker',jobRole:'manager',managedTeamIds:['t1']},[]);
  const agent=leadScopeSql('l',{id:'a',role:'internal_broker',jobRole:'sales_agent',teamId:'t1'},[]);
  assert.equal(director.clause,'1=1');
  assert.match(manager.clause,/assigned_team_id/);
  assert.match(agent.clause,/assigned_to/);
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
  assert.match(routes,/leadScopeSql\('l',req\.broker,params\)/);
  assert.match(routes,/if\(req\.query\.source\).*l\.source=/s);
});

test('inventory cards identify the listing creator and make the full-detail action explicit',()=>{
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const page=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(app,/Listed by \$\{esc\(l\.postedByName\)\}/);
  assert.match(app,/View details →/);
  assert.match(page,/\.comment-ct\{display:flex/);
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
