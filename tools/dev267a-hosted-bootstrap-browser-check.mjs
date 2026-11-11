import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const evidenceDir=path.resolve(process.argv[2]||path.join(os.tmpdir(),'nysa-dev267a-bootstrap-browser'));
const releaseRoot=path.resolve(process.argv[3]||process.cwd());
const publicRoot=path.join(releaseRoot,'public');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const mime={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const prospectId='00000001-0000-4000-8000-000000000268';
let activeRole='sales_agent';
const requests=[];
const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));};
const actor=role=>({id:role==='sales_agent'?'00000002-0000-4000-8000-000000000268':'00000003-0000-4000-8000-000000000268',name:role==='sales_agent'?'Synthetic Agent':'Synthetic Manager',role:'internal_broker',jobRole:role,capabilities:[],accessPolicy:{label:role==='sales_agent'?'Sales Agent':'Manager',capabilities:[],workspaceTabs:['dashboard','prospectDiary'],dashboard:'crm'}});
const prospect=()=>({id:prospectId,displayName:'Synthetic Prospect 267A',phone:'+971509999268',email:'dev267a@example.invalid',source:'cold_call',briefNotes:'Hosted bootstrap browser evidence',status:'call_back',ownerId:'00000002-0000-4000-8000-000000000268',ownerName:'Synthetic Agent',teamName:'Synthetic Secondary Sales',lastContactAt:'2026-11-11T08:00:00.000Z',lastOutcome:'callback_requested',nextActionId:null,nextActionSubject:null,nextActionDueAt:null});
const dashboard={calculationContext:'Synthetic browser fixture',dataAsOf:'2026-11-11T08:00:00.000Z',filters:{dateFrom:'2026-10-13',dateTo:'2026-11-11'},kpis:[],stages:[],sources:[],teams:[],agents:[],tasks:[],exceptions:{},proposals:{},qualification:{hot:0,warm:0},calls:{total:0,durationSeconds:0,followUpRequired:0},inventory:{available:0,stale:0,mediaNotReady:0},hierarchy:{company:'Nysa Realty',businessLines:[]},recentActivities:[],dashboardType:'agent',unavailableMetrics:[]};

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  requests.push({role:activeRole,path:url.pathname,query:url.search});
  if(url.pathname==='/api/health')return json(res,200,{ok:true,version:'2.1.0-dev.268'});
  if(url.pathname==='/api/me')return json(res,200,actor(activeRole));
  if(url.pathname==='/api/crm/assignment-queue')return json(res,200,{leads:[]});
  if(url.pathname==='/api/crm/teams')return json(res,200,{teams:[]});
  if(url.pathname==='/api/crm/staff')return json(res,200,{staff:[]});
  if(url.pathname==='/api/crm/business-lines')return json(res,200,{businessLines:[]});
  if(url.pathname==='/api/crm/dashboard/views')return json(res,200,{views:[]});
  if(url.pathname==='/api/crm/dashboard')return json(res,200,dashboard);
  if(url.pathname==='/api/crm/prospects')return json(res,200,{summary:{total:1,today:1,overdue:0,upcoming:0,interested:0,doNotContact:0},prospects:[prospect()],agents:activeRole==='manager'?[{id:'00000002-0000-4000-8000-000000000268',name:'Synthetic Agent',jobRole:'sales_agent'}]:[],canManage:activeRole==='manager'});
  if(url.pathname.startsWith('/api/'))return json(res,404,{error:`Unexpected browser fixture API: ${url.pathname}`});
  const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
  const file=path.resolve(publicRoot,relative);
  if(file!==publicRoot&&!file.startsWith(`${publicRoot}${path.sep}`)){res.writeHead(403);return res.end('Forbidden');}
  try{const bytes=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}
});

await fs.rm(evidenceDir,{recursive:true,force:true});
await fs.mkdir(evidenceDir,{recursive:true});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));
const {port}=server.address();
const executablePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':await chromium.executablePath());
const browser=await puppeteer.launch({executablePath,headless:true,userDataDir:path.join(evidenceDir,'chrome-profile'),args:['--no-sandbox','--disable-gpu','--no-first-run','--disable-background-networking']});
const results=[];
try{
  for(const role of ['sales_agent','manager']){
    activeRole=role;
    const page=await browser.newPage(),pageErrors=[],consoleErrors=[];
    page.on('pageerror',error=>pageErrors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
    await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
    await page.goto(`http://127.0.0.1:${port}/?role=${role}`,{waitUntil:'networkidle0',timeout:60000});
    await page.waitForSelector('button[data-tab="prospectDiary"]',{timeout:30000});
    await page.click('button[data-tab="prospectDiary"]');
    await page.waitForSelector('[data-prospect]',{timeout:30000});
    const state=await page.evaluate(()=>({heading:document.querySelector('#view h2')?.textContent||'',cards:document.querySelectorAll('[data-prospect]').length,active:document.querySelector('button[data-tab="prospectDiary"]')?.classList.contains('active'),featureType:typeof window.renderProspectDiary,wrapperType:typeof window.renderProspectDiaryWorkspace,dashboardModuleType:typeof window.renderDashboardFeatureModule,legacyDashboardGlobalType:typeof window.renderCrmDashboard}));
    assert.equal(state.heading,'Prospect Diary');
    assert.equal(state.cards,1);
    assert.equal(state.active,true);
    assert.equal(state.featureType,'function');
    assert.equal(state.wrapperType,'function');
    assert.equal(state.dashboardModuleType,'function');
    assert.equal(state.legacyDashboardGlobalType,'function');
    assert.deepEqual(pageErrors,[]);
    assert.deepEqual(consoleErrors,[]);
    const screenshot=path.join(evidenceDir,`${role}-prospect-diary.png`);
    await page.screenshot({path:screenshot,fullPage:true});
    results.push({role,status:'passed',state,pageErrors,consoleErrors,screenshot:path.basename(screenshot)});
    await page.close();
  }
  const requestedScripts=requests.filter(item=>/\.(?:js|mjs)$/.test(item.path)).map(item=>item.path);
  const requiredOrder=['/bootstrap.js','/prospect-diary-ui.js','/dashboard-ui.js','/app.js'];
  const firstRoleRequests=requests.filter(item=>item.role==='sales_agent').map(item=>item.path);
  for(const file of requiredOrder)assert.ok(firstRoleRequests.includes(file),`${file} was not requested through hosted bootstrap`);
  assert.ok(firstRoleRequests.indexOf('/bootstrap.js')<firstRoleRequests.indexOf('/prospect-diary-ui.js'));
  assert.ok(firstRoleRequests.indexOf('/prospect-diary-ui.js')<firstRoleRequests.indexOf('/app.js'));
  assert.ok(firstRoleRequests.indexOf('/dashboard-ui.js')<firstRoleRequests.indexOf('/app.js'));
  const files={};
  for(const file of requiredOrder)files[file.slice(1)]={sha256:sha256(await fs.readFile(path.join(publicRoot,file.slice(1))))};
  const evidence={schema:'nysa.dev267a.hosted-bootstrap-browser.v1',synthetic:true,version:'2.1.0-dev.268',releaseRoot,loadedThroughActualIndexAndBootstrap:true,requiredOrder,files,requestedScripts:[...new Set(requestedScripts)],roles:results,checkedAt:new Date().toISOString()};
  await fs.writeFile(path.join(evidenceDir,'DEV267A_HOSTED_BOOTSTRAP_BROWSER_RESULT.json'),`${JSON.stringify(evidence,null,2)}\n`);
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
