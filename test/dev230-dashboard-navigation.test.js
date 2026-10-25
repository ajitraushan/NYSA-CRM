import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),start=source.indexOf('async function renderCrmDashboard('),end=source.indexOf('\nasync function ',start+10),dashboardCode=source.slice(start,end);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const payload=label=>({calculationContext:label,dataAsOf:'2026-10-26',filters:{dateFrom:'2026-10-01',dateTo:'2026-10-26'},kpis:[],stages:[],sources:[],teams:[],agents:[],tasks:[],exceptions:{},proposals:{},qualification:{hot:0,warm:0},calls:{total:0,durationSeconds:0,followUpRequired:0},inventory:{available:0,stale:0,mediaNotReady:0},hierarchy:{company:'Synthetic company',businessLines:[]},recentActivities:[]});
function harness(){
 let nodes=new Map(),renders=0;const calls=[],bound=[];
 const node=selector=>({isConnected:true,innerHTML:'',textContent:'',addEventListener:event=>bound.push([renders,selector,event])});
 const view={set innerHTML(html){for(const n of nodes.values())n.isConnected=false;nodes=new Map();for(const [,id]of html.matchAll(/id="([^"]+)"/g))nodes.set('#'+id,node('#'+id));renders++;}};
 const context={Date,URLSearchParams,FormData:class{constructor(){return new Map();}},ME:{jobRole:'manager'},LEAD_SOURCES:[],BUSINESS_TYPES:[],LEAD_STAGES:[],esc:x=>String(x??''),fmtDate:x=>x,fmtMinutesFromSeconds:x=>x,document:{querySelectorAll:()=>[]},$:selector=>selector==='#view'?view:nodes.get(selector)||null,api:path=>{const d=deferred();calls.push({path,...d});return d.promise;}};
 vm.createContext(context);vm.runInContext(dashboardCode,context);
 return{context,calls,bound,get:selector=>nodes.get(selector),navigate(){for(const n of nodes.values())n.isConnected=false;nodes=new Map([['#other-workflow',node('#other-workflow')]]);},render:()=>context.renderCrmDashboard()};
}
const settleStaff=async(h,offset=0)=>{h.calls[offset].resolve({teams:[]});h.calls[offset+1].resolve({staff:[]});await tick();};

test('DEV230 exits safely when navigating away before staff responses succeed',async()=>{
 const h=harness(),run=h.render();h.navigate();await settleStaff(h);await run;
 assert.equal(h.calls.length,2,'Do not start dashboard requests for an obsolete page');assert.ok(h.get('#other-workflow'));assert.equal(h.bound.length,0);
});
test('DEV230 exits safely when staff requests reject after navigation',async()=>{
 const h=harness(),run=h.render();h.navigate();h.calls[0].reject(new Error('Synthetic request failure'));h.calls[1].resolve({staff:[]});await run;assert.equal(h.calls.length,2);assert.equal(h.bound.length,0);
});
for(const reject of [false,true])test(`DEV230 ignores late dashboard ${reject?'failure':'success'} after navigation`,async()=>{
 const h=harness(),run=h.render();await settleStaff(h);assert.equal(h.calls.length,4);h.navigate();
 if(reject)h.calls[2].reject(new Error('Synthetic dashboard failure'));else h.calls[2].resolve(payload('Old result'));
 h.calls[3].resolve({views:[]});await run;assert.ok(h.get('#other-workflow'));assert.equal(h.bound.length,0);
});
test('DEV230 older dashboard cannot overwrite a newer render with the same element IDs',async()=>{
 const h=harness(),old=h.render();await settleStaff(h);const current=h.render();await settleStaff(h,4);
 h.calls[6].resolve(payload('Newest result'));h.calls[7].resolve({views:[]});await current;
 const handlers=h.bound.length;assert.equal(h.get('#dashboard-context').textContent,'Newest result');
 h.calls[2].resolve(payload('Stale result'));h.calls[3].resolve({views:[{name:'Old saved view'}]});await old;
 assert.equal(h.get('#dashboard-context').textContent,'Newest result');assert.equal(h.bound.length,handlers,'Stale request must not attach duplicate handlers');assert.doesNotMatch(h.get('#dashboard-saved-view').innerHTML,/Old saved view/);
});
test('DEV230 current dashboard still renders and binds filters, saved views and export',async()=>{
 const h=harness(),run=h.render();await settleStaff(h);h.calls[2].resolve(payload('Current result'));h.calls[3].resolve({views:[{name:'Synthetic saved view'}]});await run;
 assert.equal(h.get('#dashboard-context').textContent,'Current result');assert.match(h.get('#dashboard-saved-view').innerHTML,/Synthetic saved view/);assert.ok(h.bound.some(([,selector,event])=>selector==='#dashboard-filters'&&event==='submit'));assert.match(h.get('#dashboard-export').href,/\/api\/crm\/dashboard\/export/);
});
test('DEV230 current dashboard errors remain visible and do not bind incomplete controls',async()=>{
 const h=harness(),run=h.render();await settleStaff(h);h.calls[2].reject(new Error('Synthetic service unavailable'));h.calls[3].resolve({views:[]});await run;
 assert.equal(h.get('#dashboard-kpis').textContent,'Synthetic service unavailable');assert.equal(h.bound.length,0);
});
