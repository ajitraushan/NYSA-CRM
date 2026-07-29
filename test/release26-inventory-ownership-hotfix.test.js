import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('Inventory draft atomically captures owner, authority, agreement and responsible agent',()=>{
  const route=read('src/routes/listings.js'),ui=read('public/app.js'),migration=read('src/migrations/057_release26_inventory_ownership_capture.sql');
  for(const marker of ['responsible_agent_id','inventory_counterparties','inventory_agreements','ownerName','agreementEvidenceReference'])
    assert.match(route,new RegExp(marker));
  for(const label of ['Inventory ownership and authority','Owner / represented party name','Authority / mandate evidence','Responsible NYSA Inventory agent'])
    assert.match(ui,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(migration,/ALTER COLUMN responsible_agent_id SET NOT NULL/);
});

test('Opportunity seller-side inheritance remains linked to Inventory counterparty',()=>{
  const route=read('src/routes/transaction-representation.js');
  assert.match(route,/inventory_counterparties/);
  assert.match(route,/v\.sellerCounterpartyId=inherited\.id/);
});
