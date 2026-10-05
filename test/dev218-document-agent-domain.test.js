import test from 'node:test';
import assert from 'node:assert/strict';
import {selectDocumentAgent,validateBrnDetails,validateDefaultDocumentAgent} from '../src/document-agent-domain.js';

test('BRN is optional but its issue date is mandatory when maintained',()=>{
  assert.deepEqual(validateBrnDetails({}),{value:{brn:null,brnIssuedOn:null}});
  assert.match(validateBrnDetails({brn:'58771'}).error,/issue date is required/i);
  assert.match(validateBrnDetails({brnIssuedOn:'2026-01-09'}).error,/without a BRN/i);
  assert.deepEqual(validateBrnDetails({brn:' 58771 ',brnIssuedOn:'2026-01-09'}),{value:{brn:'58771',brnIssuedOn:'2026-01-09'}});
});

test('document agent uses the assigned Agent only with complete BRN evidence',()=>{
  const fallback={id:'sunita',name:'Sunita',brn:'58771',brnIssuedOn:'2026-01-09'};
  assert.equal(selectDocumentAgent({id:'agent',name:'Agent'},fallback).id,'sunita');
  assert.equal(selectDocumentAgent({id:'agent',name:'Agent',brn:'123',brnIssuedOn:'2026-02-02'},fallback).id,'agent');
  assert.match(selectDocumentAgent({id:'agent'},null).error,/document Agent/i);
});

test('PostgreSQL DATE values are accepted for maintained BRN evidence',()=>{
  const issuedOn=new Date('2026-01-09T00:00:00.000Z'),agent={id:'agent',status:'active',role:'internal_broker',brn:'58771',brnIssuedOn:issuedOn};
  assert.equal(selectDocumentAgent(agent,null).id,'agent');
  assert.ok(validateDefaultDocumentAgent(agent).value);
  assert.deepEqual(validateBrnDetails({brn:'58771',brnIssuedOn:issuedOn}),{value:{brn:'58771',brnIssuedOn:'2026-01-09'}});
});

test('default document agent must be active, internal and BRN-complete',()=>{
  assert.ok(validateDefaultDocumentAgent({status:'active',role:'internal_broker',brn:'58771',brnIssuedOn:'2026-01-09'}).value);
  assert.match(validateDefaultDocumentAgent({status:'active',role:'internal_broker'}).error,/requires both BRN/i);
});
