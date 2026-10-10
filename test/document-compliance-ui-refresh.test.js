import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/document-compliance-ui.js',import.meta.url),'utf8');
for(const parentRefresh of [true,false])test(`document acceptance refreshes ${parentRefresh?'parent closure readiness':'standalone register'}`,async()=>{
  let reads=0,refreshes=0,decision;
  const form={elements:{decision:{value:'accepted'},reason:{value:''},reviewConfirmation:{checked:true}},closest:()=>({dataset:{complianceEvidence:'synthetic-evidence'}})};
  const results={innerHTML:'',querySelectorAll:s=>s==='[data-compliance-review]'?[form]:[]};
  const workspace={querySelector:()=>results},root={querySelector:()=>workspace};
  const context={window:{},esc:String,fmtDate:String,ME:{jobRole:'manager'},CSS:{escape:String},MutationObserver:class{observe(){}},toast:()=>{},api:async(path,options)=>{if(options){decision=options.body.decision;return{};}reads++;return{snapshot:{id:'synthetic'},deal:{dealReference:'SYNTHETIC'},requirements:[]};}};
  vm.runInNewContext(source,context);
  context.window.bindDocumentComplianceWorkspace(root,{dealId:'synthetic',writable:true,...(parentRefresh?{onChanged:async()=>{refreshes++;}}:{})});
  await new Promise(resolve=>setImmediate(resolve));
  await form.onsubmit({preventDefault(){}});
  assert.equal(decision,'accepted');assert.equal(refreshes,parentRefresh?1:0);assert.equal(reads,parentRefresh?1:2);
});

test('register does not claim satisfied when authoritative closure gate has a hidden party blocker',async()=>{
 const results={innerHTML:'',querySelectorAll:()=>[]};
 const context={window:{},esc:String,fmtDate:String,ME:{jobRole:'manager'},CSS:{escape:String},MutationObserver:class{observe(){}},toast:()=>{},api:async()=>({snapshot:{id:'synthetic'},deal:{dealReference:'SYNTHETIC'},requirements:[{id:'offer',state:'accepted',label:'Synthetic offer',partyRole:'transaction',requirementLevel:'required',evidenceAuthority:'generic_document',satisfied:true,blocking:false}],closureReadiness:{canProceed:false,blocking:[{label:'Seller details required',state:'party_details_required',gateCode:'before_approval'}]}})};
 vm.runInNewContext(source,context);
 context.window.bindDocumentComplianceWorkspace({querySelector:()=>({querySelector:()=>results})},{dealId:'synthetic',writable:false});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(results.innerHTML,/Signed documents still required/);assert.match(results.innerHTML,/Seller details required/);assert.match(results.innerHTML,/maintained Customer or Company/);assert.doesNotMatch(results.innerHTML,/Signed document requirements satisfied/);
});
