import test from 'node:test';
import assert from 'node:assert/strict';
import {accountantRequestAllowed} from '../src/accountant-access.js';
const actor={role:'internal_broker',jobRole:'accountant'},id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('Accountant receivables allowlist grants precise read/write routes only',()=>{
  for(const suffix of ['', '/opportunities','/payers',`/${id}`,`/${id}/document`,`/opportunities/${id}/context`])
    assert.equal(accountantRequestAllowed(actor,'GET','/api/finance/receivables'+suffix),true,suffix);
  for(const suffix of ['/schedules',...['issue','collections','reverse','cancel'].map(a=>`/${id}/${a}`)])
    assert.equal(accountantRequestAllowed(actor,'POST','/api/finance/receivables'+suffix),true,suffix);
  for(const method of ['GET','POST','PATCH','DELETE'])for(const url of ['/finance/receivables/admin','/crm/contacts','/listings'])
    assert.equal(accountantRequestAllowed(actor,method,url),false,method+url);
  assert.equal(accountantRequestAllowed(actor,'GET','/finance/agent-payouts'),true);
  for(const method of ['POST','PATCH','DELETE'])assert.equal(accountantRequestAllowed(actor,method,'/finance/agent-payouts'),false);
  for(const method of ['PATCH','DELETE'])assert.equal(accountantRequestAllowed(actor,method,`/finance/receivables/${id}`),false);
  assert.equal(accountantRequestAllowed(actor,'POST',`/finance/receivables/opportunities/${id}/context`),false);
});
