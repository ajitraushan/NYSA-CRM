(()=>{
const state={q:'',status:'',due:'',ownerId:'',scrollTop:0,view:null,todayAgent:null};
let context=null;
const labels={not_contacted:'Not contacted',no_answer:'No answer',call_back:'Call back',interested:'Interested',not_interested:'Not interested',do_not_contact:'Do not contact',converted:'Converted'};
const warningLabels={outside_calling_window:'Recorded call outside the maintained prospect-local calling window',repeat_after_decline:'Customer previously declined. Confirm a renewed customer request or record the specific business reason before further outreach.',unanswered_daily_threshold:'Unanswered-call daily warning',unanswered_weekly_threshold:'Unanswered-call weekly warning'};
const fmt=value=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Dubai'}).format(new Date(value)):'Not recorded';
const options=(values,current='')=>values.map(([value,label])=>`<option value="${value}" ${value===current?'selected':''}>${label}</option>`).join('');
function errorBox(root,message){let box=root.querySelector('[data-prospect-error]');if(!box){box=document.createElement('div');box.dataset.prospectError='';box.className='prospect-error';root.prepend(box);}box.textContent=message;box.scrollIntoView({block:'center'});}
function clearError(root){root.querySelector('[data-prospect-error]')?.remove();}
const statusPill=status=>`<span class="prospect-status prospect-status-${context.escape(status)}">${context.escape(labels[status]||status)}</span>`;

async function loadList(){
 const params=new URLSearchParams();for(const key of ['q','status','due','ownerId'])if(state[key])params.set(key,state[key]);return context.api('/crm/prospects?'+params);
}
function quickForm(){return`<aside class="prospect-quick-create"><h3>Quick prospect note</h3><p class="tool-note">Keep the person outside Customer/Lead workflows until you deliberately convert.</p><form data-prospect-create><label>Name (optional)<input name="displayName" autocomplete="name"></label><label>Phone *<input name="phone" required autocomplete="tel" placeholder="+971501234567"></label><label>Email (optional)<input name="email" type="email" autocomplete="email"></label><label>Source<select name="source">${options([['cold_call','Cold call'],['referral','Referral'],['event','Event'],['personal_network','Personal network'],['purchased_data','Purchased data'],['other','Other']])}</select></label><label>Prospect timezone<input name="timezone" placeholder="Auto-detected; e.g. Asia/Dubai"></label><label>Brief notes<textarea name="briefNotes" rows="4"></textarea></label><details><summary>Purchased-list evidence</summary><label>Supplier<input name="sourceSupplier"></label><label>Batch reference<input name="sourceBatchReference"></label><label>Acquired at<input name="sourceAcquiredAt" type="datetime-local"></label><label>Evidence reference<input name="sourceEvidenceReference"></label></details><button class="btn btn-primary">Save prospect</button></form></aside>`;}
const uploadPath = '/crm/prospect-diary/upload';
const uploadLabels = {
  ready:'Ready', error:'Error', duplicate_in_file:'Duplicate in file',
  existing_prospect:'Existing prospect', matches_customer_or_lead:'Matches Customer or Lead',
  do_not_contact:'On Do-not-contact list'
};
function uploadPanel(data) {
  const owners = (data.agents || []).map(agent =>
    `<option value="${context.escape(agent.id)}">${context.escape(agent.name)}</option>`).join('');
  return `<details class="dashboard-panel prospect-upload"><summary>Upload prospects</summary>
    <p>Upload up to 2,000 prospects. Use a phone number, an email address, or both.</p>
    <div><button class="btn" type="button" data-upload-template="xlsx">Download Excel template</button>
    <button class="btn" type="button" data-upload-template="csv">Download CSV template</button></div>
    <form class="prospect-toolbar" data-upload-form>
      <label>File<input type="file" name="file" accept=".xlsx,.csv" required></label>
      ${data.canManage ? `<label>Sales Agent<select name="ownerId" required><option value="">Select Sales Agent</option>${owners}</select></label>` : ''}
      <button class="btn btn-primary">Preview upload</button>
    </form>
    <p role="status" data-upload-status></p>
    <div data-upload-preview></div>
  </details>`;
}
function bindUpload(root) {
  const form = root.querySelector('[data-upload-form]');
  const status = root.querySelector('[data-upload-status]');
  const preview = root.querySelector('[data-upload-preview]');
  const escape = context.escape;
  const controls = [...form.elements];
  const lock = disabled => controls.forEach(control => { control.disabled = disabled; });
  const summary = counts => Object.entries(uploadLabels).map(([key,label]) =>
    `${label} ${Number(counts[key] || 0)}`).join(' Ã‚· ');
  const download = async (path, name) => {
    try { await context.download(uploadPath + path,name); }
    catch (error) { status.textContent = error.message; }
  };
  for (const button of root.querySelectorAll('[data-upload-template]')) {
    button.onclick = () => download('/template/' + button.dataset.uploadTemplate,'nysa-prospect-upload.' + button.dataset.uploadTemplate);
  }
  form.onchange = () => { preview.replaceChildren(); status.textContent = ''; };
  form.onsubmit = async event => {
    event.preventDefault();
    const file = form.elements.file.files[0], ownerId = form.elements.ownerId?.value;
    if (!file || file.size > 5*1024*1024) { status.textContent = 'Choose a file up to 5 MB.'; return; }
    lock(true);
    preview.replaceChildren();
    status.textContent = 'Checking rowsÃ¢â‚¬Â¦';
    try {
      const dataUrl = await new Promise((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The file could not be read'));
        reader.readAsDataURL(file);
      });
      const payload = {fileName:file.name,ownerId,base64:dataUrl.split(',')[1]};
      const result = await context.api(uploadPath + '/preview',{method:'POST',body:payload,refreshWorkspace:false});
      status.textContent = summary(result.counts);
      const accepted = result.counts.ready + result.counts.do_not_contact;
      preview.innerHTML = `<div class="pipeline-table-wrap" style="max-height:24rem;overflow:auto"><table>
        <thead><tr><th scope="col">Row</th><th scope="col">Status</th><th scope="col">Reason</th></tr></thead>
        <tbody>${result.rows.map(row => `<tr><td>${Number(row.rowNumber)}</td>
          <td>${escape(uploadLabels[row.status])}</td><td>${escape(row.reason || '')}</td></tr>`).join('')}</tbody>
      </table></div><button class="btn btn-primary" type="button" data-upload-commit>Commit upload (${accepted} to save)</button>`;
      const commit = preview.querySelector('[data-upload-commit]');
      commit.onclick = async () => {
        lock(true);
        commit.disabled = true;
        status.textContent = 'Saving uploadÃ¢â‚¬Â¦';
        try {
          const saved = await context.api(uploadPath + '/commit',{
            method:'POST',refreshWorkspace:false,body:{...payload,batchId:result.batchId,reviewToken:result.reviewToken}
          });
          status.textContent = 'Upload committed. ' + summary(saved.counts);
          preview.innerHTML = '<button class="btn" type="button" data-upload-results>Download skipped rows</button> <button class="btn" type="button" data-upload-refresh>Refresh Prospect Diary</button>';
          preview.querySelector('[data-upload-results]').onclick = () =>
            download('/' + saved.batchId + '/result','nysa-prospect-upload-result.csv');
          preview.querySelector('[data-upload-refresh]').onclick = render;
          form.reset();
        } catch (error) {
          status.textContent = error.message;
          commit.disabled = false;
        } finally { lock(false); }
      };
    } catch (error) { status.textContent = error.message; }
    finally { lock(false); }
  };
}
const dashboardMetrics={callsMade:'Calls made',callsConnected:'Connected',newInterested:'New interested',
 conversions:'Conversions',followUpsOverdue:'Overdue follow-ups',untouchedPastDue:'Untouched past due'};
const percent=(count,total)=>total?Math.round(count/total*100)+'%':'—';

async function renderDashboard(){
 const root=context.root,esc=context.escape;
 const params=new URLSearchParams(window.location.search);
 root.innerHTML='<div class="loading-state">Loading Prospecting…</div>';
 let data;
 try{data=await context.api('/crm/prospect-diary/dashboard?'+params);}
 catch(error){root.innerHTML='<div class="prospect-error">'+esc(error.message)+'</div>';return;}
 const metrics=Object.entries(dashboardMetrics).map(([key,label])=>
   `<button type="button" data-dashboard-metric="${key}"><span>${label}</span><strong>${Number(data.tiles[key])}</strong></button>`).join('');
 const funnel=Object.entries(data.funnel);
 const chart=funnel.map(([stage,count],index)=>`<div>
   <strong>${esc(stage)} · ${Number(count)} ${index?'('+percent(count,funnel[index-1][1])+')':''}</strong>
   <progress aria-label="${esc(stage)}" value="${Number(count)}" max="${Math.max(1,data.funnel.created)}"></progress>
 </div>`).join('');
 const filterSelect=(name,label,items,empty)=>`<label>${label}<select name="${name}"><option value="">${empty}</option>
   ${items.map(item=>`<option value="${esc(item.id)}" ${data.filters[name]===item.id?'selected':''}>${esc(item.name||item.id)}</option>`).join('')}</select></label>`;
 const rows=(items,keys)=>items.map(item=>`<tr>${keys.map(key=>`<td>${esc(item[key]??'—')}</td>`).join('')}</tr>`).join('');
 const table=(title,items,columns)=>`<section class="dashboard-panel"><h3>${title}</h3>
   <table><thead><tr>${columns.map(([,label])=>`<th scope="col">${label}</th>`).join('')}</tr></thead>
   <tbody>${rows(items,columns.map(([key])=>key))}</tbody></table></section>`;
 root.innerHTML=`<section class="prospect-diary">
  <header class="dashboard-head"><h2>Prospecting</h2><button class="btn" type="button" data-dashboard-diary>All prospects</button></header>
  <form class="prospect-toolbar" data-dashboard-filter>
    <label>Period<select name="period">${options([['today','Today'],['week','This week'],['month','This month'],['custom','Custom']],data.filters.period)}</select></label>
    <label>From<input type="date" name="from" value="${esc(data.filters.from)}"></label>
    <label>To<input type="date" name="to" value="${esc(data.filters.to)}"></label>
    <label>Source<select name="source"><option value="">All sources</option>${options(['diary','notebook','whatsapp','rem','cold_call','referral','event','personal_network','purchased_data','other'].map(value=>[value,value.replaceAll('_',' ')]),data.filters.source)}</select></label>
    ${filterSelect('team','Team',data.options.teams,'All teams')}
    ${data.options.agents.length?filterSelect('agent','Agent',data.options.agents,'All Agents'):''}
    ${filterSelect('batch','Upload batch',data.options.batches,'All batches')}
    <button type="submit" class="btn btn-primary">Apply</button>
  </form>
  <div class="prospect-summary">${metrics}<div><span>Connect rate</span><strong>${percent(data.tiles.callsConnected,data.tiles.callsMade)}</strong></div></div>
  <section class="dashboard-panel" data-dashboard-drilldown hidden></section>
  <section class="dashboard-panel"><h3>Prospect funnel</h3>${chart}</section>
  ${data.agents.length?table('Agent performance',data.agents,[['name','Agent'],['team','Team'],['target','Target'],['calls_made','Calls'],['calls_connected','Connected'],['new_interested','Interested'],['conversions','Converted'],['overdue','Overdue'],['overrides','Overrides']]):''}
  ${data.agents.length?`<section class="dashboard-panel"><h3>Agent actions</h3>${data.agents.map(agent=>`
      <p>${esc(agent.name)} <button class="btn btn-sm" type="button" data-agent-today="${esc(agent.id)}">Open Today</button>
      <button class="btn btn-sm" type="button" data-agent-target="${esc(agent.id)}">Set daily target</button></p>`).join('')}</section>`:''}
  ${table('Activity trend',data.trend,[['day','Period'],['made','Calls'],['connected','Connected']])}
  ${table('Call outcomes',data.outcomes,[['outcome','Outcome'],['reason','Reason'],['count','Count']])}
  ${table('Source quality',data.sources,[['source','Source'],['batch','Batch'],['prospects','Prospects'],['contacted','Contacted'],['connected','Connected'],['interested','Interested'],['converted','Converted'],['closed','Closed']])}
  <section class="dashboard-panel"><h3>Aging prospects</h3>${data.aging.map(item=>`<p><button class="btn btn-sm" type="button" data-dashboard-open="${esc(item.id)}">${esc(item.display_name||'Unnamed prospect')}</button> · ${esc(fmt(item.since))}</p>`).join('')||'<p>No aging prospects in this scope.</p>'}</section>
 </section>`;
 root.querySelector('[data-dashboard-diary]').onclick=()=>{state.view='diary';render();};
 root.querySelector('[data-dashboard-filter]').onsubmit=event=>{
   event.preventDefault();
   for(const [key,value] of new FormData(event.currentTarget)){if(value)params.set(key,value);else params.delete(key);}
   params.delete('page');
   window.history.replaceState(null,'',window.location.pathname+'?'+params+window.location.hash);
   renderDashboard();
 };
 for(const button of root.querySelectorAll('[data-dashboard-open]'))button.onclick=()=>open(button.dataset.dashboardOpen);
 for(const button of root.querySelectorAll('[data-agent-today]'))button.onclick=()=>{
   state.todayAgent=button.dataset.agentToday;state.view='today';render();
 };
 for(const button of root.querySelectorAll('[data-agent-target]'))button.onclick=async()=>{
   const value=window.prompt('Daily target (0–300)');
   if(value===null||!value.trim())return;
   const effectiveFrom=window.prompt('Effective date (YYYY-MM-DD)',data.filters.from);
   if(!effectiveFrom)return;
   const reason=window.prompt('Reason for this target');
   if(!reason)return;
   try{
     await context.api('/crm/prospect-diary/targets/'+encodeURIComponent(button.dataset.agentTarget),
       {method:'POST',body:{dailyTarget:Number(value),effectiveFrom,reason}});
     await renderDashboard();
   }catch(error){errorBox(root,error.message);}
 };
 for(const button of root.querySelectorAll('[data-dashboard-metric]'))button.onclick=async()=>{
   const metric=button.dataset.dashboardMetric;
   const query=new URLSearchParams(params);
   query.set('metric',metric);
   try{
     const result=await context.api('/crm/prospect-diary/dashboard/drilldown?'+query);
     const panel=root.querySelector('[data-dashboard-drilldown]');
     panel.hidden=false;
     panel.innerHTML=`<h3>${esc(dashboardMetrics[metric])} · ${Number(result.total)} prospects</h3>
       ${result.rows.map(item=>`<p><button class="btn btn-sm" type="button" data-drilldown-open="${esc(item.id)}">${esc(item.displayName||'Unnamed prospect')}</button></p>`).join('')}`;
     for(const item of panel.querySelectorAll('[data-drilldown-open]'))item.onclick=()=>open(item.dataset.drilldownOpen);
   }catch(error){errorBox(root,error.message);}
 };
}

async function renderToday(){
 const root=context.root;
 root.innerHTML='<div class="loading-state">Loading Today…</div>';
 let data;
 try{data=await context.api('/crm/prospect-diary/today'+(state.todayAgent?'?agent='+encodeURIComponent(state.todayAgent):''));}
 catch(error){root.textContent=error.message;return;}
 const esc=context.escape;
 const reason=item=>{
   if(item.priority===1)return 'Overdue follow-up · '+fmt(item.dueAt);
   if(item.priority===2)return 'Follow-up today · '+fmt(item.dueAt);
   if(item.priority===3)return 'Callback · '+fmt(item.dueAt);
   if(item.priority===4)return 'Retry '+item.retryAttempts+' · '+fmt(item.nextRetryAt);
   return 'Untouched · added '+fmt(item.createdAt);
 };
 const list=data.items.map(item=>{
   const interest=[item.purpose,item.budgetBand,item.propertyType,item.market,item.timeline].filter(Boolean)
     .map(value=>value.replaceAll('_',' ')).join(' · ');
   return `<article class="prospect-follow-up">
     <div><strong>${esc(item.displayName||'Unnamed prospect')}</strong>
     <p>${esc([item.phone,item.source].filter(Boolean).join(' · '))}</p>
     <p>${esc(reason(item))}</p>
     ${item.lastOutcome?`<small>${esc(item.lastOutcome.replaceAll('_',' '))} · ${esc(fmt(item.lastOccurredAt))}</small>`:''}
     ${interest?`<p>${esc(interest)}</p>`:''}
     ${item.lastNote?`<p>${esc(item.lastNote)}</p>`:''}</div>
     <div><button class="btn btn-sm" type="button" data-today-open="${esc(item.id)}">Open record</button>
     ${item.phone&&!data.readOnly?`<button class="btn btn-sm" type="button" data-today-call="${esc(item.id)}">Log call</button>`:''} ${item.followUpId&&!data.readOnly?`<form data-today-snooze="${esc(item.id)}" data-follow-up="${esc(item.followUpId)}">
       <label>Snooze until (Dubai)<input type="datetime-local" name="until" required></label>
       <label>Reason<input name="reason" minlength="5" required></label>
       <button class="btn btn-sm" type="submit">Snooze</button>
     </form>`:''}</div>
   </article>`;
 }).join('');
 root.innerHTML=`<section class="prospect-diary"><header class="dashboard-head">
   <div><h2>Today</h2><p>${Number(data.queueTotal)} remaining</p>
   ${Number.isFinite(data.callsMade)?`<p>${data.callsMade} calls made · ${data.connected} connected · ${data.target?'Target '+data.target:'No target'}</p>`:''}</div>
   <button class="btn" type="button" data-today-diary>All prospects</button></header>
   ${data.outsideCallingHours?'<p class="tool-note">Outside calling hours — calls will need a recorded reason.</p>':''}
   <section class="dashboard-panel">${list||'<p>There are no eligible prospects in your queue.</p>'}</section></section>`;
 root.querySelector('[data-today-diary]').onclick=()=>{state.view=state.todayAgent?'dashboard':'diary';state.todayAgent=null;render();};
 for(const button of root.querySelectorAll('[data-today-open]'))button.onclick=()=>open(button.dataset.todayOpen);
 for(const button of root.querySelectorAll('[data-today-call]'))button.onclick=()=>open(button.dataset.todayCall,{focusCall:true});
 for(const form of root.querySelectorAll('[data-today-snooze]'))form.onsubmit=async event=>{
   event.preventDefault();
   try{
     await context.api('/crm/prospects/'+encodeURIComponent(form.dataset.todaySnooze)+'/follow-ups/'+encodeURIComponent(form.dataset.followUp)+'/snooze',
       {method:'PATCH',body:{until:form.elements.until.value+'+04:00',reason:form.elements.reason.value}});
     await renderToday();
   }catch(error){errorBox(root,error.message);}
 };
}

async function loadOverridePanel(root,panel){
 const result=await context.api('/crm/prospect-diary/overrides');
 const esc=context.escape;
 panel.hidden=false;
 panel.innerHTML=`<section class="dashboard-panel"><h3>Team warning overrides · ${Number(result.unreviewedCount)} unreviewed</h3>
   ${result.overrides.map(item=>`<article class="prospect-event">
   <b>${esc(item.displayName||'Unnamed prospect')}${item.phoneLastFour?' · ••••'+esc(item.phoneLastFour):''}</b>
   <p>${item.warningCodes.map(code=>esc(warningLabels[code]||code.replaceAll('_',' '))).join('<br>')}</p>
   <p>${esc(item.warningReason||'Reason not recorded')}</p>
   <small>${esc(item.actorName)} · ${esc(fmt(item.recordedAt))}</small>
   <div><button class="btn btn-sm" type="button" data-override-open="${esc(item.prospectId)}">Open record</button></div>
   ${item.reviewedAt?`<p>Reviewed by ${esc(item.reviewedByName||'Unknown reviewer')} · ${esc(fmt(item.reviewedAt))}${item.comment?' · '+esc(item.comment):''}</p>`:
   `<form data-override-review="${esc(item.evidenceId)}" data-evidence-type="${esc(item.evidenceType)}">
     <label>Review comment (optional)<input name="comment" minlength="5" maxlength="1000"></label>
     <button class="btn btn-sm" type="submit">Mark reviewed</button>
   </form>`}</article>`).join('')||'<p>No warning overrides in your permitted team scope.</p>'}</section>`;
 for(const button of panel.querySelectorAll('[data-override-open]'))button.onclick=()=>open(button.dataset.overrideOpen);
 for(const form of panel.querySelectorAll('[data-override-review]'))form.onsubmit=async event=>{
   event.preventDefault();
   const button=form.querySelector('button');
   button.disabled=true;
   try{
     await context.api('/crm/prospect-diary/overrides/'+encodeURIComponent(form.dataset.overrideReview)+'/review',
       {method:'POST',body:{evidenceType:form.dataset.evidenceType,comment:form.elements.comment.value}});
     await loadOverridePanel(root,panel);
   }catch(error){errorBox(root,error.message);}
   finally{button.disabled=false;}
 };
}

async function render(){
 if(state.view==='today')return renderToday();
 if(state.view==='dashboard')return renderDashboard();
 const root=context.root;root.innerHTML='<div class="loading-state">Loading Prospect DiaryÃ¢â‚¬Â¦</div>';let data;try{data=await loadList();}catch(error){root.innerHTML=`<div class="prospect-error">${context.escape(error.message)}</div>`;return;}
 const s=data.summary||{},ownerOptions=(data.agents||[]).map(x=>`<option value="${x.id}" ${state.ownerId===x.id?'selected':''}>${context.escape(x.name)} Ã‚· ${context.escape(x.jobRole.replaceAll('_',' '))}</option>`).join('');
 root.innerHTML=`<section class="prospect-diary"><section class="dashboard-head"><div><div class="eyebrow">NYSA CORE / AGENT PROSPECTING</div><h2>Prospect Diary</h2><p>Record cold-call prospects, every conversation and every follow-up before you decide to create a Customer.</p></div></section><div class="prospect-summary">${[['today','Today'],['overdue','Overdue'],['upcoming','Upcoming'],['interested','Interested'],['doNotContact','Do not contact']].map(([key,label])=>`<button type="button" data-summary="${key}"><span>${label}</span><strong>${Number(s[key]||0)}</strong></button>`).join('')}</div><form class="prospect-toolbar" data-prospect-filters><label>Search<input name="q" value="${context.escape(state.q)}" placeholder="Name, phone or email"></label><label>Status<select name="status"><option value="">All statuses</option>${options(Object.entries(labels),state.status)}</select></label><label>Due<select name="due"><option value="">Any due date</option>${options([['overdue','Overdue'],['today','Today'],['upcoming','Upcoming']],state.due)}</select></label>${data.canManage?`<label>Owner<select name="ownerId"><option value="">All permitted owners</option>${ownerOptions}</select></label>`:'<span></span>'}<button class="btn btn-primary">Apply</button></form>${data.canManage?'<div class="prospect-manager-tools"><button class="btn" type="button" data-load-overrides>Review team warning overrides</button><div data-overrides hidden></div></div>':''}${uploadPanel(data)}<div class="prospect-layout"><div class="prospect-list">${data.prospects.map(p=>`<button class="prospect-card" type="button" data-prospect="${p.id}"><span><b class="prospect-card-name">${context.escape(p.displayName||'Unnamed prospect')}</b><small>${context.escape(p.phone)}${p.email?' Ã‚· '+context.escape(p.email):''}</small></span><span>${statusPill(p.status)}<small>${context.escape(p.ownerName)}${p.teamName?' Ã‚· '+context.escape(p.teamName):''}</small></span><span><b>${context.escape(p.nextActionSubject||'No next action')}</b><small>${p.nextActionDueAt?fmt(p.nextActionDueAt):p.lastContactAt?'Last call '+fmt(p.lastContactAt):'No call recorded'}</small></span><span>Open Ã¢â€ â€™</span></button>`).join('')||'<div class="prospect-empty">No prospects match these filters.</div>'}</div>${quickForm()}</div></section>`;
 bindUpload(root);
 const main=document.querySelector('main');if(main)main.scrollTop=state.scrollTop;
 root.querySelector('[data-prospect-filters]').onsubmit=event=>{event.preventDefault();const f=Object.fromEntries(new FormData(event.currentTarget));Object.assign(state,f);state.scrollTop=0;render();};
 root.querySelectorAll('[data-summary]').forEach(button=>button.onclick=()=>{const key=button.dataset.summary;state.status=key==='interested'?'interested':key==='doNotContact'?'do_not_contact':'';state.due=['today','overdue','upcoming'].includes(key)?key:'';state.scrollTop=0;render();});
 root.querySelector('[data-prospect-create]').onsubmit=async event=>{event.preventDefault();clearError(root);const submit=event.currentTarget.querySelector('button');submit.disabled=true;try{const created=await context.api('/crm/prospects',{method:'POST',body:Object.fromEntries(new FormData(event.currentTarget))});await render();open(created.prospect.id);}catch(error){errorBox(root,error.message);}finally{submit.disabled=false;}};
 root.querySelectorAll('[data-prospect]').forEach(button=>button.onclick=()=>{state.scrollTop=document.querySelector('main')?.scrollTop||0;open(button.dataset.prospect);});
 const dashboardButton=document.createElement('button');
 dashboardButton.type='button';
 dashboardButton.className='btn';
 dashboardButton.textContent='Prospecting';
 dashboardButton.onclick=()=>{state.view='dashboard';render();};
 root.querySelector('.dashboard-head')?.append(dashboardButton);
 root.querySelector('[data-load-overrides]')?.addEventListener('click',async event=>{
   const panel=root.querySelector('[data-overrides]'),button=event.currentTarget;
   button.disabled=true;
   try{await loadOverridePanel(root,panel);}catch(error){errorBox(root,error.message);}finally{button.disabled=false;}
 });
 if(!data.canManage){
   const button=document.createElement('button');
   button.type='button';
   button.className='btn';
   button.textContent='Today queue';
   button.onclick=()=>{state.view='today';render();};
   root.querySelector('.dashboard-head')?.append(button);
 }
}

function detailHtml(data){const p=data.prospect,open=data.followUps.filter(x=>['open','in_progress'].includes(x.status)),history=data.followUps.filter(x=>!['open','in_progress'].includes(x.status));return`<article class="record-workspace-surface"><section class="prospect-detail-header ui-page-head"><div><div class="eyebrow">PROSPECT DIARY / PRE-CUSTOMER RECORD</div><h2>${context.escape(p.displayName||'Unnamed prospect')}</h2><div class="prospect-detail-meta">${statusPill(p.status)}<span>${context.escape(p.phone)}</span>${p.email?`<span>${context.escape(p.email)}</span>`:''}<span>Owner: ${context.escape(p.ownerName)}</span></div></div><button class="close-x" type="button">Ãƒâ€”</button></section><div data-prospect-detail><div class="loading-state">Loading prospectÃ¢â‚¬Â¦</div></div></article>`;}
function editSection(data){const p=data.prospect;if(p.status==='converted'||(p.ownerId!==context.actor.id&&!data.canManage))return'';return`<details class="dashboard-panel"><summary>Edit Prospect details</summary><form class="form-grid compact-form" data-prospect-edit><label>Name<input name="displayName" value="${context.escape(p.displayName||'')}"></label><label>Email<input name="email" type="email" value="${context.escape(p.email||'')}"></label><label>Phone<input name="phone" value="${context.escape(p.phone)}"></label><label class="span2">Reason for phone change<input name="phoneReason"></label><label class="span3">Notes<textarea name="briefNotes" rows="4">${context.escape(p.briefNotes||'')}</textarea></label>${data.canManage?`<label>Source<select name="source">${options([['cold_call','Cold call'],['referral','Referral'],['event','Event'],['personal_network','Personal network'],['purchased_data','Purchased data'],['diary','Diary'],['notebook','Notebook'],['whatsapp','WhatsApp'],['rem','REM'],['other','Other']],p.source)}</select></label><label>Supplier<input name="sourceSupplier" value="${context.escape(p.sourceSupplier||'')}"></label><label>Batch reference<input name="sourceBatchReference" value="${context.escape(p.sourceBatchReference||'')}"></label><label>Acquired at<input name="sourceAcquiredAt" type="datetime-local" value="${p.sourceAcquiredAt?new Date(p.sourceAcquiredAt).toISOString().slice(0,16):''}"></label><label>Evidence reference<input name="sourceEvidenceReference" value="${context.escape(p.sourceEvidenceReference||'')}"></label><label class="span2">Reason for source change<input name="sourceReason"></label>`:''}<button class="btn btn-primary span3">Save audited changes</button></form>${data.editHistory?.length?`<div class="prospect-edit-history"><h4>Previous versions</h4>${data.editHistory.map(item=>`<small>${fmt(item.timestamp)} Ã‚· ${context.escape(item.actorName||'System')} Ã‚· ${context.escape(Object.keys(item.details?.after||{}).join(', '))}</small>`).join('')}</div>`:''}</details>`;}
function detailBody(data){const p=data.prospect,blocked=['do_not_contact','converted'].includes(p.status),owner=p.ownerId===context.actor.id,statusOptions=Object.entries(labels).filter(([value])=>value!=='converted'),noteOnly=p.status==='do_not_contact',numberOptions=(data.callingNumbers||[]).map(n=>`<option value="${n.id}">${context.escape(n.label)} Ã‚· ${context.escape(n.phone)}</option>`).join('');return`<div class="prospect-diary">${data.suppression?.strongest?`<div class="prospect-error">Outbound contact blocked: ${context.escape(data.suppression.strongest.replaceAll('_',' '))}</div>`:''}${p.briefNotes?`<section class="dashboard-panel"><b>Initial note</b><p>${context.escape(p.briefNotes)}</p></section>`:''}<div class="prospect-detail-grid"><section class="prospect-timeline"><div class="panel-head"><div><h3>Calls and notes</h3><small>${data.activities.length} retained event${data.activities.length===1?'':'s'}; corrections never overwrite history</small></div></div>${data.activities.map(a=>`<article class="prospect-event"><b>${a.activityType==='call'?`${context.escape(a.direction)} call Ã‚· ${context.escape(a.outcome.replaceAll('_',' '))}`:'Internal note'}</b><p>${context.escape(a.notes)}</p><small>${fmt(a.occurredAt)} Ã‚· ${context.escape(a.createdByName)}${a.correctsActivityId?' Ã‚· corrects '+context.escape(a.correctsActivityId)+' ('+context.escape(a.correctionReason)+')':''}${a.warningCodes?.length?' Ã‚· warning acknowledged: '+context.escape(a.warningCodes.join(', ')):''}</small>${owner&&!blocked?`<button class="btn btn-sm" type="button" data-correct-activity="${a.id}">Correct</button>`:''}</article>`).join('')||'<div class="prospect-empty">No calls or notes recorded.</div>'}<div class="panel-head"><div><h3>Follow-ups</h3><small>These are standard CORE Tasks and also appear in My Tasks and My Diary.</small></div></div>${data.followUps.map(f=>`<article class="prospect-follow-up ${new Date(f.dueAt)<new Date()&&['open','in_progress'].includes(f.status)?'overdue':''}"><div><b>${context.escape(f.subject)}</b><p>${context.escape(f.details||'No additional details')}</p><small>${context.escape(f.prospectChannel||'call')} Ã‚· ${context.escape(f.status.replaceAll('_',' '))} Ã‚· ${fmt(f.dueAt)} Ã‚· ${context.escape(f.assigneeName)}</small></div>${['open','in_progress'].includes(f.status)&&data.canOperate?`<button class="btn btn-sm" data-follow-complete="${f.id}">Complete</button>`:''}</article>`).join('')||'<div class="prospect-empty">No follow-ups recorded.</div>'}</section><aside class="prospect-actions"><div data-prospect-error hidden></div>${owner?`<details open><summary>${noteOnly?'Add internal note':'Record call or note'}</summary><form class="form-grid compact-form" data-activity-form><input type="hidden" name="correctsActivityId"><label class="span3" data-correction-field hidden>Correction reason *<input name="correctionReason"></label><label>Type<select name="activityType">${noteOnly?'': '<option value="call">Call</option>'}<option value="note">Note</option></select></label><label data-call-field ${noteOnly?'hidden':''}>Direction<select name="direction"><option value="outbound">Outbound</option><option value="inbound">Inbound</option></select></label><label data-call-field ${noteOnly?'hidden':''}>Outcome<select name="outcome">${options([['answered','Answered'],['no_answer','No answer'],['callback_requested','Callback requested'],['interested','Interested'],['not_interested','Not interested'],['declined','Declined'],['voicemail','Voicemail'],['consumer_ended','Consumer ended call'],['invalid_number','Invalid number'],['other','Other']])}</select></label><label data-call-field>Next step<select name="nextStep"><option value="">Choose next step</option>${options([['follow_up','Schedule follow-up'],['retry_cadence','Retry by cadence'],['close_not_interested','Close â€” not interested'],['close_dnc','Close â€” do not contact'],['close_wrong_number','Close â€” wrong number'],['convert','Continue to conversion']])}</select></label><label data-call-field>Follow-up due (Dubai)<input name="followUpDueAt" type="datetime-local"></label><label data-call-field>Follow-up channel<select name="followUpChannel"><option value="call">Call</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></label><label data-call-field class="span3">Follow-up subject<input name="followUpSubject"></label><label data-call-field>Not-interested reason<select name="notInterestedReason"><option value="">Select when applicable</option>${options([['budget','Budget does not fit'],['timing','Timing â€” not now'],['committed','Already bought or committed'],['not_investor','Not an investor'],['location_product','Location or product does not fit'],['other_agent','Prefers another agent or developer'],['other','Other']])}</select></label><label data-call-field>Reason details<input name="notInterestedNote"></label><label data-call-field>Recontact month<input name="recontactMonth" type="month"></label><label data-call-field class="span3">Do-not-contact reason<input name="doNotContactReason"></label><label data-call-field class="span3">Company calling number<select name="companyCallingNumberId"><option value="">Select registered number</option>${numberOptions}</select></label><label class="span3">Notes *<textarea name="notes" required rows="4"></textarea></label><label class="span3 warning-ack"><input name="warningAcknowledged" type="checkbox" value="true"> I acknowledge any repeat-call or recorded-window warning</label><label class="span3">Reason for proceeding after a warning<input name="warningReason"></label><button class="btn btn-primary span3" ${p.status==='converted'?'disabled':''}>Append evidence</button></form></details><details><summary>Add follow-up</summary><form class="form-grid compact-form" data-follow-form><label class="span2">Action *<input name="subject" required></label><label>Due *<input name="dueAt" type="datetime-local" required></label><label>Channel<select name="channel"><option value="call">Call</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></label><label>Priority<select name="priority"><option>normal</option><option>high</option><option>urgent</option><option>low</option></select></label><label class="span3">Details<textarea name="details" rows="3"></textarea></label><label class="span3 warning-ack"><input name="warningAcknowledged" type="checkbox" value="true"> I acknowledge any repeat-contact warning</label><label class="span3">Reason for proceeding after a warning<input name="warningReason"></label><button class="btn btn-primary span3" ${blocked?'disabled':''}>Save follow-up Task</button></form></details>`:''}<details><summary>Status and contact restriction</summary>${p.status==='converted'?'<p>This converted record is read-only.</p>':`<form class="form-grid compact-form" data-status-form><label>Status<select name="status">${options(statusOptions,p.status)}</select></label><label class="span2">Reason (required for DNC/release)<input name="reason"></label><label class="span2">Evidence reference<input name="evidenceReference"></label><button class="btn span3">Update status</button></form>`}</details>${data.canManage?`<details><summary>Manual DNCR evidence (not a registry check)</summary><form class="form-grid compact-form" data-dncr-form><label>Action<select name="action"><option value="record">Record manual DNCR evidence</option><option value="release">Release manual DNCR restriction</option></select></label><label class="span2">Evidence reference (required to record)<input name="evidenceReference"></label><label class="span3">Release reason (required to release)<input name="reason"></label><button class="btn span3">Apply governed DNCR action</button></form></details><details><summary>Reassign prospect</summary><form class="form-grid compact-form" data-reassign-form><label class="span2">Owner<select name="ownerId" required><option value="">Select Agent</option></select></label><label class="span2">Reason *<input name="reason" minlength="5" required></label><button class="btn span3">Reassign</button></form></details>`:''}${owner&&p.status!=='converted'?`<details><summary>Convert to Customer</summary><div data-conversion-panel><button class="btn btn-primary" type="button" data-check-conversion>Check duplicates and convert</button></div></details>`:''}${p.convertedContactId?`<button class="btn btn-primary" type="button" data-open-customer="${p.convertedContactId}">Open converted Customer</button>`:''}</aside></div></div>`;}

async function bindProspectInterest(body,data,refresh,showError){
 const panel=document.createElement('section');
 panel.className='dashboard-panel';
 panel.innerHTML='<h3>Prospect interest</h3><p>Loading…</p>';
 body.prepend(panel);
 try{
   const esc=context.escape;
   const info=await context.api('/crm/prospects/'+encodeURIComponent(data.prospect.id)+'/interest');
   const reason=body.querySelector('[data-activity-form] select[name="notInterestedReason"]');
   if(reason&&info.reasons){
     reason.innerHTML='<option value="">Select when applicable</option>'+info.reasons.map(item=>
       `<option value="${esc(item.stableCode)}">${esc(item.displayLabelEn)}</option>`).join('');
   }
   const fields={purpose:'Purpose',budgetBand:'Budget band',propertyType:'Property type',market:'Market',timeline:'Timeline'};
   if(!info.editable){
     const values=Object.values(info.values).filter(Boolean).map(value=>value.replaceAll('_',' '));
     const areas=info.selections.map(area=>area.businessLabel);
     panel.innerHTML=`<h3>Prospect interest</h3><p>${esc([...values,...areas].join(' · ')||'No interest recorded')}</p>`;
     return;
   }
   const selected=new Set(info.selections.map(area=>area.id));
   const areaOptions=[...info.areas,...info.selections.filter(area=>area.active===0)];
   panel.innerHTML=`<h3>Prospect interest</h3><form class="form-grid compact-form">
     ${Object.entries(fields).map(([key,label])=>{
       const value=info.values[key]||'';
       const choices=info.choices[key]||[];
       const retired=value&&!choices.some(item=>item.stableCode===value)
         ? `<option value="${esc(value)}" selected>${esc(value)} (retired)</option>`:'';
       return `<label>${label}<select name="${key}"><option value="">Unspecified</option>${retired}
         ${choices.map(item=>`<option value="${esc(item.stableCode)}" ${item.stableCode===value?'selected':''}>${esc(item.displayLabelEn)}</option>`).join('')}
       </select></label>`;
     }).join('')}
     <label>Preferred areas<select name="areaIds" multiple>${areaOptions.map(area=>
       `<option value="${esc(area.id)}" ${selected.has(area.id)?'selected':''}>${esc(area.businessLabel)}${area.active===0?' (retired)':''}</option>`).join('')}</select></label>
     <button class="btn" type="submit">Save interest</button></form>`;
   panel.querySelector('form').onsubmit=async event=>{
     event.preventDefault();
     const form=new FormData(event.currentTarget);
     const values=Object.fromEntries(Object.keys(fields).map(key=>[key,form.get(key)||null]));
     try{
       await context.api('/crm/prospects/'+encodeURIComponent(data.prospect.id)+'/interest',
         {method:'PATCH',body:{...values,areaIds:form.getAll('areaIds')}});
       await refresh();
     }catch(error){showError(error.message);}
   };
 }catch(error){panel.textContent=error.message;}
}

async function bindDetail(host,data){
 const body=host.querySelector('[data-prospect-detail]');body.innerHTML=detailBody(data);body.insertAdjacentHTML('afterbegin',editSection(data));
 const header=host.querySelector('.prospect-detail-header');if(header){const p=data.prospect;header.querySelector('h2').textContent=p.displayName||'Unnamed prospect';header.querySelector('.prospect-detail-meta').innerHTML=`${statusPill(p.status)}<span>${context.escape(p.phone)}</span>${p.email?`<span>${context.escape(p.email)}</span>`:''}<span>Owner: ${context.escape(p.ownerName)}</span>`;}
 const activityCards=[...body.querySelectorAll('.prospect-event')].slice(0,data.activities.length);data.activities.forEach((item,index)=>{if(!item.warningCodes?.length)return;const small=activityCards[index]?.querySelector('small');if(!small)return;const raw=item.warningCodes.join(', '),friendly=item.warningCodes.map(code=>warningLabels[code]||code.replaceAll('_',' ')).join('; ');small.textContent=small.textContent.replace(raw,`${friendly} Ã‚· Reason: ${item.warningReason||'Not recorded'}`);});
 const followCards=[...body.querySelectorAll('.prospect-follow-up')];data.followUps.forEach((item,index)=>{if(!item.policyWarningCodes?.length)return;const small=followCards[index]?.querySelector('small');if(!small)return;small.textContent+=` Ã‚· Warning: ${item.policyWarningCodes.map(code=>warningLabels[code]||code.replaceAll('_',' ')).join('; ')} Ã‚· Reason: ${item.policyWarningReason||'Not recorded'}`;});
 const showError=message=>{const box=body.querySelector('[data-prospect-error]');box.hidden=false;box.className='prospect-error';box.textContent=message;box.scrollIntoView({block:'center'});};const refresh=async()=>{const next=await context.api(`/crm/prospects/${data.prospect.id}`);await bindDetail(host,next);};const refreshAll=async()=>{const id=data.prospect.id;host.remove();await render();await open(id);};
 await bindProspectInterest(body,data,refresh,showError);
 body.querySelector('[data-prospect-edit]')?.addEventListener('submit',async event=>{event.preventDefault();try{const values=Object.fromEntries(new FormData(event.currentTarget)),saved=await context.api(`/crm/prospects/${data.prospect.id}`,{method:'PATCH',body:values}),timezoneNote=saved.timezoneSuggestion&&saved.timezoneSuggestion!==data.prospect.timezone?` Suggested timezone updated to ${saved.timezoneSuggestion}.`:'';context.toast(`Prospect details updated and audited.${timezoneNote}`);await refresh();}catch(error){showError(error.message);}});
 body.querySelectorAll('[data-correct-activity]').forEach(button=>button.onclick=()=>{const form=body.querySelector('[data-activity-form]'),reason=body.querySelector('[data-correction-field]');form.elements.correctsActivityId.value=button.dataset.correctActivity;reason.hidden=false;reason.querySelector('input').required=true;form.scrollIntoView({block:'center'});form.elements.notes.focus();});
 body.querySelector('[data-activity-form]')?.addEventListener('change',event=>{if(event.target.name==='activityType')body.querySelectorAll('[data-call-field]').forEach(x=>x.hidden=event.target.value==='note');});
 body.querySelector('[data-activity-form]')?.addEventListener('submit',async event=>{event.preventDefault();try{const values=Object.fromEntries(new FormData(event.currentTarget));if(values.followUpDueAt)values.followUpDueAt+='+04:00';await context.api(`/crm/prospects/${data.prospect.id}/activities`,{method:'POST',body:values});context.toast('Prospect evidence appended');await refresh();if(values.nextStep==='convert')body.querySelector('[data-check-conversion]')?.click();}catch(error){showError(error.message);}});
 body.querySelector('[data-follow-form]')?.addEventListener('submit',async event=>{event.preventDefault();try{const values=Object.fromEntries(new FormData(event.currentTarget));values.isNextAction=Boolean(values.isNextAction);await context.api(`/crm/prospects/${data.prospect.id}/follow-ups`,{method:'POST',body:values});context.toast('Follow-up saved');refresh();}catch(error){showError(error.message);}});
 body.querySelectorAll('[data-follow-complete]').forEach(button=>button.onclick=async()=>{const outcome=window.prompt('Completion outcome');if(!outcome)return;try{await context.api(`/crm/prospects/${data.prospect.id}/follow-ups/${button.dataset.followComplete}`,{method:'PATCH',body:{status:'completed',outcome}});refresh();}catch(error){showError(error.message);}});
 body.querySelector('[data-status-form]')?.addEventListener('submit',async event=>{event.preventDefault();try{await context.api(`/crm/prospects/${data.prospect.id}/status`,{method:'PATCH',body:Object.fromEntries(new FormData(event.currentTarget))});context.toast('Prospect status updated');refresh();}catch(error){showError(error.message);}});
 body.querySelector('[data-dncr-form]')?.addEventListener('submit',async event=>{event.preventDefault();try{const values=Object.fromEntries(new FormData(event.currentTarget));await context.api(`/crm/prospects/${data.prospect.id}/dncr`,{method:'POST',body:values,refreshWorkspace:false});context.toast(values.action==='record'?'Manual DNCR evidence recorded':'Manual DNCR restriction released');await refreshAll();}catch(error){showError(error.message);}});
 const reassign=body.querySelector('[data-reassign-form]');if(reassign){try{const list=await context.api('/crm/prospects');reassign.elements.ownerId.innerHTML='<option value="">Select Agent</option>'+list.agents.map(x=>`<option value="${x.id}" ${x.id===data.prospect.ownerId?'selected':''}>${context.escape(x.name)}</option>`).join('');}catch{}reassign.onsubmit=async event=>{event.preventDefault();try{await context.api(`/crm/prospects/${data.prospect.id}/reassign`,{method:'POST',body:Object.fromEntries(new FormData(event.currentTarget))});context.toast('Prospect reassigned');refresh();}catch(error){showError(error.message);}};}
 body.querySelector('[data-check-conversion]')?.addEventListener('click',async()=>{try{const result=await context.api(`/crm/prospects/${data.prospect.id}/conversion-matches`),panel=body.querySelector('[data-conversion-panel]');if(result.outsideScopeMatch){panel.innerHTML='<div class="prospect-error">A matching Customer or Lead exists outside your scope. Ask your Manager to review it.</div>';return;}panel.innerHTML=`<form data-convert-form class="form-grid compact-form"><div class="span3 prospect-conversion-matches">${result.matches.length?result.matches.map((m,index)=>`<label><input type="radio" name="existingContactId" value="${m.id}" ${index===0?'checked':''}><span><b>${context.escape(m.fullName)}</b></span></label>`).join(''):'<p>No matching Customer. A new Customer will be created if name and email are present.</p>'}</div>${result.matches.length?'':`<label>Customer role<select name="contactType"><option>buyer</option><option>seller</option><option>landlord</option><option>tenant</option><option>investor</option><option>other</option></select></label>`}<button class="btn btn-primary span3">${result.matches.length?'Link Customer and convert':'Create Customer and convert'}</button></form>`;panel.querySelector('[data-convert-form]').onsubmit=async event=>{event.preventDefault();try{const converted=await context.api(`/crm/prospects/${data.prospect.id}/convert`,{method:'POST',body:Object.fromEntries(new FormData(event.currentTarget))});context.toast(converted.idempotent?'Prospect was already converted':'Prospect converted to Customer');host.remove();await render();context.openCustomer(converted.contactId);}catch(error){showError(error.message);}};}catch(error){showError(error.message);}});
 body.querySelector('[data-open-customer]')?.addEventListener('click',event=>{host.remove();context.openCustomer(event.currentTarget.dataset.openCustomer);});
}
async function open(id,{focusCall=false}={}){try{const data=await context.api(`/crm/prospects/${id}`),host=context.openRecord(detailHtml(data),{type:'prospect',id,returnTab:'prospectDiary'});await bindDetail(host,data);
 if(focusCall){
   const form=host.querySelector('[data-activity-form]');
   if(form){form.scrollIntoView({block:'center'});form.elements.outcome?.focus();}
 }
}catch(error){context.toast(error.message,8000);}}
window.renderProspectDiary=async options=>{context=options;if(state.view===null)state.view=options.actorJobRole==='sales_agent'?'today':'diary';await render();};
window.openProspectDiaryRecord=async(id,options)=>{context=options;await open(id);};
window.resetProspectDiaryState=()=>Object.assign(state,{q:'',status:'',due:'',ownerId:'',scrollTop:0,view:null,todayAgent:null});
})();
