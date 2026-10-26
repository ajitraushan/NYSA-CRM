import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('UAT-070 through UAT-074 provide recoverable authentication and explicit session choice',()=>{
  const ui=read('public/app.js'),auth=read('src/routes/auth.js'),sessions=read('src/auth.js'),css=read('public/index.html');
  assert.match(ui,/const form=e\.currentTarget;setAuthBusy\(form,true\)/);
  assert.doesNotMatch(ui,/finally\{if\(e\.currentTarget\.isConnected\)/);
  assert.match(ui,/reset-request-user/);
  assert.match(css,/\.reset-request-user\{display:flex/);
  assert.match(ui,/reset-code-value/);
  assert.match(ui,/navigator\.clipboard\.writeText\(result\.code\)/);
  assert.match(ui,/Confirm delivered privately/);
  assert.match(ui,/login-to-reset-redeem/);
  assert.match(ui,/Keep me signed in for 7 days/);
  assert.match(auth,/rememberMe\?24\*7:12/);
  assert.match(auth,/persistent:rememberMe/);
  assert.match(sessions,/createSession\(brokerId,\{hours=DEFAULT_SESSION_HOURS\}=\{\}\)/);
});

test('UAT-075 and UAT-076 make governed Building creation atomic and remove misleading mapping state',()=>{
  const route=read('src/routes/dld-market-intelligence.js'),ui=read('public/market-intelligence-ui.js'),migration=read('src/migrations/104_dev160_uat070_079_journey_unblock.sql');
  assert.match(route,/const result=await transaction\(async client=>/);
  assert.match(route,/await audit\('InventoryBuilding'.*,client\)/);
  assert.match(route,/Building stable code .* already exists/);
  assert.match(route,/already exists in the selected Community/);
  assert.doesNotMatch(ui,/<th>Mapping state<\/th>/);
  assert.doesNotMatch(ui,/status\(x\.externalMappingStatus\)/);
  assert.match(migration,/'InventoryBuilding'/);
});

test('UAT-077 combines completed assessment and Lead qualification without blocking first contact',()=>{
  const route=read('src/routes/qualification-finance.js'),ui=read('public/app.js');
  assert.match(route,/Record the first Customer contact before completing qualification/);
  assert.match(route,/stage=CASE WHEN stage='Contacted' THEN 'Qualified'/);
  assert.match(route,/qualification_assessment_completed/);
  assert.match(route,/calculated_and_lead_qualified/);
  assert.match(ui,/Qualification locked until Customer contact/);
  assert.match(ui,/Complete the approved qualification when sufficient Customer information is available/);
  assert.doesNotMatch(ui,/Move the Lead to Qualified after completing the approved assessment/);
});

test('UAT-078 and UAT-079 support objective-specific versions and governed retirement',()=>{
  const route=read('src/routes/qualification-finance.js'),ui=read('public/app.js'),migration=read('src/migrations/104_dev160_uat070_079_journey_unblock.sql');
  assert.match(migration,/qualification_models_model_code_objective_version_uq/);
  assert.match(migration,/COALESCE\(customer_objective,''\),version/);
  assert.match(route,/qualification-model:\$\{modelCode\}:\$\{customerObjective\}/);
  assert.match(route,/qualification-models\/:modelId\/retire/);
  assert.match(route,/model_code='lead_readiness' AND status='active'/);
  assert.match(ui,/retireQualificationModel/);
  assert.match(ui,/Retire version/);
  assert.match(ui,/data-retire-model/);
  assert.match(ui,/querySelectorAll\('\[data-retire-model\]'\).*addEventListener\('click'/);
  assert.doesNotMatch(ui,/onclick="retireQualificationModel/);
});
