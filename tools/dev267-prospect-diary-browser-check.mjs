import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const evidenceDir=path.resolve(process.argv[2]||path.join(os.tmpdir(),'nysa-dev267-browser'));
const releaseRoot=path.resolve(process.argv[3]||process.cwd());
const releaseFile=path.join(releaseRoot,'public','prospect-diary-ui.js');
const featureStyle=path.join(releaseRoot,'public','prospect-diary.css');
const designStyle=path.join(releaseRoot,'public','ui-design-system.css');
const indexSource=await fs.readFile(path.join(releaseRoot,'public','index.html'),'utf8');
const baseStyle=[...indexSource.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
const releaseSource=await fs.readFile(releaseFile);
const releaseSha256=crypto.createHash('sha256').update(releaseSource).digest('hex');
const executablePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':await chromium.executablePath());

await fs.rm(evidenceDir,{recursive:true,force:true});
await fs.mkdir(evidenceDir,{recursive:true});
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--disable-gpu','--no-first-run','--disable-background-networking']});
const results=[];
try{
  for(const role of ['sales_agent','manager','director']){
    const page=await browser.newPage(),pageErrors=[],consoleErrors=[];
    await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
    page.on('pageerror',error=>pageErrors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
    await page.setRequestInterception(true);
    page.on('request',request=>request.respond({status:200,contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body><main class="main" style="height:900px;overflow:auto"><div id="view"></div></main></body></html>`}));
    await page.goto(`https://dev267-${role}.example.invalid/`,{waitUntil:'domcontentloaded'});
    await page.addStyleTag({path:designStyle});
    await page.addStyleTag({path:featureStyle});
    await page.evaluate(currentRole=>{
      const prospectId='00000001-0000-4000-8000-000000000267';
      const actorId=currentRole==='sales_agent'?'00000002-0000-4000-8000-000000000267':currentRole==='manager'?'00000003-0000-4000-8000-000000000267':'00000004-0000-4000-8000-000000000267';
      const ownerId=currentRole==='sales_agent'?actorId:'00000002-0000-4000-8000-000000000267';
      const prospect={id:prospectId,displayName:'Synthetic Prospect 267',phone:'+971509999267',email:'dev267@example.invalid',source:'cold_call',briefNotes:'Synthetic browser evidence',status:'call_back',ownerId,ownerName:'Synthetic Agent',teamName:'Synthetic Secondary Sales',lastContactAt:'2026-11-10T08:00:00.000Z',lastOutcome:'callback_requested',nextActionId:'00000005-0000-4000-8000-000000000267',nextActionSubject:'Call after lunch',nextActionDueAt:'2026-11-11T09:00:00.000Z'};
      const list={summary:{total:1,today:1,overdue:0,upcoming:1,interested:0,doNotContact:0},prospects:[prospect],agents:currentRole==='sales_agent'?[]:[{id:ownerId,name:'Synthetic Agent',jobRole:'sales_agent'}],canManage:currentRole!=='sales_agent'};
      const detail={prospect,canManage:currentRole!=='sales_agent',canOperate:true,activities:[{id:'a1',activityType:'call',direction:'outbound',outcome:'no_answer',notes:'First call',occurredAt:'2026-11-10T07:00:00.000Z',createdByName:'Synthetic Agent'},{id:'a2',activityType:'call',direction:'outbound',outcome:'callback_requested',notes:'Second call',occurredAt:'2026-11-10T08:00:00.000Z',createdByName:'Synthetic Agent'}],followUps:[{id:'f1',subject:'First follow-up',details:'Earlier history',assigneeName:'Synthetic Agent',status:'completed',isNextAction:false,dueAt:'2026-11-10T09:00:00.000Z'},{id:'f2',subject:'Call after lunch',details:'Current next action',assigneeName:'Synthetic Agent',status:'open',isNextAction:true,dueAt:'2026-11-11T09:00:00.000Z'}]};
      const root=document.querySelector('#view'),main=document.querySelector('main');
      window.__restores=[];
      window.__apiCalls=[];
      const api=async(url,options={})=>{window.__apiCalls.push({url,method:options.method||'GET'});if(url.startsWith('/crm/prospects?'))return list;if(url===`/crm/prospects/${prospectId}`)return detail;throw new Error(`Unexpected browser-check request: ${options.method||'GET'} ${url}`);};
      const openRecord=(html,{type,id,returnTab})=>{
        const previous=document.createDocumentFragment(),scrollTop=main.scrollTop;while(root.firstChild)previous.append(root.firstChild);
        const host=document.createElement('section');host.className='record-workspace';host.innerHTML=html;root.append(host);main.scrollTop=0;
        const nativeRemove=host.remove.bind(host);
        const restore=()=>{if(!host.isConnected)return;nativeRemove();root.append(previous);main.scrollTop=scrollTop;window.__restores.push({type,id,returnTab,scrollTop});};
        host.querySelector('.close-x')?.addEventListener('click',()=>history.back());
        window.addEventListener('popstate',restore,{once:true});
        history.pushState({type,id},'',`?workspace=${type}&record=${id}`);
        host.remove=restore;
        return host;
      };
      window.__context={root,api,escape:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),actor:{id:actorId,jobRole:currentRole},toast:()=>{},openRecord,openCustomer:()=>{},startLead:()=>{}};
    },role);
    await page.addScriptTag({path:releaseFile});
    await page.evaluate(()=>window.renderProspectDiary(window.__context));
    await page.waitForSelector('[data-prospect]');
    assert.equal(await page.$eval('[data-prospect-filters] input[name="q"]',input=>input.value),'');
    await page.type('[data-prospect-filters] input[name="q"]','Synthetic');
    await Promise.all([page.click('[data-prospect-filters] button'),page.waitForFunction(()=>document.querySelector('[data-prospect-filters] input[name="q"]')?.value==='Synthetic')]);
    const expectedScroll=await page.evaluate(()=>{const main=document.querySelector('main');main.scrollTop=175;return main.scrollTop;});
    await page.click('[data-prospect]');
    await page.waitForSelector('.record-workspace [data-prospect-detail]');
    await new Promise(resolve=>setTimeout(resolve,250));
    const loaded=await page.evaluate(()=>({activities:document.querySelectorAll('.record-workspace .prospect-event').length,followUps:document.querySelectorAll('.record-workspace .prospect-follow-up').length,detail:document.querySelector('.record-workspace [data-prospect-detail]')?.textContent||'',calls:window.__apiCalls}));
    assert.equal(loaded.activities,2,JSON.stringify({loaded,pageErrors,consoleErrors}));
    assert.equal(loaded.followUps,2,JSON.stringify({loaded,pageErrors,consoleErrors}));
    const detailState=await page.evaluate(()=>({activities:document.querySelectorAll('.prospect-event').length,followUps:document.querySelectorAll('.prospect-follow-up').length,reassign:Boolean(document.querySelector('[data-reassign-form]')),conversion:Boolean(document.querySelector('[data-check-conversion]')),url:location.search}));
    assert.equal(detailState.activities,2);assert.equal(detailState.followUps,2);assert.equal(detailState.reassign,role!=='sales_agent');assert.equal(detailState.conversion,role==='sales_agent');assert.match(detailState.url,/workspace=prospect/);
    await page.click('.record-workspace .close-x');
    await page.waitForSelector('[data-prospect]');
    const restored=await page.evaluate(()=>({q:document.querySelector('[data-prospect-filters] input[name="q"]')?.value,scroll:document.querySelector('main').scrollTop,restores:window.__restores.length}));
    assert.equal(restored.q,'Synthetic');assert.equal(restored.scroll,expectedScroll);assert.equal(restored.restores,1);
    await page.setViewport({width:390,height:844,deviceScaleFactor:1});
    const mobile=await page.evaluate(()=>({bodyWidth:document.body.scrollWidth,viewport:innerWidth,cardWidth:document.querySelector('.prospect-card').getBoundingClientRect().width,buttonLabels:[...document.querySelectorAll('button')].map(button=>button.textContent.trim()).filter(Boolean)}));
    assert.ok(mobile.bodyWidth<=mobile.viewport+1,JSON.stringify(mobile));assert.ok(mobile.cardWidth<=mobile.viewport);assert.ok(mobile.buttonLabels.every(label=>label.length>1));
    assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);
    const screenshot=path.join(evidenceDir,`${role}-mobile.png`);await page.screenshot({path:screenshot,fullPage:true});
    results.push({role,status:'passed',detailState,restored,mobile,pageErrors,consoleErrors,screenshot:path.basename(screenshot)});
    await page.close();
  }
  const evidence={schema:'nysa.dev267.prospect-diary-browser.v1',synthetic:true,releaseRoot,releaseFile:path.relative(releaseRoot,releaseFile).replaceAll('\\','/'),releaseSha256,loadedFromActualReleaseFile:true,roles:results,checkedAt:new Date().toISOString()};
  await fs.writeFile(path.join(evidenceDir,'DEV267_BROWSER_RESULT.json'),`${JSON.stringify(evidence,null,2)}\n`);
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}finally{
  await browser.close();
}
