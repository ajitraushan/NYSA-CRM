import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CAPABILITY,capabilitiesFor,governedRoleRequestAllowed,hasCapability} from '../src/role-access.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const actor=(role,jobRole)=>({id:`${role}-${jobRole}`,role,jobRole});

test('DEV209 central policy grants purchased intake only to Sales Agent and Admin',()=>{
  const admin=actor('admin','admin'),sales=actor('internal_broker','sales_agent'),manager=actor('internal_broker','manager'),director=actor('internal_broker','director');
  assert.equal(hasCapability(admin,CAPABILITY.PURCHASED_DATA_IMPORT),true);
  assert.equal(hasCapability(sales,CAPABILITY.PURCHASED_DATA_IMPORT),true);
  assert.equal(hasCapability(manager,CAPABILITY.PURCHASED_DATA_IMPORT),false);
  assert.equal(hasCapability(director,CAPABILITY.PURCHASED_DATA_IMPORT),false);
  assert.equal(governedRoleRequestAllowed(admin,'GET','/crm/purchased-data-import/batches'),true);
  assert.deepEqual([...capabilitiesFor(sales)].sort(),[CAPABILITY.INVENTORY_CREATE,CAPABILITY.PURCHASED_DATA_IMPORT].sort());
});

test('DEV209 purchased intake route and browser consume the central capability',()=>{
  const route=read('src/routes/purchased-data-import.js'),app=read('public/app.js'),ui=read('public/purchased-data-import-ui.js');
  assert.match(route,/hasCapability\(broker,CAPABILITY\.PURCHASED_DATA_IMPORT\)/);
  assert.doesNotMatch(route,/purchased_data_import_authorizations/);
  assert.match(app,/hasCapability\('purchased_data\.import'\)/);
  assert.doesNotMatch(app,/\['manager','director'\]\.includes\(ME\.jobRole\) \? '<button data-tab="purchasedDataImport"/);
  assert.doesNotMatch(ui,/Select Manager or Managing Director|Save import authority/);
});

test('DEV209 restores Sales Agent Inventory creation in UI and API',()=>{
  const app=read('public/app.js'),route=read('src/routes/listings.js');
  assert.match(app,/hasCapability\('inventory\.create'\)/);
  assert.match(app,/<h2>\$\{listingExecutive\?'My Inventory workspace':'Inventory'\}<\/h2>/);
  assert.match(app,/Upload Inventory Excel/);
  assert.match(app,/Create Inventory draft/);
  assert.match(route,/hasCapability\(broker,CAPABILITY\.INVENTORY_CREATE\)/);
  assert.match(route,/\['listing_agent','sales_agent'\]\.includes\(req\.broker\.jobRole\)/);
  assert.equal(hasCapability(actor('internal_broker','sales_agent'),CAPABILITY.INVENTORY_CREATE),true);
});

test('DEV209 fixes populated leave balance query instead of testing only an empty state',()=>{
  const route=read('src/routes/agent-leave.js');
  assert.match(route,/GROUP BY e\.leave_type_version_id,v\.label,t\.type_code,e\.annual_units,e\.allow_negative_balance,e\.display_order ORDER BY e\.display_order/);
});

test('DEV209 removes ambiguous Open page wording and applies dark semantic surfaces to detached stages',()=>{
  const app=read('public/app.js'),styles=read('public/index.html');
  assert.doesNotMatch(app,/flowState\[step\]\.status} · Open page/);
  assert.match(app,/aria-label="Open \$\{label\}\. Status: \$\{flowState\[step\]\.status\}"/);
  for(const selector of ['body .deal-gate','body .viewing-status-scheduled','body .viewing-status-completed','body .opportunity-reminder-guidance'])assert.ok(styles.includes(selector),selector);
  for(const variable of ['var(--red-soft)','var(--amber-soft)','var(--green-soft)','var(--blue-soft)'])assert.ok(styles.includes(variable),variable);
});

test('DEV209 exposes every ready closure approval in Manager My Tasks with a direct review action',()=>{
  const route=read('src/routes/lead-operations.js'),app=read('public/app.js');
  assert.match(route,/taskType:'deal_closure_approval'/);
  assert.match(route,/subject:'Review Deal closure approval'/);
  assert.match(route,/dealApprovalTasks/);
  assert.match(route,/\.\.\.dealApprovalTasks/);
  assert.match(app,/isDealClosureApprovalTask/);
  assert.match(app,/>Review closure<\/button>/);
});
