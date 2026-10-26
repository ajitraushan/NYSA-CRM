import test from 'node:test';
import assert from 'node:assert/strict';
import {canReadAllCrmDocuments,isCrmDocumentReadRequest} from '../src/document-read-policy.js';
import {accountantRequestAllowed} from '../src/accountant-access.js';
import {governedRoleRequestAllowed} from '../src/role-access.js';

test('Every active account role may read documents, including KYC',()=>{
  for(const role of ['admin','internal_broker','partner_broker','viewer']) {
    for(const jobRole of ['admin','sales_agent','listing_agent','manager','director','accountant']) {
      assert.equal(canReadAllCrmDocuments({role,jobRole,status:'active'}),true);
      assert.equal(canReadAllCrmDocuments({role,jobRole,status:'suspended'}),false);
    }
  }
  assert.equal(canReadAllCrmDocuments(null),false);
  assert.equal(canReadAllCrmDocuments({role:'unknown',status:'active'}),false);
});

test('Document read exceptions never unlock writes, decisions or unrelated workspaces',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const path='/api/crm/document-versions/'+id+'/view';
  assert.equal(isCrmDocumentReadRequest('GET',path),true);
  for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal(isCrmDocumentReadRequest(method,path),false);
  assert.equal(isCrmDocumentReadRequest('GET','/crm/contacts'),false);
  assert.equal(isCrmDocumentReadRequest('GET',path+'/anything'),false);
  const accountant={role:'internal_broker',jobRole:'accountant',status:'active'};
  const admin={role:'admin',jobRole:'admin',status:'active'};
  assert.equal(accountantRequestAllowed(accountant,'GET',path),true);
  assert.equal(governedRoleRequestAllowed(admin,'GET',path),true);
  assert.equal(accountantRequestAllowed(accountant,'POST','/crm/documents'),false);
  assert.equal(governedRoleRequestAllowed(admin,'POST','/crm/documents'),false);
});
