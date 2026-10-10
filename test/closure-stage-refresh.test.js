import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=app.indexOf("  for(const button of flowButtons)button.addEventListener('click',async()=>{");
const end=app.indexOf("  stagePage?.querySelectorAll('[data-stage-back]')",start);
const source=app.slice(start,end);
test('opening Closure Steps reloads Opportunity instead of redisplaying cached readiness',async()=>{
 let handler,reads=0,closed=0,removed=0;const button={dataset:{flowStep:'deal'},addEventListener:(_,fn)=>handler=fn};
 vm.runInNewContext(source,{flowButtons:[button],closeStagePage:()=>closed++,o:{remove:()=>removed++},openOpportunityDetail:async(id,options)=>{reads++;assert.equal(id,'synthetic');assert.equal(options.resumeStage,'deal');},id:'synthetic',toast:()=>{},showFlowStep:()=>assert.fail('cached closure pane reused')});
 await handler();await handler();assert.equal(reads,2);assert.equal(closed,2);assert.equal(removed,2);assert.equal(button.disabled,false);
});
test('other stages retain their existing navigation',async()=>{
 let handler,shown;const button={dataset:{flowStep:'offer'},addEventListener:(_,fn)=>handler=fn};vm.runInNewContext(source,{flowButtons:[button],showFlowStep:step=>shown=step});await handler();assert.equal(shown,'offer');
});
