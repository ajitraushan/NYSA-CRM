/* UI-001: presentation adapters. Existing nodes, commands and authorization stay authoritative. */
(()=>{
 'use strict';
 const zone='Asia/Dubai',month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 function date(value,{dateOnly=false}={}){
  if(!value)return 'Not provided';
  if(dateOnly){const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);if(!match)return 'Not provided';const parsed=new Date(match[0]+'T00:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==match[0])return 'Not provided';return `${Number(match[3])} ${month[Number(match[2])-1]} ${match[1]}`;}
  const text=String(value),input=/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(text)&&!/(Z|[+-]\d{2}:?\d{2})$/i.test(text)?text.replace(' ','T')+'Z':text;
  const parsed=new Date(input);if(!Number.isFinite(parsed.getTime()))return 'Not provided';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(parsed).map(p=>[p.type,p.value]));
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
 }
 const priority=value=>({critical:'Urgent',urgent:'Urgent',high:'High',medium:'Normal',normal:'Normal',low:'Normal',1:'Urgent',2:'Urgent',3:'High',4:'High'}[String(value).toLowerCase()]||'Normal');
 // List-only minimization. This does not grant record access or replace server authorization.
 const contactHint=(value,kind)=>{if(!value)return 'Not provided';const text=String(value);if(/[•*]/.test(text))return text;if(kind==='email'){const[local,domain]=text.split('@');return local&&domain?`${local.slice(0,1)}***@${domain}`:'Email on record';}const digits=text.replace(/\D/g,'');return digits?'••••'+digits.slice(-4):'Phone on record';};
 const sourceLabel=item=>{const system=item.intakeSourceSystem||item.source_system,form=item.intakeSourceFormId||item.source_form_id;if(system==='meta')return 'Meta Instant Forms';if(form==='ai_property_selection_v1')return 'NIA - Property selection';if(String(form||'').startsWith('ai_'))return 'NIA - Advice';if(['contact_form','contact_us','contact_enquiry_v2','speak_to_advisor_v2','brochure_download_v2'].includes(form))return 'Contact Form';return item.leadSource||(!item.leadId&&!item.followUpCaseId?'Internal task':'Not available');};
 const businessLabels={own_use:'Own home',off_plan:'Off-plan',ready_secondary:'Ready / secondary',within_30_days:'Within 30 days',within_3_months:'Within 3 months', '0_3_months':'Within 3 months','3_to_6_months':'3–6 months','6_to_12_months':'6–12 months',over_12_months:'More than 12 months',not_sure:'Not sure yet',customer_undecided:'Not sure yet',not_required:'Not required',pending_review:'Pending review',in_progress:'In progress',awaiting_payment:'Awaiting payment'};
 function presentText(root){
  for(const option of root.querySelectorAll('option')){const label=businessLabels[option.textContent.trim()];if(label){option.value=option.value;option.textContent=label;}}
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){if(node.parentElement?.closest('script,style,textarea,input,select,pre,code,.ui-audit,.activity-row,.activity-list,.comment-body,.comment-text,.activity-notes,.customer-feedback,.proposal-return-reason,[data-raw-evidence]'))continue;const value=node.nodeValue,label=businessLabels[value.trim()];let next=label?value.replace(value.trim(),label):value;
   next=next.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})\b/g,value=>date(value)).replace(/\b\d{4}-\d{2}-\d{2}\b/g,value=>date(value,{dateOnly:true}));if(next!==value)node.nodeValue=next;
  }
 }
 const descriptions={record:'Review details and use the available actions for this record.',dashboard:'Your priorities and performance at a glance.',crmLeads:'Find and follow up the leads you can access.',tasks:'Record outcomes and manage your next actions.',customers:'Find customers and open their authorized records.',listings:'Find property inventory and check its current status.',opportunities:'Follow your opportunities from selection to closure.',diary:'Plan appointments and follow-up work.',myLeave:'Request leave and follow its approval.',marketingCompliance:'Review marketing material and its required approvals.',bulkUpload:'Import records and review the results.',externalPortalListings:'Prepare property advertising and review portal readiness.',myPayoutAdvice:'View and download your payout advice.'};
 const isInteractive=el=>el.closest('a,button,input,select,textarea,summary,label,[contenteditable="true"]');
 function audit(node){if(node.closest('details.ui-audit'))return;const details=document.createElement('details');details.className='ui-audit';const summary=document.createElement('summary');summary.textContent='Audit details';node.before(details);details.append(summary,node);}
 function filters(grid){
  if(grid.dataset.uiFilters)return;
  const fields=[...grid.children].filter(el=>el.querySelector('input:not([type="hidden"]),select')&&!el.matches('.filter-actions'));
  if(fields.length<=4&&!fields.some(el=>el.querySelector('[name="passportLast4"],[name="emiratesIdLast4"],[id$="passportLast4"],[id$="emiratesIdLast4"]')))return;
  grid.dataset.uiFilters='1';const more=document.createElement('details');more.className='ui-more-filters';const summary=document.createElement('summary');summary.textContent='More filters';const extra=document.createElement('div');extra.className='ui-filter-extra';more.append(summary,extra);grid.append(more);
  let visible=0;for(const field of fields){const identity=field.querySelector('[name="passportLast4"],[name="emiratesIdLast4"],[id$="passportLast4"],[id$="emiratesIdLast4"]');if(identity||visible>=4)extra.append(field);else visible++;}
 }
 function header(root,context){
  const existing=root.querySelector('.ui-page-head');if(existing)return;
  const title=root.querySelector(':scope > h2,:scope > section > h2,:scope > div > h2,.dashboard-head h2,.detail-head h2,.web-intake-head h2,:scope > header h2,:scope > .dashboard-panel .panel-head h3,:scope > .dashboard-panel > h3');
  if(!title||!title.textContent.trim()||title.closest('form,table'))return;
  const parent=title.parentElement;let head=title.closest('.dashboard-head,.detail-head,.web-intake-head,header')||parent;
  if(head===root||head.matches('.dashboard-panel')){head=document.createElement('section');title.before(head);head.append(title);const next=head.nextElementSibling;if(next?.tagName==='P')head.append(next);}
  head.classList.add('ui-page-head');title.classList.add('ui-page-title');
  let crumb=head.querySelector('.eyebrow');if(!crumb){crumb=document.createElement('div');crumb.className='eyebrow';title.before(crumb);}
  if(!context.preserveBreadcrumb&&(context.tab!=='record'||!/^NYSA-(LD|OP|INV|CU)-/.test(crumb.textContent.trim())))crumb.textContent=context.tab==='myPayoutAdvice'?'Finance · My payouts':`${context.tab==='record'?'Records':'NYSA CORE'} · ${title.textContent.trim()}`;
  const description=head.querySelector(':scope > p,:scope > div > p'),descriptionKey=({crm:'crmLeads',externalListings:'externalPortalListings',purchasedDataImport:'bulkUpload'})[context.tab]||context.tab;
  if(description&&context.tab!=='record'&&descriptions[descriptionKey])description.textContent=descriptions[descriptionKey];
  const actions=[...head.querySelectorAll('button.btn,a.btn')].filter(el=>!el.closest('form,details'));
  const primary=actions.find(el=>el.classList.contains('btn-primary'));
  const secondary=actions.filter(el=>el!==primary);
  if(secondary.length>1&&secondary.every(el=>el.parentElement===secondary[0].parentElement)){const owner=secondary[0].parentElement,menu=document.createElement('details');menu.className='ui-more-actions';const label=document.createElement('summary');label.textContent='More';menu.append(label);owner.append(menu);secondary.forEach(el=>menu.append(el));}
 }
 function actionColumns(root){
  for(const table of root.querySelectorAll('table')){
   if(table.parentElement.closest('.pipeline-table-wrap,.table-wrap'))continue;
   const wrap=document.createElement('div');wrap.className='pipeline-table-wrap ui-table-scroll';table.before(wrap);wrap.append(table);
  }
  for(const cell of root.querySelectorAll('td')){
   if(cell.colSpan!==1||![...cell.querySelectorAll('button,a.btn')].some(control=>control.closest('td')===cell))continue;
   cell.classList.add('ui-action-cell');
   const row=cell.parentElement,header=cell.closest('table')?.rows[0];
   if(header?.cells.length===row.cells.length&&header.cells[cell.cellIndex]?.tagName==='TH')header.cells[cell.cellIndex].classList.add('ui-action-cell');
  }
 }
 function rows(root){
  actionColumns(root);
  for(const row of root.querySelectorAll('tr')){
   if(row.dataset.uiRow||!row.querySelector('td'))continue;
   if(row.matches('.clickable-row[data-record-lead],.clickable-row[data-record-opportunity],.clickable-row[data-record-listing]')){
    row.dataset.uiRow='1';row.tabIndex=0;row.classList.add('ui-record-row');row.setAttribute('aria-label',`Open ${row.cells[0]?.textContent.trim()||'record'}`);
    row.addEventListener('keydown',event=>{if(event.target!==row||!['Enter',' '].includes(event.key))return;event.preventDefault();row.click();});continue;
   }
   // Only record-open commands; no review, approval, mutation or task command is inferred.
   const open=row.querySelector('button[data-customer-id],button[data-opportunity-id],button[data-crm-lead],button[data-open-lead],button[data-lead-id],button[data-open-listing],button[data-open-opportunity]');
   if(!open||open.disabled)continue;
   row.dataset.uiRow='1';row.tabIndex=0;row.classList.add('ui-record-row');row.setAttribute('aria-label',`Open ${row.cells[0]?.textContent.trim()||'record'}`);
   const activate=event=>{if(isInteractive(event.target))return;if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;if(event.type==='keydown')event.preventDefault();open.click();};
   row.addEventListener('click',activate);row.addEventListener('keydown',activate);open.classList.remove('btn-primary');open.classList.add('ui-row-open');
   if(!open.getAttribute('aria-label'))open.setAttribute('aria-label',open.textContent.trim());open.textContent='Open';
  }
 }
 function listingSteps(root){
  const form=root.querySelector('#external-listing-create');if(!form||form.dataset.uiSteps||!form.elements.publicationTitle)return;
  form.dataset.uiSteps='1';const fields=[...form.children],names=['Listing selection','Advertising details','Media'];
  const groups=names.map((name,index)=>{const section=document.createElement('fieldset');section.className='ui-listing-step form-grid span2';section.dataset.step=index;const legend=document.createElement('legend');legend.textContent=name;section.append(legend);form.append(section);return section;});
  const selection=new Set(['listingId','portalCode']),media=new Set(['videoUrl','virtualTourUrl']);let submit;
  for(const field of fields){if(field.matches('button')){submit=field;continue;}const name=field.querySelector('input,select,textarea')?.name;groups[selection.has(name)?0:media.has(name)?2:1].append(field);}
  const controls=document.createElement('div');controls.className='ui-listing-steps span2';const tabs=names.map((name,index)=>{const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=`${index+1}. ${name}`;button.addEventListener('click',()=>show(index));controls.append(button);return button;});form.prepend(controls);
  const actions=document.createElement('div');actions.className='span2 ui-listing-steps';const back=document.createElement('button'),next=document.createElement('button');back.type=next.type='button';back.className=next.className='btn';back.textContent='Previous';next.textContent='Next';actions.append(back,next);if(submit){submit.textContent='Save preparation draft';actions.append(submit);}form.append(actions);let active=0;
  function show(index){active=index;groups.forEach((group,i)=>group.hidden=i!==index);tabs.forEach((tab,i)=>{tab.setAttribute('aria-current',i===index?'step':'false');tab.classList.toggle('btn-primary',i===index);});back.hidden=index===0;next.hidden=index===2;if(submit)submit.hidden=index!==2;}
  back.onclick=()=>show(Math.max(0,active-1));next.onclick=()=>{const invalid=[...groups[active].querySelectorAll('input,select,textarea')].find(field=>!field.checkValidity());if(invalid){invalid.reportValidity();return;}show(Math.min(2,active+1));};
  form.addEventListener('invalid',event=>{const group=event.target.closest('[data-step]');if(group)show(Number(group.dataset.step));},true);show(0);
 }
 function labels(root){
  for(const close of root.querySelectorAll('button.close-x'))if(!close.getAttribute('aria-label'))close.setAttribute('aria-label','Close');
  for(const field of root.querySelectorAll('input:not([type="hidden"]),select,textarea')){
   if(field.labels?.length||field.getAttribute('aria-label')||field.getAttribute('aria-labelledby'))continue;
   const label=field.parentElement.querySelector(':scope > label');
   if(label&&!label.control){if(!field.id)field.id='ui-field-'+(++labels.sequence);label.htmlFor=field.id;}
   else if(field.placeholder)field.setAttribute('aria-label',field.placeholder);
  }
 }
 labels.sequence=0;
 function decorate(context={}){
  if(!document.querySelector('#app.shell-layout'))return;
  const view=document.querySelector('#view');if(!view)return;
  header(view,view.querySelector('.record-workspace,.modal')?{...context,tab:'record'}:context);
  for(const grid of view.querySelectorAll('.filter-grid,.finance-filters'))filters(grid);
  rows(view);labels(view);listingSteps(view);presentText(view);
  for(const modal of document.querySelectorAll('.modal,.record-workspace,.opportunity-stage-page')){header(modal,{...context,tab:'record',preserveBreadcrumb:modal.matches('.opportunity-stage-page')});rows(modal);labels(modal);presentText(modal);for(const node of modal.querySelectorAll('small.mono,pre[data-audit],.technical-provenance'))audit(node);}
  for(const empty of view.querySelectorAll('.empty,.empty-state,.web-intake-empty'))if(!empty.dataset.uiEmpty){empty.dataset.uiEmpty='1';empty.setAttribute('role','status');if(empty.childElementCount===0&&!/[.!?]$/.test(empty.textContent.trim()))empty.append(document.createTextNode('.'));}
  const emptyText={'No tasks match this view.':'No tasks match this view. Change Status or clear your search to try again.','No customers found.':'No customers match these filters. Clear filters to search again.','No listings match these filters.':'No Inventory matches these filters. Reset filters to search again.','No leads match these filters.':'No leads match these filters. Clear filters to search again.'};
  for(const cell of view.querySelectorAll('.empty,td[colspan]')){const message=emptyText[cell.textContent.trim()];if(message)cell.textContent=message;}
  for(const state of view.querySelectorAll('.loading-state')){state.setAttribute('role','status');state.setAttribute('aria-live','polite');}
  for(const state of view.querySelectorAll('.error-msg,.dialog-error'))state.setAttribute('role','alert');
  for(const node of view.querySelectorAll('small.mono,pre[data-audit],.technical-provenance'))audit(node);
  for(const heading of view.querySelectorAll('#external-listing-workspace h3'))if(['Connector ETL mapping register','4. Property Finder sandbox outward preflight','Import existing Property Finder sandbox listings'].includes(heading.textContent.trim())){const section=heading.closest('section.dashboard-panel');if(section)audit(section);}
  for(const title of document.querySelectorAll('.opportunity-safety-note > b'))if(title.textContent.trim()==='Original attribution · immutable')audit(title.parentElement);
 }
 let installed=false,scheduled=false;
 function install(getContext){if(installed)return;installed=true;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;observer.disconnect();try{decorate(getContext());}finally{observer.observe(document.body,{childList:true,subtree:true});}});};const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});schedule();}
 window.NysaUI={date,priority,contactHint,sourceLabel,decorate,install};
})();
