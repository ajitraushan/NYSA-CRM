import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),start=source.indexOf('async function renderCrmDashboard('),end=source.indexOf('\nasync function ',start+10),dashboardCode=source.slice(start,end);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const payload=label=>({calculationContext:label,dataAsOf:'2026-10-26',filters:{dateFrom:'2026-10-01',dateTo:'2026-10-26'},kpis:[],stages:[],sources:[],teams:[],agents:[],tasks:{open:3,completed:7},exceptions:{},proposals:{},qualification:{hot:0,warm:0},calls:{total:0,durationSeconds:0,followUpRequired:0},inventory:{available:0,stale:0,mediaNotReady:0},hierarchy:{company:'Synthetic company',businessLines:[]},recentActivities:[]});
function harness(){
 let nodes=new Map(),renders=0;const calls=[],bound=[],summaryButtons=[],kpiButtons=[],drilldowns=[];let detailHtml='';
 const node=selector=>({isConnected:true,innerHTML:'',textContent:'',addEventListener:event=>bound.push([renders,selector,event])});
 const view={set innerHTML(html){for(const n of nodes.values())n.isConnected=false;nodes=new Map();for(const [,id]of html.matchAll(/id="([^"]+)"/g))nodes.set('#'+id,node('#'+id));renders++;}};
 const context={Date,URLSearchParams,FormData:class{constructor(){return new Map();}},ME:{jobRole:'manager'},LEAD_SOURCES:[],BUSINESS_TYPES:[],LEAD_STAGES:[],esc:x=>String(x??''),fmtDate:x=>x,fmtMinutesFromSeconds:x=>x,openDashboardRecords:(...args)=>drilldowns.push(args),document:{querySelectorAll:selector=>selector==='[data-dashboard-segment]'?[...nodes.get('#dashboard-kpis').innerHTML.matchAll(/data-dashboard-segment="([^"]+)"/g)].map(match=>{const button={dataset:{dashboardSegment:match[1]},addEventListener:(event,handler)=>button.click=handler};kpiButtons.push(button);return button;}):selector==='[data-dashboard-summary]'?[...nodes.get('#dashboard-body').innerHTML.matchAll(/data-dashboard-summary="(\d+)"/g)].map(match=>{const button={dataset:{dashboardSummary:match[1]},addEventListener:(event,handler)=>button.click=handler};summaryButtons.push(button);return button;}):[]},overlay:html=>{detailHtml=html;return{querySelectorAll:()=>[],remove(){}}},$:selector=>selector==='#view'?view:nodes.get(selector)||null,api:path=>{const d=deferred();calls.push({path,...d});return d.promise;}};
 vm.createContext(context);vm.runInContext(dashboardCode,context);
 return{context,calls,bound,summaryButtons,kpiButtons,drilldowns,getDetail:()=>detailHtml,get:selector=>nodes.get(selector),navigate(){for(const n of nodes.values())n.isConnected=false;nodes=new Map([['#other-workflow',node('#other-workflow')]]);},render:()=>context.renderCrmDashboard()};
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

for(const tasks of [{open:3,in_progress:2,completed:7},[{label:'open',value:3},{label:'completed',value:7}]])test('Dashboard task summary accepts existing API totals and historical row arrays without changing counts',async()=>{
 const h=harness(),run=h.render();await settleStaff(h);h.calls[2].resolve({...payload('Task summary'),tasks});h.calls[3].resolve({views:[]});await run;
 h.summaryButtons.find(button=>{button.click();return h.getDetail().includes('<h3>Task status</h3>');});const html=h.getDetail();assert.match(html,/<td>open<\/td><td>3<\/td>/);assert.match(html,/<td>completed<\/td><td>7<\/td>/);assert.ok(h.get('#dashboard-export').href);
});

for(const role of ['sales_agent','manager','director'])test(`Only the six requested summary panels are removed for ${role}`,async()=>{
 const h=harness();h.context.ME.jobRole=role;const run=h.render();await settleStaff(h);
 const data=payload('Role scope');data.kpis=[{code:'overdue',label:'Overdue tasks',current:1,unit:'tasks',target:null,definition:'Synthetic overdue tasks'}];
 h.calls[2].resolve(data);h.calls[3].resolve({views:[]});await run;
 const html=h.get('#dashboard-body').innerHTML;
 for(const title of ['Lead stages','Source quality','Team workload','Agent workload','Task status','Data, consent & integration exceptions'])assert.equal(html.includes(`<h3>${title}</h3>`),false,title);
 if(role!=='sales_agent'){assert.ok(h.summaryButtons.length>6);h.summaryButtons[0].click();assert.match(h.getDetail(),/<h3>Lead stages<\/h3>/);}
 assert.match(h.get('#dashboard-kpis').innerHTML,/Overdue tasks/);h.kpiButtons[0].click();assert.equal(h.drilldowns[0][0],'overdue');
 assert.ok(html.includes('Proposal workload'));assert.ok(html.includes('Inventory readiness'));if(role!=='sales_agent')assert.match(html,/data-dashboard-summary=/);
 assert.ok(h.get('#dashboard-export').href);
});
