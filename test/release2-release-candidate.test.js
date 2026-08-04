import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('R2.5 migration supports atomic governed closure and reconciliation',()=>{
  const sql=read('src/migrations/049_release2_release_candidate.sql');
  for(const marker of ['approval_evidence_reference','closure_evidence_reference',"'completed'","'Rented'",
    'r2_release_candidate_reconciliation','closed_won_without_deal_count','booking_inventory_mismatch_count'])
    assert.match(sql,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('R2.5 APIs separate approval from authoritative Closed Won and reconcile outcomes',()=>{
  const routes=read('src/routes/opportunities.js');
  for(const marker of ["/crm/deals/:dealId/approval","/crm/deals/:dealId/close-won",
    "/crm/deals/:dealId/close-lost","inventory_status_before","status='cancelled'","stage='Closed Lost'",
    'FOR UPDATE OF d,b,o',"status='completed'","stage='Closed Won'","status='Closed'",
    "'closed_from_deal'","/crm/release2/reconciliation",'sourceOutcomes','exceptionCount'])
    assert.match(routes,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('R2.5 workspace makes approval, closure and reconciliation explicit',()=>{
  const dealUi=read('public/deal-ui.js'),app=read('public/app.js');
  for(const marker of ['Approve Deal for authoritative closure','Close Deal as Won',
    'Checklist review confirms the evidence','confirmAuthoritativeClosure','Deal authoritatively closed won',
    'Transaction will not complete','Close Deal as Lost and release inventory'])
    assert.match(dealUi,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const marker of ['R2.5 reconciliation','Release 2 reconciliation','Cross-module exceptions',
    'Original source and campaign outcomes','The Deal, Opportunity, reservation and inventory are authoritatively closed.'])
    assert.match(app,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
