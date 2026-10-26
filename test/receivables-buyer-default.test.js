import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/receivables-ui.js',import.meta.url),'utf8');
async function run(context,{editWhileLoading=false}={}){
 const start=source.indexOf('form.elements.opportunityId.onchange=async()=>{'),end=source.indexOf('\n      const lookup=',start);
 const elements={opportunityId:{value:'synthetic-opportunity'},payerType:{value:'customer'},payerId:{innerHTML:'Select a payer'},'payer-query':{value:''},commissionAmount:{value:''}};
 const status={textContent:''},target={textContent:'',innerHTML:''},form={elements,dataset:{},querySelector:()=>status};
 const sandbox={form,editor:{querySelector:()=>target},contextSequence:0,payerRevision:0,safe:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),money:v=>String(v),preview:()=>{}};
 sandbox.api=async()=>{if(editWhileLoading){sandbox.payerRevision++;elements.payerType.value='agency';elements.payerId.innerHTML='Manually selected agency';}return{context:{opportunityReference:'SYNTHETIC',currency:'AED',scheduledCommissionCents:0,...context}};};
 vm.createContext(sandbox);vm.runInContext(source.slice(start,end),sandbox);await elements.opportunityId.onchange();return{elements,status};
}
test('Closed Won invoice defaults the linked maintained buyer and escapes its label',async()=>{
 const {elements}=await run({stage:'Closed Won',dealStatus:'closed_won',customerId:'synthetic-buyer',customerName:'Buyer <Test>',agreedGrossCommission:100});
 assert.equal(elements.payerType.value,'customer');assert.match(elements.payerId.innerHTML,/value="synthetic-buyer"/);assert.match(elements.payerId.innerHTML,/Buyer &lt;Test>/);assert.equal(elements.commissionAmount.value,'100.00');
});
test('off-plan uses Developer rather than the buyer',async()=>{
 const {elements}=await run({stage:'Closed Won',dealStatus:'closed_won',dealType:'off_plan',customerId:'buyer',customerName:'Test Buyer'});assert.equal(elements.payerType.value,'developer');assert.doesNotMatch(elements.payerId.innerHTML,/value="buyer"/);
});
test('late context preserves a manual payer choice',async()=>{
 const {elements}=await run({stage:'Closed Won',dealStatus:'closed_won',customerId:'buyer',customerName:'Test Buyer'},{editWhileLoading:true});assert.equal(elements.payerType.value,'agency');assert.equal(elements.payerId.innerHTML,'Manually selected agency');
});
