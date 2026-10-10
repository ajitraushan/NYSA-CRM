import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/shared-review-panel.js',import.meta.url),'utf8');
test('shared review presentation decorates every registered screen idempotently without replacing forms',()=>{
 const forms=new Map();let observer;
 const document={body:{},createElement:()=>({}),querySelectorAll:selector=>{
   if(!forms.has(selector)){const classes=new Set();const details=selector.includes('data-compliance-review')?{classList:{add:c=>classes.add(c)},querySelector:()=>({classList:{add:c=>classes.add(c)}})}:null;
   forms.set(selector,{dataset:{},classList:{add:c=>classes.add(c)},closest:()=>details,prepend(h){this.headings.push(h);},headings:[],classes,details,onsubmit:()=>{}});}
   return[forms.get(selector)];
 }};
 const context={window:{},document,MutationObserver:class{constructor(fn){observer=fn;}observe(){}}};
 vm.runInNewContext(source,context);
 assert.equal(forms.size,15);
 const handlers=[...forms.values()].map(f=>f.onsubmit);
 context.window.NysaReviewPanel.apply();
 for(const [i,form] of [...forms.values()].entries()){
   assert.equal(form.onsubmit,handlers[i]);assert.equal(form.dataset.reviewPanelApplied,'true');assert.ok(form.classes.has('review-action-panel'));
   if(form.details)assert.equal(form.details.open,true);else assert.equal(form.headings.length,1);
 }
 const dynamicallyAdded={nodeType:1,querySelectorAll:document.querySelectorAll};observer([{addedNodes:[dynamicallyAdded]}]);
 for(const form of forms.values())assert.ok(form.headings.length<=1);
});
