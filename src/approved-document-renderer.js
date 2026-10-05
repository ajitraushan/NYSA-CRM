import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

const here=path.dirname(fileURLToPath(import.meta.url));
const templateDir=path.join(here,'approved-document-templates');
const templates=new Map([
  ['buyer_proposal','buyer-proposal.html'],['financial_illustration','financial-illustration.html'],
  ['offer_letter','offer-letter.html'],['viewing_confirmation','viewing-confirmation.html'],
  ['a2a_buyer','a2a-buyer.html'],['a2a_seller','a2a-seller.html'],
  ['listing_noc','listing-noc.html'],['agent_payout','agent-payout.html']
  ,['tax_invoice','tax-invoice.html']
]);

const fontCss=()=>[
  ['Inter',400,'Inter-Regular.woff2'],['Inter',600,'Inter-SemiBold.woff2'],
  ['Inter',700,'Inter-Bold.woff2'],['Inter',800,'Inter-ExtraBold.woff2'],
  ['GFS Baskerville',400,'GFSBaskerville.otf']
].map(([family,weight,file])=>`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url('data:${file.endsWith('.otf')?'font/otf':'font/woff2'};base64,${fs.readFileSync(path.join(templateDir,file)).toString('base64')}') format('${file.endsWith('.otf')?'opentype':'woff2'}')}`).join('');

function hydrationScript(data){
  const json=JSON.stringify(data).replaceAll('<','\\u003c');
  return `<script>(()=>{'use strict';const d=${json};
const all=(s,r=document)=>[...r.querySelectorAll(s)],txt=v=>v===null||v===undefined?'':String(v);
const setText=(s,v,i=0,r=document)=>{const e=all(s,r)[i];if(e)e.textContent=txt(v);return e};
const labelled=(label,r=document)=>all('label',r).filter(e=>e.textContent.trim().toLowerCase().startsWith(String(label).toLowerCase()));
const setLine=(label,v,i=0,r=document)=>{const l=labelled(label,r)[i],e=l?.parentElement?.querySelector('.ln');if(e)e.textContent=txt(v);return e};
const setLabelSpan=(label,v,i=0,r=document)=>{const l=all('label,.lb',r).filter(e=>e.textContent.trim().toLowerCase()===String(label).toLowerCase())[i],e=l?.parentElement?.querySelector('span:not(.lb),.ln');if(e)e.textContent=txt(v);return e};
const money=(v,c='AED',digits=0)=>v===null||v===undefined||v===''?'Not specified':c+' '+Number(v).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const checkbox=(needle,on,r=document)=>{if(!on)return;const e=all('.cb',r).find(x=>x.textContent.trim().toLowerCase()===String(needle).toLowerCase());if(e){e.classList.add('checked');const i=e.querySelector('i');if(i)i.textContent='✓'}};
if(d.replacements)for(const [from,to] of Object.entries(d.replacements))all('body *').filter(e=>e.children.length===0&&e.textContent.includes(from)).forEach(e=>e.textContent=e.textContent.replaceAll(from,txt(to)));
for(const x of d.lineValues||[])setLine(x.label,x.value,x.index||0);
for(const x of d.labelValues||[])setLabelSpan(x.label,x.value,x.index||0);
for(const x of d.textValues||[])setText(x.selector,x.value,x.index||0);
for(const x of d.checkboxes||[])checkbox(x.label,x.checked!==false);
if(d.table){const table=document.querySelector(d.table.selector),rows=table&&all('tr',table);if(table&&rows.length){rows.slice(d.table.headerRows||1).forEach(x=>x.remove());const body=table.tBodies[0]||table;for(const values of d.table.rows||[]){const tr=document.createElement('tr');for(const value of values){const td=document.createElement('td');td.textContent=txt(value);tr.appendChild(td)}body.appendChild(tr)}}}
if(d.documentCode==='buyer_proposal'){
 const pages=all('.page'),summary=pages[0],propertyTemplate=pages[1]?.cloneNode(true),properties=d.properties||[];pages.slice(1).forEach(x=>x.remove());
 if(summary){setText('.ref',d.reference,0,summary);const small=summary.querySelector('.ref small');if(small)small.textContent=txt(d.title)+' · Version '+txt(d.version||1);setLabelSpan('Prepared for',d.customer?.name,0,summary);setLabelSpan('Mobile',d.customer?.phone,0,summary);setLabelSpan('Customer address',d.customer?.address||'Not recorded',0,summary);setText('.idnote',d.customer?.identityReference||'Identity reference: Not recorded',0,summary);setText('.prep .who',d.agent?.name+' · '+d.issueDate,0,summary);setText('.disc',d.disclaimer,0,summary);setText('.sec .aside',properties.length+' shortlisted '+(properties.length===1?'property':'properties'),0,summary);
  const chips=summary.querySelector('.chips');if(chips){chips.innerHTML='';for(const c of d.requirementChips||[]){const s=document.createElement('span');s.className='chip'+(c.highlight?' g':'');const i=document.createElement('i');i.textContent=txt(c.label);s.append(i,document.createTextNode(txt(c.value)));chips.appendChild(s)}}
  const matches=all('.match',summary),host=matches[0]?.parentElement,anchor=matches.at(-1)?.nextSibling;matches.forEach(x=>x.remove());if(host)properties.forEach((p,i)=>{const m=document.createElement('div');m.className='match';m.innerHTML='<span class="no"></span><div class="b"><h4></h4><div class="m"></div><div class="r"></div></div><div class="rt"><div class="price"><small></small></div><div class="av"></div></div>';setText('.no','MATCH '+(i+1),0,m);setText('h4',p.title,0,m);setText('.m',[p.area,p.propertyType,p.bedrooms?String(p.bedrooms)+' bed':null,p.sizeSqft?Number(p.sizeSqft).toLocaleString('en-US')+' sq ft':null].filter(Boolean).join(' · '),0,m);setText('.r','Inventory ref. '+p.reference,0,m);setText('.price',p.price===null||p.price===undefined?'Not specified':Number(p.price).toLocaleString('en-US',{maximumFractionDigits:0}),0,m);const sm=document.createElement('small');sm.textContent=p.currency||'AED';m.querySelector('.price').prepend(sm);setText('.av',p.availability||'Availability requires reconfirmation',0,m);host.insertBefore(m,anchor)})}
 if(propertyTemplate)properties.forEach((p,i)=>{const page=propertyTemplate.cloneNode(true);setText('.pill','Match '+(i+1)+' of '+properties.length,0,page);setText('.prop h3',p.title,0,page);setText('.prop .m',[p.area,p.propertyType,p.handover].filter(Boolean).join(' · '),0,page);setText('.prop .price',Number(p.price||0).toLocaleString('en-US'),0,page);const sm=document.createElement('small');sm.textContent=p.currency||'AED';page.querySelector('.prop .price')?.prepend(sm);const vals={'Inventory reference':p.reference,'Built-up area':p.sizeSqft?Number(p.sizeSqft).toLocaleString('en-US')+' sq ft':'Not recorded','Developer':p.developer||'Not recorded','Bedrooms':p.bedrooms||'Not recorded','Parking':p.parking??'Not recorded','Payment plan / availability':p.paymentPlan||'Not recorded'};all('.cell',page).forEach(c=>{const k=c.querySelector('.lb')?.textContent.trim(),v=c.querySelector('span:not(.lb),p');if(k&&v&&Object.hasOwn(vals,k))v.textContent=txt(vals[k])});const assessments=[p.suitability,p.highlights,p.tradeoffs];all('.cell p',page).forEach((e,n)=>e.textContent=txt(assessments[n]||''));setText('.disc',d.disclaimer,0,page);document.body.appendChild(page)});
 all('.page').slice(1).forEach((page,index)=>{const images=properties[index]?.images||[];all('.imgs>div',page).forEach((slot,imageIndex)=>{const image=images[imageIndex];if(!image)return;slot.innerHTML='';const img=document.createElement('img');img.src=image.src;img.alt=image.caption||'Approved property image';img.style.cssText='width:100%;height:100%;object-fit:cover;display:block';slot.appendChild(img)})});
 all('.page .pg').forEach((e,i)=>e.textContent='Page '+(i+1)+' of '+all('.page').length);
}
if(d.documentCode==='agent_payout'){
 const source=document.querySelector('.page'),rows=d.rows||[],chunks=[];for(let i=0;i<rows.length;i+=8)chunks.push(rows.slice(i,i+8));if(!chunks.length)chunks.push([]);const populate=(page,chunk,pageIndex)=>{for(const [k,v] of Object.entries({...d.header,Page:(pageIndex+1)+' of '+chunks.length}))setLabelSpan(k,v,0,page);const tbody=page.querySelector('.pt-t tbody');if(tbody){tbody.innerHTML='';for(const [localIndex,row] of chunk.entries()){const tr=document.createElement('tr'),i=pageIndex*8+localIndex;const values=[i+1,row.date,row.property,row.references,row.salePrice,row.dealCommission,row.grossReceived,row.tranche,row.cumulative,row.agentShare,row.splitRequired,row.split,row.afterSplit,row.commission,row.tierAdjustment,row.total,row.alreadyPaid];for(const v of values){const td=document.createElement('td');td.textContent=txt(v);tr.appendChild(td)}tbody.appendChild(tr)}}if(pageIndex===chunks.length-1){for(const [k,v] of Object.entries(d.summary||{}))setLabelSpan(k,v,0,page)}else{const summary=page.querySelector('.sum'),heading=summary?.previousElementSibling;if(heading?.classList.contains('sec'))heading.remove();page.querySelectorAll('.sum,.bot').forEach(e=>e.remove())}};if(source){const template=source.cloneNode(true);source.remove();chunks.forEach((chunk,index)=>{const page=template.cloneNode(true);populate(page,chunk,index);document.body.appendChild(page)})}
}
if(d.documentCode==='listing_noc'){
 const terms=d.terms||{},inlines=all('.terms .inl');if(inlines[0])inlines[0].textContent=txt(terms.appointmentPeriod);if(inlines[1])inlines[1].textContent=txt(terms.sellerCommissionPercent);if(inlines[2])inlines[2].textContent=txt(terms.buyerCommissionPercent);
}
document.documentElement.dataset.hydrated='true';})();</script>`;
}

export function buildApprovedDocumentHtml(documentCode,data={}){
  const file=templates.get(documentCode);if(!file)throw new Error(`Unknown approved document template: ${documentCode}`);
  let html=fs.readFileSync(path.join(templateDir,file),'utf8');
  if(html.includes('{{NYSA_LOGO}}')){
    const authority=fs.readFileSync(path.join(templateDir,'buyer-proposal.html'),'utf8'),logo=authority.match(/<svg class="logo"[\s\S]*?<\/svg>/)?.[0];
    if(!logo)throw new Error('Approved NYSA logo asset was not found');html=html.replace('{{NYSA_LOGO}}',logo);
  }
  const fittedPageCss=documentCode==='buyer_proposal'?'.page{height:293mm!important}':documentCode==='agent_payout'?'.page{height:207mm!important;overflow:hidden}':'';
  html=html.replace(/<link[^>]+fonts\.googleapis[^>]*>/gi,'').replace('</style>',`${fontCss()}\nbody{font-family:Inter,Arial,sans-serif}.checked i{display:inline-flex!important;align-items:center;justify-content:center;font-size:8pt;font-weight:800;color:#14232C}.page{break-after:auto!important;page-break-after:auto!important}.page+.page{break-before:page!important;page-break-before:always!important}${fittedPageCss}\n</style>`);
  return html.replace('</body>',`${hydrationScript({...data,documentCode})}</body>`);
}

async function chromiumLaunchOptions(){
  if(process.platform==='win32')return{executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox','--disable-setuid-sandbox']};
  const {default:chromium}=await import('@sparticuz/chromium');return{executablePath:await chromium.executablePath(),headless:true,args:chromium.args};
}

export async function renderApprovedDocumentPdf(documentCode,data={}){
  const browser=await puppeteer.launch(await chromiumLaunchOptions());
  try{
    const page=await browser.newPage();
    await page.setContent(buildApprovedDocumentHtml(documentCode,data),{waitUntil:'networkidle0'});
    await page.waitForFunction(()=>document.documentElement.dataset.hydrated==='true');
    await page.evaluate(()=>document.fonts.ready);
    return Buffer.from(await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false}));
  }catch(error){throw new Error(`Approved PDF rendering failed: ${error.message}`,{cause:error});}
  finally{await browser.close();}
}

export function approvedTemplatePath(documentCode){const file=templates.get(documentCode);return file?path.join(templateDir,file):null;}
