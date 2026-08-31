import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Listing Executive can reach Companies and Developers from an allowed workspace',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/id="customer-companies">Companies and Developers/);
  assert.match(ui,/\$\('#customer-companies'\)\?\.addEventListener\('click',openCompanies\)/);
  assert.match(ui,/\['manager','director','admin_assistant','listing_agent'\]/);
});

test('Company and initial Developer role are created in one transaction',()=>{
  const crm=read('src/routes/crm.js');
  const companyRoute=crm.match(/r\.post\('\/crm\/companies',[\s\S]*?\n\}\);/)?.[0]||'';
  assert.match(companyRoute,/transaction\(async client/);
  assert.match(companyRoute,/external_company_roles/);
  assert.match(companyRoute,/initialRole:b\.companyRole/);
  assert.match(companyRoute,/Invalid companyRole/);
});

test('Listing Executive submits a governed Developer for independent activation',()=>{
  const route=read('src/routes/partner-organizations.js');
  const ui=read('public/app.js');
  assert.match(route,/canCreateGovernanceDraft=broker=>isGovernanceAuthority\(broker\)\|\|broker\.jobRole==='listing_agent'/);
  assert.match(route,/isGovernanceAuthority\(req\.broker\)\?'active':'pending_verification'/);
  assert.match(route,/requiresIndependentVerification:status==='pending_verification'/);
  assert.match(route,/version\.createdBy===req\.broker\.id/);
  assert.match(ui,/Submit governed Developer for verification/);
  assert.match(ui,/different Administrator must verify it before it becomes selectable in Inventory/);
});

test('Listing Executive governance access remains limited to owned Companies',()=>{
  const route=read('src/routes/partner-organizations.js');
  assert.match(route,/req\.broker\.jobRole==='listing_agent'.*c\.owner_id=\$1/);
  assert.match(route,/req\.broker\.jobRole==='listing_agent'.*owner_id=\$2/);
  assert.match(route,/\(\$2::uuid IS NULL OR owner_id=\$2\)/);
});

test('Inventory still selects only independently activated Developer versions',()=>{
  const listings=read('src/routes/listings.js');
  assert.match(listings,/v\.status='active' AND v\.classification='developer'/);
});
