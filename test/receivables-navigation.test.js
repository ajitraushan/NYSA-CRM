import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('Accountant dashboard Receivables navigation invokes the receivables renderer',()=>{
 const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),start=app.indexOf('function switchTab(tab) {'),end=app.indexOf('\n}',start)+2;let rendered=0;
 const context={ME:{jobRole:'accountant'},window:{accountantTabAllowed:()=>true,renderCommissionReceivables:()=>rendered++},document:{querySelectorAll:()=>[]},currentTab:'dashboard'};
 vm.runInNewContext(app.slice(start,end),context);context.switchTab('receivables');assert.equal(rendered,1);assert.equal(context.currentTab,'receivables');
});
