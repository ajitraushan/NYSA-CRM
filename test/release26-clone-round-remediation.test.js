import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/lib/http-kit.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('queued Lead assignment gives PostgreSQL an explicit UUID type for optional Area eligibility',()=>{
  const routes=read('src/routes/lead-operations.js');
  assert.match(routes,/\(\$\{area\}\)::uuid IS NULL/);
  assert.match(routes,/eligible_area\.area_id=\(\$\{area\}\)::uuid/);
  assert.match(routes,/eligibleSalesAgentTeamSql\('b\.id','\$2','\$3'\)/);
  assert.doesNotMatch(routes,/\(\$\{area\} IS NULL/);
});

test('Administration navigation keeps Listing policy separate and User records under User maintenance',()=>{
  const app=read('public/app.js');
  assert.match(app,/\['listing_policy','Listing approval policy'\],\['users','User management'\],\['user_records','User records'\],\['integration_failures','Integration failures'\],\['operations','Operations & audit'\]/);
  assert.doesNotMatch(app,/\['users','User records'\]/);
});

test('KYC review decision remains visible at the right edge of its horizontal table',()=>{
  const dashboard=read('public/dashboard-ui.js'),html=read('public/index.html');
  assert.match(dashboard,/kyc-review-table/);
  assert.match(dashboard,/class="approval-action-column">Decision/);
  assert.match(dashboard,/class="approval-action-column"><button class="btn btn-primary btn-sm" data-kyc-review/);
  assert.match(html,/\.kyc-review-table \.approval-action-column\{position:sticky;right:0/);
});

test('assignment workflow explains authority, role scope and provides a queue action from an unassigned Lead',()=>{
  const app=read('public/app.js'),html=read('public/index.html');
  assert.match(app,/id="lead-open-assignment-queue">Open assignment queue/);
  assert.match(app,/Eligible reassignment claims/);
  assert.match(app,/Managed-team pending assignment/);
  assert.match(app,/Only SLA-recycled leads you are eligible to claim appear here/);
  assert.match(app,/Manager authority is maintained separately/);
  assert.match(app,/Team membership and the Primary reporting selection do not grant authority to assign Leads/);
  assert.match(app,/Administration → CRM teams/);
  assert.match(html,/\.assignment-scope-authority-note/);
});

test('assignment queue is a role-aware top-level action with a refreshed pending count',()=>{
  const app=read('public/app.js');
  assert.match(app,/id="assignment-queue-nav"/);
  assert.match(app,/ME\.jobRole==='sales_agent'\?'Reassignment Claims':'Assignment Queue'/);
  assert.match(app,/async function refreshAssignmentQueueNavigation\(\{repeat=true\}=\{\}\)/);
  assert.match(app,/button\.textContent=`\$\{baseLabel\} \(\$\{count\}\)`/);
  assert.match(app,/button\.classList\.toggle\('hidden',!leader&&count===0\)/);
  assert.match(app,/setTimeout\(\(\)=>refreshAssignmentQueueNavigation\(\{repeat:true\}\),60000\)/);
  assert.match(app,/nav\.tabs button\[data-tab\]/);
  assert.match(app,/assignment-queue-nav'\)\?\.addEventListener\('click',\(\)=>openAssignmentQueue\(\)\)/);
});

test('logout reloads a fresh application shell and executable static assets cannot remain cached',()=>{
  const app=read('public/app.js'),http=read('src/lib/http-kit.js');
  assert.match(app,/async function logout\(callApi = true\)/);
  assert.match(app,/await api\('\/auth\/logout'/);
  assert.match(app,/reloadUrl\.searchParams\.set\('sessionReload',Date\.now\(\)\.toString\(\)\)/);
  assert.match(app,/window\.location\.replace\(reloadUrl\.toString\(\)\)/);
  assert.match(http,/\['\.html','\.js','\.css'\]\.includes\(extension\)/);
  assert.match(http,/Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0'/);
  assert.match(http,/X-LiteSpeed-Cache-Control', 'no-cache'/);
});

test('static HTML and JavaScript responses emit deployment-safe cache headers',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nysa-static-cache-'));
  fs.writeFileSync(path.join(directory,'index.html'),'<main>fresh</main>');
  fs.writeFileSync(path.join(directory,'app.js'),'window.fresh=true;');
  const app=createApp();
  app.static(directory);
  const server=await new Promise(resolve=>{const listening=app.listen(0,()=>resolve(listening));});
  try{
    const port=server.address().port;
    for(const resource of ['/','/app.js']){
      const response=await fetch(`http://127.0.0.1:${port}${resource}`);
      assert.equal(response.status,200);
      assert.equal(response.headers.get('cache-control'),'no-store, no-cache, must-revalidate, max-age=0');
      assert.equal(response.headers.get('pragma'),'no-cache');
      assert.equal(response.headers.get('expires'),'0');
      assert.equal(response.headers.get('surrogate-control'),'no-store');
      assert.equal(response.headers.get('x-litespeed-cache-control'),'no-cache');
    }
  }finally{
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(directory,{recursive:true,force:true});
  }
});

test('final Release 2.6 remediation keeps every accepted UAT defect as an explicit contract',()=>{
  const app=read('public/app.js'),routes=read('src/routes/opportunities.js'),offer=read('src/offer-domain.js'),deal=read('public/deal-ui.js'),html=read('public/index.html');
  // UI-AMOUNT-FORMAT-10 and 10A-E
  assert.match(app,/BUSINESS_AMOUNT_SELECTOR/);assert.match(app,/const normalize=/);assert.match(app,/return openBusinessMortgageCalculator\(\)/);
  assert.doesNotMatch(app,/new MutationObserver\(\(\)=>installBusinessAmountInputs\(result\)\)/);assert.match(app,/requirementOptions\.map\(renderOption\).*installBusinessAmountInputs\(result\)/s);
  // UI-FLOW-SYNC-11
  assert.match(app,/nysa:requirements-saved/);assert.match(app,/openLead\(id,\{afterStageChange\}\)/);
  // UI-INVENTORY-SELECT-12 and UI-WHATSAPP-PLACEMENT-15
  assert.match(app,/activeAssignments\.length\?'Create another Inventory assignment':'Assign Inventory to this Opportunity'/);
  assert.match(app,/No Inventory is currently assignable/);assert.match(app,/inventorySelectionSection\?\.append\(propertyShareSection\)/);
  // OFFER-UI-13 and OFFER-PARTY-14
  assert.match(app,/normalizeOfferPartyControls/);assert.match(offer,/\['customer','buyer','tenant','seller','landlord','developer','agent','other'\]/);
  assert.match(html,/\.offer-party-aligned/);
  // DEAL-APPROVAL-QUEUE-16 and DEAL-APPROVAL-DECISION-17
  assert.match(routes,/Review Deal closure approval/);assert.match(routes,/dealApprovalCases/);
  assert.match(deal,/Return keeps the Deal open for correction/);assert.doesNotMatch(deal,/Reject closure request/);
  // INV-OWNER-INHERIT-18
  assert.match(routes,/async function inheritInventoryOwner/);assert.match(routes,/if\(!booking\.sellerCounterpartyId&&booking\.listingId\)/);
  assert.match(routes,/UPDATE opportunities SET seller_counterparty_id/);
});
