import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const evidenceDir=path.resolve(process.argv[2]||path.join(os.tmpdir(),'nysa-dev266-browser'));
const releaseRoot=path.resolve(process.argv[3]||process.cwd());
const releaseFile=path.join(releaseRoot,'public','whatsapp-workspace-ui.js');
const indexFile=path.join(releaseRoot,'public','index.html');
const designFile=path.join(releaseRoot,'public','ui-design-system.css');
const releaseSource=await fs.readFile(releaseFile);
const indexSource=await fs.readFile(indexFile,'utf8');
const baseStyle=[...indexSource.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
const releaseSha256=crypto.createHash('sha256').update(releaseSource).digest('hex');
const executablePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':await chromium.executablePath());

await fs.rm(evidenceDir,{recursive:true,force:true});
await fs.mkdir(evidenceDir,{recursive:true});
const userDataDir=await fs.mkdtemp(path.join(os.tmpdir(),'nysa-dev266-chrome-'));
const browser=await puppeteer.launch({executablePath,headless:true,userDataDir,args:['--no-sandbox','--disable-gpu','--no-first-run']});
const results=[];
try{
  for(const role of ['sales_agent','manager','director']){
    const page=await browser.newPage(),pageErrors=[],consoleErrors=[];
    await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
    page.on('pageerror',error=>pageErrors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body><main id="view" class="main"></main></body></html>`);
    await page.addStyleTag({path:designFile});
    await page.evaluate(currentRole=>{
      const id=value=>`${String(value).padStart(8,'0')}-0000-4000-8000-000000000000`;
      const actorId=currentRole==='sales_agent'?id(1):currentRole==='manager'?id(2):id(3);
      const conversationId=id(70),teamId=id(10),holderId=id(1);
      let released=false;
      window.ME={id:actorId,jobRole:currentRole,displayName:`Synthetic ${currentRole}`};
      window.$=selector=>document.querySelector(selector);
      window.fmtDate=value=>value?'10 Nov 2026, 12:30':'—';
      window.toast=()=>{};
      const workspace={
        teams:[{id:teamId,name:'Synthetic Secondary Sales'}],templates:[],materials:[],segments:[],batches:[],campaigns:[],
        conversations:[{id:conversationId,conversationReference:'WA-CON-DEV266',displayName:'Synthetic Prospect',lastMessage:'Synthetic inbound',ownerAgentName:'Synthetic Agent',teamName:'Synthetic Secondary Sales',responderMode:'human',replyWindowOpen:true,ctwaFreeWindowOpen:false,sourceType:'website',unreadCount:1,simulated:true}],
        reviewQueue:{templates:[],campaigns:[]},permissions:{canCreate:true,canReview:currentRole!=='sales_agent',canReassign:currentRole!=='sales_agent'},provider:{connected:false,submissionEnabled:false,sendingEnabled:true,simulated:true,status:'SIMULATED'}
      };
      const detail=()=>{
        const held=currentRole==='sales_agent'||!released;
        const heldByCurrent=held&&currentRole==='sales_agent';
        return{conversation:{id:conversationId,conversationReference:'WA-CON-DEV266',displayName:'Synthetic Prospect',ownerAgentName:'Synthetic Agent',ownerTeamId:teamId,teamName:'Synthetic Secondary Sales',responderMode:'human',replyWindowOpen:true,ctwaFreeWindowOpen:false,sourceType:'website',simulated:true,replyLockOwnerName:held?'Synthetic Agent until 10 Nov 2026, 12:30':'available',replyLock:{ownerId:held?holderId:null,ownerName:held?'Synthetic Agent':null,active:held,heldByCurrentUser:heldByCurrent,canRelease:heldByCurrent||held&&currentRole!=='sales_agent',canSend:!held||heldByCurrent,expiresAt:held?'2026-11-10T08:30:00.000Z':null,timeoutMinutes:30}},messages:[{id:id(80),direction:'inbound',messageType:'text',body:'Synthetic inbound',occurredAt:'2026-11-10T08:00:00.000Z',simulated:true}],agents:[],sendingEnabled:!held||heldByCurrent,simulationEnabled:true};
      };
      window.api=async(url,options={})=>{
        if(url==='/crm/whatsapp-workspace')return workspace;
        if(url===`/crm/whatsapp-workspace/conversations/${conversationId}`)return detail();
        if(url.endsWith('/reply-lock')&&options.body?.action==='release'){released=true;return{replyLock:{active:false,canSend:true,canRelease:true}};}
        if(url.endsWith('/simulated-send')){const error=new Error('Reply lock held by Synthetic Manager until 10 Nov 2026, 12:45');error.code='WHATSAPP_REPLY_LOCK_HELD';throw error;}
        throw new Error(`Unexpected synthetic request: ${url}`);
      };
    },role);
    await page.addScriptTag({path:releaseFile});
    await page.evaluate(()=>window.renderWhatsAppWorkspace());
    await page.click('[data-wa-section="inbox"]');
    await page.click('[data-conversation-open]');
    await page.waitForSelector('#wa-inbox-back');
    const initial=await page.evaluate(()=>({form:Boolean(document.querySelector('#wa-simulated-reply')),acquire:Boolean(document.querySelector('#wa-lock-acquire')),release:Boolean(document.querySelector('#wa-lock-release')),text:document.querySelector('#wa-workspace-panel')?.textContent||''}));
    if(role==='sales_agent'){
      assert.deepEqual({form:initial.form,acquire:initial.acquire,release:initial.release},{form:true,acquire:true,release:true});
    }else{
      assert.deepEqual({form:initial.form,acquire:initial.acquire,release:initial.release},{form:false,acquire:false,release:true});
      assert.match(initial.text,/Reply lock held by Synthetic Agent/);
      await page.click('#wa-lock-release');
      await page.waitForSelector('#wa-simulated-reply');
      await page.type('#wa-simulated-reply textarea','Synthetic stale-state send');
      await page.click('#wa-simulated-reply button[type="submit"],#wa-simulated-reply button:not([type])');
      await page.waitForFunction(()=>document.querySelector('#wa-action-error')?.textContent.includes('Reply lock held by Synthetic Manager'));
      assert.equal(await page.$eval('#wa-action-error',element=>getComputedStyle(element).display!=='none'&&element.getAttribute('role')==='alert'),true);
    }
    assert.deepEqual(pageErrors,[]);
    assert.deepEqual(consoleErrors,[]);
    const screenshot=path.join(evidenceDir,`${role}.png`);
    await page.screenshot({path:screenshot,fullPage:true});
    results.push({role,status:'passed',initial,screenshot:path.basename(screenshot),pageErrors,consoleErrors});
    await page.close();
  }
  const evidence={schema:'nysa.dev266.reply-lock-browser.v1',synthetic:true,releaseRoot,releaseFile:path.relative(releaseRoot,releaseFile).replaceAll('\\','/'),releaseSha256,loadedFromActualReleaseFile:true,roles:results,checkedAt:new Date().toISOString()};
  await fs.writeFile(path.join(evidenceDir,'DEV266_BROWSER_RESULT.json'),`${JSON.stringify(evidence,null,2)}\n`);
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}finally{
  await browser.close();
  await fs.rm(userDataDir,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
