import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/commission-payout-ui.js',import.meta.url),'utf8');
async function render({jobRole='accountant',recorded=false,confirmed=false,frozen=true,credit=false}={}){
  const deal={id:'synthetic-deal',status:'approved',agreedValue:1000000,currency:'AED'};
  const data={deal,expectations:frozen?[{status:'frozen',expectedCompanyReceipt:20000,currency:'AED'}]:[],
    receipts:recorded?[{receiptReference:'SYNTHETIC',amount:20000,currency:'AED',receivedDate:'2026-09-03'}]:[],
    confirmations:confirmed?[{status:'confirmed',confirmedActualReceived:20000,varianceAmount:0,currency:'AED',receiptDate:'2026-09-03'}]:[],
    credits:credit?[{status:'frozen'}]:[]};
  let finished;
  const loaded=new Promise(resolve=>{finished=resolve;}),calls=[];
  const target={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[],dispatchEvent:()=>finished()};
  const window={},context={window,ME:{role:'internal_broker',jobRole},esc:v=>String(v??''),CSS:{escape:String},
    CustomEvent:class{},api:async path=>{calls.push(path);return path.endsWith('/commission-proofs')?{canUpload:true,proofs:[]}:data;}};
  vm.runInNewContext(source,context);
  const header=window.dealCommissionWorkspaceHTML({deal,writable:false});
  window.bindDealCommissionWorkspace({querySelector:()=>({querySelector:()=>target})},{dealId:deal.id,writable:false});
  await loaded;
  return{html:header+target.innerHTML,calls};
}

for(const sample of [
  {label:'Not recorded',recorded:false,confirmed:false},
  {label:'Awaiting confirmation',recorded:true,confirmed:false},
  {label:'Confirmed',recorded:true,confirmed:true,credit:true}
])test(`Accountant receipt screen: ${sample.label}, no closure or payout wording`,async()=>{
  const {html,calls}=await render(sample);
  assert.match(html,new RegExp(`Receipt status: ${sample.label}`));
  assert.doesNotMatch(html,/close won|closed won|closure|prerequisite|director payout|director-only payout|blocks/i);
  assert.match(html,/Upload commission proof/);
  assert.match(html,/Record immutable receipt/);
  assert.equal(html.includes('data-confirm-receipt'),sample.recorded&&!sample.confirmed);
  if(sample.recorded&&!sample.confirmed)assert.match(html,/>Confirm actual receipt<\/button>/);
  assert.deepEqual(calls,['/crm/deals/synthetic-deal/commission','/crm/deals/synthetic-deal/commission-proofs']);
});
test('Accountant unfrozen expectation guidance does not imply closure authority',async()=>{
  const {html}=await render({recorded:true,frozen:false});
  assert.match(html,/Receipt status: Awaiting confirmation/);
  assert.match(html,/Ask the Agent or Manager/);
  assert.doesNotMatch(html,/data-confirm-receipt|Close Won blocked|data-commission-expectation/);
});
test('Director receipt view also separates collection from closure',async()=>{
  const {html}=await render({jobRole:'director',recorded:true});
  assert.match(html,/Receipt status: Awaiting confirmation/);
  assert.match(html,/>Confirm actual receipt<\/button>/);
  assert.doesNotMatch(html,/Close Won blocked|CLOSE WON GATE|for Close Won/);
});
test('Confirmed Director view reports receipt reconciliation, not closure readiness',async()=>{
  const {html}=await render({jobRole:'director',recorded:true,confirmed:true});
  assert.match(html,/Receipt status: Confirmed/);
  assert.match(html,/Actual company-account receipt has been reconciled/);
  assert.doesNotMatch(html,/prerequisite satisfied/);
});
