import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/routes/dashboards.js',import.meta.url),'utf8'),start=source.indexOf('function dashboardRecordResult('),end=source.indexOf('\nasync function ',start),context={};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
for(const [count,query,page,size,length]of [[0,{},1,100,0],[505,{},1,100,100],[505,{page:'6'},6,100,5],[505,{page:'999'},6,100,5],[505,{page:'-2',pageSize:'900'},1,500,500],[505,{pageSize:'invalid'},1,100,100]])test(`Dashboard pagination retains total ${count} with ${JSON.stringify(query)}`,()=>{
 const records=Array.from({length:count},(_,id)=>({id})),result=context.dashboardRecordResult({query},{entityType:'lead',filters:{source:'Website'},records});
 assert.equal(result.count,count);assert.equal(result.page,page);assert.equal(result.pageSize,size);assert.equal(result.records.length,length);assert.equal(result.records[0]?.id,length?(page-1)*size:undefined);assert.equal(records.length,count,'Source snapshot is not truncated');assert.equal(result.filters.source,'Website');
});
