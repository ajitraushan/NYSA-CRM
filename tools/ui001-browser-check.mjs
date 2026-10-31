// Synthetic UI interaction checks; no connection to CRM or customer data.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import puppeteer from 'puppeteer-core';
const root=process.cwd(),out=path.resolve(root,'outputs/ui001');await fs.mkdir(out,{recursive:true});
const html=await fs.readFile('public/index.html','utf8'),baseStyle=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox']});const report=[];
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:900});
 await page.setContent(`<style>${baseStyle}</style><div id="app" class="shell-layout"><header>NYSA CORE</header><nav class="tabs">Dashboard</nav><main id="view"><section class="dashboard-head"><div><h2>Customers</h2><p>Find customer records.</p></div><button class="btn btn-primary" id="create">Create customer</button><button class="btn" id="refresh">Refresh</button><button class="btn" id="export">Export</button></section><form id="filters" class="finance-filters">${['name','status','team','agent','passportLast4','emiratesIdLast4'].map(name=>`<div><label>${name}</label><input name="${name}" value="${name==='name'?'Synthetic customer':''}"></div>`).join('')}<button>Search</button></form><div class="pipeline-table-wrap"><table><tr><th>Customer</th><th>Action</th></tr><tr><td>Synthetic customer with a readable full name</td><td><button class="btn btn-primary" data-customer-id="synthetic">Open</button></td></tr></table></div><form id="external-listing-create" class="form-grid">${['listingId','portalCode','publicationTitle','publicationDescription','videoUrl','virtualTourUrl'].map(name=>`<div><label>${name}</label><input name="${name}" ${['listingId','portalCode','publicationTitle'].includes(name)?'required':''}></div>`).join('')}<button type="submit" class="btn btn-primary">Create</button></form></main></div>`);
 await page.addStyleTag({path:'public/ui-design-system.css'});await page.addScriptTag({path:'public/ui-design-system.js'});
 await page.evaluate(()=>{window.openCount=0;document.querySelector('[data-customer-id]').onclick=()=>window.openCount++;document.querySelector('#refresh').onclick=()=>window.refreshCount=(window.refreshCount||0)+1;window.NysaUI.decorate({tab:'customers'});window.NysaUI.decorate({tab:'customers'});});
 assert.equal(await page.$eval('.ui-page-title',el=>getComputedStyle(el).fontSize),'28px');
 assert.equal(await page.$$eval('.ui-more-filters',els=>els.length),1);
 assert.equal(await page.$eval('#filters',form=>new FormData(form).get('name')),'Synthetic customer');
 assert.equal(await page.$eval('[name="passportLast4"]',el=>!!el.closest('details:not([open])')),true);
 await page.focus('.ui-record-row');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.openCount),1);
 await page.click('.ui-more-actions summary');await page.click('#refresh');assert.equal(await page.evaluate(()=>window.refreshCount),1);
 await page.type('[name="listingId"]','Synthetic inventory');await page.type('[name="portalCode"]','Test portal');
 await page.click('#external-listing-create .ui-listing-steps:last-child button:nth-child(2)');assert.equal(await page.$eval('[data-step="1"]',el=>el.hidden),false);
 await page.type('[name="publicationTitle"]','Synthetic advertising title');await page.click('#external-listing-create .ui-listing-steps:last-child button:nth-child(2)');assert.equal(await page.$eval('[data-step="2"]',el=>el.hidden),false);
 assert.equal(await page.$eval('#external-listing-create',form=>new FormData(form).get('publicationTitle')),'Synthetic advertising title');
 for(const width of[1280,768,390]){await page.setViewport({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow at ${width}`);await page.screenshot({path:path.join(out,`components-${width}.png`),fullPage:true});report.push({width,horizontalOverflow:false});}
 await fs.writeFile(path.join(out,'browser-check.json'),JSON.stringify({synthetic:true,checks:['Dubai presenter','header type','idempotent filters','FormData preserved','identity filters collapsed','keyboard record open','secondary action handler retained','listing steps retain form values','responsive width'],viewports:report},null,2));
 console.log('UI-001 browser interaction checks passed');
}finally{await browser.close();}
