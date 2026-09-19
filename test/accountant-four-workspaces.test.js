import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {accountantRequestAllowed} from '../src/accountant-access.js';
const accountant={role:'internal_broker',jobRole:'accountant'},id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('Accountant allowlist keeps own leave and receipt duties; blocks unrelated modules and mutations',()=>{
  for(const actor of [accountant,{...accountant,role:'admin'}]){
    for(const p of ['/me','/crm/classification-catalogue/active','/crm/my-employment','/crm/my-leave-balances','/crm/my-leave-applications','/finance/commission-deals','/finance/agent-payouts','/finance/receivables/awaiting','/finance/accountant-opportunities',`/finance/accountant-opportunities/${id}`,`/crm/deals/${id}/commission`,`/crm/deals/${id}/commission-proofs`,`/crm/deals/${id}/commission-proofs/${id}/download`])
      assert.equal(accountantRequestAllowed(actor,'GET','/api'+p),true,p);
    for(const p of ['/auth/logout','/crm/my-leave-applications',`/crm/my-leave-applications/${id}/submit`,`/crm/my-leave-applications/${id}/withdraw`,`/crm/deals/${id}/commission-proofs`,`/crm/deals/${id}/commission-receipts`,`/crm/deals/${id}/commission-receipt-confirmations`,`/finance/deal-agent-credit-lines/${id}/payout/calculate`,'/finance/commission-payment-batches',`/finance/commission-payment-batches/${id}/release`])
      assert.equal(accountantRequestAllowed(actor,'POST','/api'+p),true,p);
    for(const p of ['/listings',`/listings/${id}`,'/crm/leads','/crm/contacts','/crm/companies','/admin/brokers','/crm/dashboard','/crm/opportunities',`/crm/opportunities/${id}`,`/crm/leave-applications/${id}/review`])
      for(const method of ['GET','POST','PATCH','DELETE'])assert.equal(accountantRequestAllowed(actor,method,'/api'+p),false,method+p);
    for(const p of [`/crm/deals/${id}/close-won`,`/crm/deals/${id}/commission-expectations`,`/crm/deal-commission-expectations/${id}/freeze`,`/finance/accountant-opportunities/${id}`])
      assert.equal(accountantRequestAllowed(actor,'POST','/api'+p),false,p);
  }
  assert.equal(accountantRequestAllowed({jobRole:'director'},'POST','/api/finance/agent-payouts'),true);
  assert.equal(accountantRequestAllowed({jobRole:'sales_agent'},'GET','/api/listings'),true);
});
test('Accountant UI includes Receivables and Commission Payments without MD approval access',()=>{
  const view={innerHTML:'',querySelectorAll:()=>[]},window={};
  const context=vm.createContext({window,document:{querySelector:()=>view},esc:String});
  vm.runInContext(fs.readFileSync(new URL('../public/accountant-workspace-ui.js',import.meta.url),'utf8'),context);
  assert.deepEqual(Array.from(window.accountantTabs,t=>t.label),['Dashboard','Opportunities','My Leave','Commission Payments','Receivables']);
  for(const tab of ['customers','crm','listings','externalListings','admin','payout','marketingCompliance'])assert.equal(window.accountantTabAllowed(tab),false);
  window.renderAccountantDashboard();assert.match(view.innerHTML,/Read|read-only/);assert.doesNotMatch(view.innerHTML,/data-accountant-tab="(?:listings|crm|customers|payout)"/);
});
test('Accountant register opens via finance read projection and never calls operational Opportunity API',async()=>{
  const target={innerHTML:'',querySelectorAll:()=>[]},form={},view={innerHTML:'',querySelector:s=>s==='#accountant-search'?form:target};
  const calls=[],window={};
  vm.runInNewContext(fs.readFileSync(new URL('../public/accountant-workspace-ui.js',import.meta.url),'utf8'),{
    window,document:{querySelector:()=>view},esc:String,URLSearchParams,
    api:async p=>{calls.push(p);return{opportunities:[],count:0,page:1,pageCount:1};}
  });
  await window.renderAccountantOpportunities();assert.match(calls[0],/^\/finance\/accountant-opportunities\?/);
  assert.match(target.innerHTML,/No matching Opportunities/);
});
