// Synthetic browser-only check for the number-independent WhatsApp workspaces.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const root=process.cwd(),out=path.resolve(root,'outputs/wa-stage-b-dev258');
await fs.mkdir(out,{recursive:true});
const html=await fs.readFile('public/index.html','utf8');
const baseStyle=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox']});
try{
  const page=await browser.newPage();await page.setViewport({width:1280,height:900});
  await page.setContent(`<style>${baseStyle}</style><div id="app" class="shell-layout"><main id="view"></main></div>`);
  await page.addStyleTag({path:'public/ui-design-system.css'});
  await page.evaluate(()=>{
    const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
    window.ME={id:id(1),jobRole:'manager'};
    window.$=selector=>document.querySelector(selector);
    window.esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    window.fmtDate=value=>value?'1 Nov 2026':'—';window.toast=()=>{};
    window.api=async()=>({
      teams:[{id:id(10),name:'Synthetic Secondary Sales',managerName:'Synthetic Manager'}],
      templates:[{id:id(20),versionId:id(21),templateReference:'WA-TPL-2026-SYNTH',name:'Synthetic launch',ownerTeamId:id(10),teamName:'Synthetic Secondary Sales',versionNumber:1,languageCode:'en',category:'marketing',bodyText:'Hello {{first_name}}',variableNames:['first_name'],internalStatus:'approved',metaStatus:'not_submitted',metaStatusLabel:'Not submitted',preparedByName:'Synthetic Agent',reviewedByName:'Synthetic Manager',reviewedAt:'2026-11-01'}],
      materials:[{id:id(30),materialReference:'WA-MAT-2026-SYNTH',title:'Synthetic brochure',materialType:'brochure',ownerTeamId:id(10),teamName:'Synthetic Secondary Sales',status:'active',createdByName:'Synthetic Agent'}],
      segments:[{id:id(40),name:'Synthetic consented audience',description:'Documented consent only',definition:{consentStatus:'documented'},ownerTeamId:id(10),teamName:'Synthetic Secondary Sales',status:'active',recipientCount:1,createdByName:'Synthetic Agent'}],
      batches:[{id:id(50),batchReference:'WA-RCP-2026-SYNTH',originalFileName:'synthetic.csv',ownerTeamId:id(10),teamName:'Synthetic Secondary Sales',rowCount:2,readyCount:1,reviewCount:1,invalidCount:0,status:'committed',createdByName:'Synthetic Agent'}],
      campaigns:[{id:id(60),campaignReference:'WA-CMP-2026-SYNTH',name:'Synthetic campaign',ownerTeamId:id(10),teamName:'Synthetic Secondary Sales',segmentName:'Synthetic consented audience',templateName:'Synthetic launch',templateVersionNumber:1,materialCount:1,status:'pending_approval',metaStatusLabel:'Not submitted',preparedByName:'Synthetic Agent'}],
      reviewQueue:{templates:[{versionId:id(22),name:'Synthetic follow-up',versionNumber:2,preparedByName:'Synthetic Agent',submittedAt:'2026-11-01',teamName:'Synthetic Secondary Sales',bodyText:'A governed internal review',metaStatusLabel:'Not submitted'}],campaigns:[{id:id(60),campaignReference:'WA-CMP-2026-SYNTH',name:'Synthetic campaign',preparedByName:'Synthetic Agent',teamName:'Synthetic Secondary Sales',segmentName:'Synthetic consented audience',templateName:'Synthetic launch',templateVersionNumber:1,materialCount:1,metaStatusLabel:'Not submitted'}]},
      permissions:{canCreate:true,canReview:true},provider:{connected:false,submissionEnabled:false,sendingEnabled:false,status:'Not submitted'}
    });
  });
  await page.addScriptTag({path:'public/whatsapp-workspace-ui.js'});
  await page.evaluate(()=>window.renderWhatsAppWorkspace());
  await page.waitForSelector('[data-wa-section="templates"]');
  assert.equal(await page.$eval('.dashboard-actions',el=>el.textContent.includes('Meta: Not submitted')&&el.textContent.includes('Sending: unavailable')),true);
  assert.equal(await page.$$eval('button',els=>els.some(el=>/\bsend\b/i.test(el.textContent))),false);
  for(const section of['templates','reviews','recipients','segments','campaigns','materials']){
    await page.click(`[data-wa-section="${section}"]`);
    assert.ok((await page.$eval('#wa-workspace-panel',el=>el.textContent.trim())).length>20,`${section} did not render`);
  }
  for(const width of[1280,768,390]){
    await page.setViewport({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow at ${width}`);
    await page.screenshot({path:path.join(out,`workspace-${width}.png`),fullPage:true});
  }
  await fs.writeFile(path.join(out,'browser-check.json'),JSON.stringify({synthetic:true,sections:['templates','reviews','recipients','segments','campaigns','materials'],metaStatus:'Not submitted',sendingControls:0,viewports:[1280,768,390]},null,2));
  console.log('DEV258 WhatsApp workspace browser check passed');
}finally{await browser.close();}
