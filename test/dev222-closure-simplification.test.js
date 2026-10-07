import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dealClosureGates} from '../src/deal-domain.js';
import {describeDocumentComplianceBlockers} from '../src/document-compliance-domain.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV222 closure presents exactly three evidence gates and one atomic approval gate',()=>{
  const deal={dealType:'sale',acceptedOfferRevisionId:'revision-1',bookingStatus:'reserved',status:'completion_in_progress'};
  const gates=dealClosureGates({deal,parties:[{partyRole:'buyer'},{partyRole:'seller'}],documentsComplete:true});
  assert.deepEqual(gates.map(({code})=>code),['commercial','reservation','documents','approval']);
  assert.deepEqual(gates.map(({complete})=>complete),[true,true,true,false]);
  assert.equal(dealClosureGates({...{deal:{...deal,status:'closed_won'},parties:[{partyRole:'buyer'},{partyRole:'seller'}],documentsComplete:true}}).at(-1).complete,true);
});

test('DEV222 signed-document errors identify the exact business document and state',()=>{
  assert.deepEqual(describeDocumentComplianceBlockers([
    {label:'Signed sale agreement',state:'missing'},
    {label:'Transfer deed',state:'pending_review'},
    {label:'Buyer passport',state:'expired'}
  ]),[
    'Signed sale agreement is missing',
    'Transfer deed is awaiting Manager or Director review',
    'Buyer passport has expired'
  ]);
});

test('DEV222 auto-prepares one versioned document register without a manual refresh control',()=>{
  const gate=read('src/document-compliance-gate.js'),ui=read('public/document-compliance-ui.js'),deal=read('public/deal-ui.js');
  for(const marker of ['ensureDocumentComplianceSnapshot','automatically_prepared','manualRefreshRequired:false'])assert.match(gate,new RegExp(marker));
  for(const marker of ['SIGNED TRANSACTION DOCUMENTS','Deal document register','Preparing the Deal document register','does not block closure'])assert.match(ui,new RegExp(marker));
  assert.doesNotMatch(ui,/Refresh document checklist|Use the Official document requirements panel first/);
  assert.equal((deal.match(/documentComplianceWorkspaceHTML/g)||[]).length,1);
  assert.doesNotMatch(deal,/officialDocumentWorkspaceHTML|deal-checklist-form|checklistItems/);
});

test('DEV222 approval checks every signed-document gate and closes all governed records atomically',()=>{
  const routes=read('src/routes/opportunities.js');
  assert.match(routes,/gateCodes:\['before_pending_approval','before_approval','before_close_won'\]/);
  assert.match(routes,/Complete the signed transaction documents before approval: \$\{describeDocumentComplianceBlockers/);
  assert.match(routes,/async function approveAndCloseDealWon/);
  assert.match(routes,/UPDATE deals SET status='closed_won'/);
  assert.match(routes,/UPDATE bookings SET status='completed'/);
  assert.match(routes,/UPDATE opportunities SET stage='Closed Won'/);
  assert.match(routes,/closure_approved_and_closed_won/);
  assert.match(routes,/atomic:true/);
});

test('DEV222 approval UI is one business decision and retains legacy recovery only',()=>{
  const ui=read('public/deal-ui.js');
  assert.match(ui,/Approve and close Deal as Won/);
  assert.match(ui,/Record approval and close Deal as Won/);
  assert.match(ui,/new approvals close atomically/);
  assert.doesNotMatch(ui,/Required transaction documents[\s\S]*Documents needed for this step/);
});
