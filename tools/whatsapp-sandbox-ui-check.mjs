import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-first-run']});
try{
 const results=[];
 for(const width of [390,1440])for(const state of ['locked','empty','paused','ready']){
  const page=await browser.newPage();await page.setViewport({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',request=>request.url().startsWith('http://localhost:33559/')?request.respond({status:200,contentType:'text/html',body:'<html><body></body></html>'}):request.abort());
  await page.goto('http://localhost:33559/');
  await page.setContent('<main id="root" style="padding:16px;max-width:1200px;margin:auto"></main>');
  for(const file of ['public/styles.css','public/ui-design-system.css']){try{await page.addStyleTag({content:await fs.readFile(file,'utf8')});}catch(e){if(e.code!=='ENOENT')throw e;}}
  const html=await fs.readFile('public/index.html','utf8');await page.addStyleTag({content:[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(x=>x[1]).join('\n')});
  await page.addScriptTag({content:await fs.readFile('public/lead-integration-ui.js','utf8')});
  await page.evaluate(async state=>{
   window.calls=[];
   window.testApi=async(path,options)=>{
    window.calls.push({path,options});
    if(options?.method==='POST')return {revision:2,paused:true,state:'accepted'};
    if(path==='/admin/lead-integrations/setup')return {revision:1,draft:{},owners:[],connections:[],pending_receipts:0,exceptions:0};
    return {setupEnabled:state!=='locked',configured:['paused','ready'].includes(state),revision:1,paused:state!=='ready',sendingEnabled:state==='ready',relayApproved:state==='ready',authMode:'basic',budget:10,used:1,remaining:9,attempts:[{id:'synthetic-attempt-reference',state:'accepted',delivery_state:'delivered'}],events:[{type:'reply',count:1}]};
   };
   await window.renderLeadIntegrationSetup({root:document.querySelector('#root'),api:window.testApi,escape:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});
  },state);
  await page.addStyleTag({content:await fs.readFile('public/ui-design-system.css','utf8')});
  const section=page.locator('[data-wa-sandbox]');assert.ok(await page.$('[data-wa-sandbox]'));
  await page.locator('[data-lead-integration-form] button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-lead-setup-result]').textContent==='Setup draft saved. Outreach activation is unchanged.');
  if(state==='ready'){
   await page.$eval('[data-wa-send] input[type="checkbox"]',x=>x.checked=true);await page.locator('[data-wa-send] button[type="submit"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-wa-send-result]').textContent.includes('Provider accepted'));
  }
  if(state!=='locked'){
   await page.locator('#wa-sandbox-key').fill('synthetic-private-key');await page.locator('#wa-sandbox-recipient').fill('+919900000001');await page.locator('[data-wa-generate]').click();
   await page.locator('[data-wa-credentials] button[type="submit"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-wa-save-result]').textContent.includes('Encrypted'));
   assert.equal(await page.$eval('#wa-sandbox-key',x=>x.value),'');assert.equal(await page.$eval('#wa-sandbox-recipient',x=>x.value),'');
   assert.equal(await page.$eval('#wa-sandbox-relay',x=>x.value),'');
   const posted=await page.evaluate(()=>window.calls.find(c=>c.path.endsWith('/connection')));assert.equal(posted.options.headers['x-nysa-sandbox-action'],'1');assert.equal(posted.options.refreshWorkspace,false);
   if(state==='paused'){
    await page.locator('[data-wa-connect]').click();await page.waitForFunction(()=>document.querySelector('[data-wa-connect-result]').textContent.includes('receipt recorded'));
   }
  }
  const sizes=await page.$eval('[data-wa-sandbox]',x=>({width:x.clientWidth,scroll:x.scrollWidth}));assert.ok(sizes.scroll<=sizes.width+2,JSON.stringify({width,state,sizes}));assert.deepEqual(errors,[]);
  await (await page.$('[data-wa-sandbox]')).screenshot({path:`outputs/wa001-implementation/ui-${width}-${state}.png`});
  results.push({width,state,noOverflow:true,secretsCleared:state!=='locked',errors});await page.close();
 }
 await fs.writeFile('outputs/wa001-implementation/UI_CHECKS.json',JSON.stringify(results,null,2));console.log(JSON.stringify({cases:results.length,passed:results.length}));
}finally{await browser.close();}

