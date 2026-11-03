import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const root=process.cwd();
const releaseFile=path.resolve(root,'public/whatsapp-workspace-ui.js');
const evidenceDir=path.resolve(process.argv[2]||path.join(os.tmpdir(),'nysa-dev261-agent-browser'));
const releaseSource=await fs.readFile(releaseFile);
const indexSource=await fs.readFile(path.resolve(root,'public/index.html'),'utf8');
const baseStyle=[...indexSource.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
const releaseSha256=crypto.createHash('sha256').update(releaseSource).digest('hex');
const windowsChrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const executablePath=process.env.CHROME_PATH||(process.platform==='win32'?windowsChrome:await chromium.executablePath());
const sections=[
  ['templates','Template library'],
  ['recipients','Recipient import'],
  ['segments','Reusable audience segments'],
  ['campaigns','Draft-only campaign composer'],
  ['inbox','Conversation inbox'],
  ['materials','Materials catalogue']
];

await fs.rm(evidenceDir,{recursive:true,force:true});
await fs.mkdir(evidenceDir,{recursive:true});
const userDataDir=await fs.mkdtemp(path.join(os.tmpdir(),'nysa-dev261-chrome-'));

const browser=await puppeteer.launch({executablePath,headless:true,userDataDir,args:['--no-sandbox','--disable-gpu','--no-first-run']});
const consoleErrors=[];
const pageErrors=[];
const results=[];
try{
  const page=await browser.newPage();
  await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('dialog',dialog=>void dialog.accept());
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>DEV263 Agent workspace check</title><style>${baseStyle}</style></head><body><main id="view" class="main"></main></body></html>`);
  await page.addStyleTag({path:path.resolve(root,'public/ui-design-system.css')});
  await page.evaluate(()=>{
    const id=value=>`${String(value).padStart(8,'0')}-0000-4000-8000-000000000000`;
    window.__DEV262_AGENT_FIXTURE__=true;
    window.ME={id:id(1),jobRole:'sales_agent',displayName:'Synthetic Agent'};
    window.$=selector=>document.querySelector(selector);
    window.fmtDate=value=>value?'2 Nov 2026':'—';
    window.toast=()=>{};
    window.__DEV263_FAULTS__=[
      'Simulated provider timeout',
      'Simulated provider rate limit',
      'Simulated provider server error',
      'Simulated provider rejected the recipient number',
      'Simulated provider response did not contain a message id',
      'Simulated template is paused'
    ];
    window.__DEV263_FAULT_CALLS__=[];
    window.api=async url=>{
      if(url.includes('/simulated-submit')){
        const message=window.__DEV263_FAULTS__[window.__DEV263_FAULT_CALLS__.length];
        if(!message)throw new Error('Unexpected duplicate simulator submission');
        window.__DEV263_FAULT_CALLS__.push(message);
        throw new Error(message);
      }
      if(url!=='/crm/whatsapp-workspace')throw new Error(`Unexpected synthetic request: ${url}`);
      return {
        teams:[{id:id(10),name:'Synthetic Secondary Sales'}],
        templates:[{id:id(20),versionId:id(21),templateReference:'WA-TPL-SYNTH',name:'synthetic_launch',ownerTeamId:id(10),teamName:'Synthetic Secondary Sales',versionNumber:1,languageCode:'en',category:'marketing',headerType:'none',bodyText:'Hello {{first_name}}',footerText:'Reply STOP to opt out',variableNames:['first_name'],variableSamples:{first_name:'Amina'},buttons:[{type:'quick_reply',text:'Stop promotions'}],internalStatus:'approved',simulatedProviderStatus:'not_submitted',metaStatus:'not_submitted',metaStatusLabel:'Not submitted',preparedByName:'Synthetic Agent'}],
        materials:[{id:id(30),materialReference:'WA-MAT-SYNTH',title:'Synthetic brochure',materialType:'brochure',ownerTeamId:id(10),teamName:'Synthetic Secondary Sales',status:'active',createdByName:'Synthetic Agent'}],
        segments:[{id:id(40),name:'Synthetic audience',description:'Synthetic verified recipients',definition:{consentStatus:'verified'},ownerTeamId:id(10),teamName:'Synthetic Secondary Sales',status:'active',recipientCount:1,createdByName:'Synthetic Agent'}],
        batches:[{id:id(50),batchReference:'WA-RCP-SYNTH',originalFileName:'synthetic.xlsx',fileFormat:'xlsx',sourceType:'existing_crm',ownerTeamId:id(10),teamName:'Synthetic Secondary Sales',rowCount:1,readyCount:1,reviewCount:0,invalidCount:0,status:'committed',createdByName:'Synthetic Agent'}],
        campaigns:[{id:id(60),campaignReference:'WA-CMP-SYNTH',name:'Synthetic campaign',ownerTeamId:id(10),teamName:'Synthetic Secondary Sales',segmentName:'Synthetic audience',templateName:'synthetic_launch',templateVersionNumber:1,materialCount:1,status:'draft',metaStatusLabel:'Not submitted',preparedByName:'Synthetic Agent',scheduledAt:'2026-11-24T10:00:00+04:00',budgetAed:'500'}],
        conversations:[{id:id(70),conversationReference:'WA-CON-SYNTH',displayName:'Synthetic Prospect',lastMessage:'Synthetic inbound message',ownerAgentName:'Synthetic Agent',teamName:'Synthetic Secondary Sales',responderMode:'human',replyWindowOpen:true,ctwaFreeWindowOpen:false,sourceType:'website',unreadCount:1}],
        reviewQueue:{templates:[],campaigns:[]},
        permissions:{canCreate:true,canReview:false,canReassign:false},
        provider:{connected:false,submissionEnabled:false,sendingEnabled:false,simulated:true,status:'Not submitted'}
      };
    };
  });
  await page.addScriptTag({path:releaseFile});
  await page.evaluate(()=>window.renderWhatsAppWorkspace());
  await page.waitForSelector('[data-wa-section="templates"]');
  assert.equal(await page.$('[data-wa-section="reviews"]'),null,'Agent must not receive the review section');
  const faultBanners=[];
  for(const message of await page.evaluate(()=>window.__DEV263_FAULTS__)){
    await page.click('[data-template-simulate]');
    await page.waitForFunction(expected=>document.querySelector('#wa-action-error')?.textContent.includes(expected),{},message);
    const banner=await page.$eval('#wa-action-error',element=>({visible:getComputedStyle(element).display!=='none',role:element.getAttribute('role'),text:element.textContent.trim()}));
    assert.equal(banner.visible,true);assert.equal(banner.role,'alert');assert.match(banner.text,new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    faultBanners.push({fault:message,status:'passed',...banner});
  }
  assert.equal(await page.evaluate(()=>window.__DEV263_FAULT_CALLS__.length),6,'Each fault must trigger exactly one request');
  for(const [key,expectedHeading] of sections){
    await page.click(`[data-wa-section="${key}"]`);
    await page.waitForFunction(heading=>document.querySelector('#wa-workspace-panel h3')?.textContent.trim()===heading,{},expectedHeading);
    const heading=await page.$eval('#wa-workspace-panel h3',element=>element.textContent.trim());
    const textLength=await page.$eval('#wa-workspace-panel',element=>element.textContent.trim().length);
    assert.equal(heading,expectedHeading);
    assert.ok(textLength>20,`${key} rendered no usable content`);
    const screenshot=path.join(evidenceDir,`${String(results.length+1).padStart(2,'0')}-${key}.png`);
    await page.screenshot({path:screenshot,fullPage:true});
    results.push({section:key,heading,status:'passed',textLength,screenshot:path.basename(screenshot)});
  }
  assert.deepEqual(pageErrors,[],'The actual release bundle raised a browser page error');
  assert.deepEqual(consoleErrors,[],'The actual release bundle wrote a console error');
  const evidence={
    candidate:'DEV263 pre-approval source',
    role:'Sales Agent',
    synthetic:true,
    releaseFile:path.relative(root,releaseFile).replaceAll('\\','/'),
    releaseSha256,
    loadedFromTrackedReleaseFile:true,
    sections:results,
    faultBanners,
    pageErrors,
    consoleErrors,
    checkedAt:new Date().toISOString()
  };
  await fs.writeFile(path.join(evidenceDir,'agent-six-section-browser-check.json'),`${JSON.stringify(evidence,null,2)}\n`);
  console.log(JSON.stringify(evidence));
}finally{
  await browser.close();
  await fs.rm(userDataDir,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
