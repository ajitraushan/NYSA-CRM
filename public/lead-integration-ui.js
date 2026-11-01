(()=>{
 const sandboxMessage=error=>({SANDBOX_SETUP_DISABLED:'Protected sandbox setup is locked.',SANDBOX_STALE_CONFIGURATION:'Settings changed. Refresh before saving.',SANDBOX_ACTIVATION_NOT_APPROVED:'Sandbox sending remains locked until callback authentication is approved.',SANDBOX_UNRESOLVED_SUBMISSION:'A previous submission needs reconciliation. No further test was sent.',SANDBOX_LOCAL_QUOTA_EXHAUSTED:'The local test request budget is exhausted.',SANDBOX_RECIPIENT_CHANGE_REQUIRES_REVIEW:'Changing the fixed sandbox recipient requires review.',SANDBOX_CUSTOMER_WINDOW_CLOSED:'Receive a verified test message first; the reply window is closed.',SANDBOX_ACTION_CONFLICT:'This request reference belongs to different content. Refresh and review before another test.'})[error.message]||error.message||'Sandbox operation unavailable';
 async function renderSandbox({root,api,esc}){
  let section=root.querySelector('[data-wa-sandbox]');
  if(!section){section=document.createElement('section');section.dataset.waSandbox='';section.className='dashboard-panel';root.append(section);}
  section.innerHTML='<h3>WhatsApp sandbox</h3><p role="status">Loading protected sandbox status…</p>';
  try{
   const data=await api('/admin/whatsapp-sandbox');if(!section.isConnected)return;
   section.innerHTML=`<h3>WhatsApp sandbox · test only</h3><p>Separate from the live WhatsApp connection and REM. Saving a key keeps sending paused. No customer campaign or AI is activated here.</p>
    ${!data.setupEnabled?'<p role="status">Protected sandbox setup is locked until an approved Test setup session is enabled.</p>':`
    <p role="status" data-wa-status>${data.configured?'Credentials saved':'Not configured'} · ${data.paused===false?'Test sending unpaused':'Paused'} · ${data.relayApproved?'Callback authentication approved':'Callback authentication approval pending'}</p>
    <form class="form-grid" data-wa-credentials>
     <div><label for="wa-sandbox-key">Sandbox API key</label><input id="wa-sandbox-key" name="apiKey" type="password" autocomplete="new-password" required maxlength="4096"></div>
     <div><label for="wa-sandbox-kind">Fixed recipient type</label><select id="wa-sandbox-kind" name="recipientKind"><option value="phone">Phone number</option><option value="bsuid">Business-scoped user ID</option></select></div>
     <div><label for="wa-sandbox-recipient">Fixed recipient</label><input id="wa-sandbox-recipient" name="recipient" type="password" autocomplete="new-password" required maxlength="160"><small>Use the exact number (with +country code) or ID tied to the sandbox key.</small></div>
     <div><label for="wa-sandbox-relay">Private callback authentication secret</label><input id="wa-sandbox-relay" name="relaySecret" type="password" autocomplete="new-password" required minlength="32" maxlength="512"><button type="button" class="btn btn-sm" data-wa-generate>Generate secret</button><small>This does not configure or authenticate the provider automatically.</small></div>
     <div class="span2"><button type="submit" class="btn">Save protected sandbox credentials</button><p data-wa-save-result role="status"></p></div>
    </form>
    <p>Local request budget: ${esc(data.budget??0)} · reserved/used ${esc(data.used??0)} · locally remaining ${esc(data.remaining??data.budget??0)}. This is not the provider's remaining quota. Rejections and unknown outcomes consume a local reservation.</p>
    ${data.configured?`<p>Callback configuration: ${data.webhookConfigured?'Provider configuration receipt recorded':'Not confirmed'} · ${data.callbackObserved?'Authenticated callback observed':'Real callback test pending'}</p>${data.authMode==='basic'?`<p><button class="btn" type="button" data-wa-connect ${data.paused?'':'disabled'}>Connect sandbox callback</button></p><p data-wa-connect-result role="status"></p>`:''}<p><button class="btn" type="button" data-wa-pause>${data.paused?'Unpause approved sandbox tests':'Pause sandbox tests'}</button></p>
    <form class="form-grid" data-wa-send>
     <div><label for="wa-sandbox-type">Test message</label><select id="wa-sandbox-type" name="type"><option value="template">Predefined disclaimer template</option><option value="text">Reply to verified inbound message</option></select></div>
     <div><label for="wa-sandbox-text">Reply text</label><textarea id="wa-sandbox-text" name="text" maxlength="1500" placeholder="Synthetic test reply"></textarea></div>
     <div class="span2"><label><input type="checkbox" name="confirmed" style="width:auto" required> Send this test only to the fixed sandbox recipient.</label></div>
     <div class="span2"><button class="btn btn-primary" type="submit" ${data.sendingEnabled?'':'disabled'}>Send one sandbox test</button><p data-wa-send-result role="status"></p></div>
    </form>
    <div class="pipeline-table-wrap"><table><thead><tr><th>Test request</th><th>Submission</th><th>Delivery</th></tr></thead><tbody>${(data.attempts||[]).map(a=>`<tr><td>${esc(a.id)}</td><td>${esc(a.state)}${a.result_code?`<small>${esc(a.result_code)}</small>`:''}</td><td>${esc(a.delivery_state||'No delivery evidence')}</td></tr>`).join('')||'<tr><td colspan="3">No test submissions.</td></tr>'}</tbody></table></div>
    <p>${(data.events||[]).map(e=>`${esc(e.type)}: ${esc(e.count)}`).join(' · ')||'No verified inbound events.'}</p>`:''}`}
    <p><button type="button" class="btn btn-sm" data-wa-refresh>Refresh sandbox status</button></p>`;
   section.querySelector('[data-wa-refresh]').onclick=()=>renderSandbox({root,api,esc});
   const post=(path,body)=>api('/admin/whatsapp-sandbox/'+path,{method:'POST',headers:{'x-nysa-sandbox-action':'1'},refreshWorkspace:false,body});
   const form=section.querySelector('[data-wa-credentials]');
   if(form){
    form.querySelector('[data-wa-generate]').onclick=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));form.elements.relaySecret.value=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');};
    form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type="submit"]'),result=form.querySelector('[data-wa-save-result]');button.disabled=true;
     try{const saved=await post('connection',{...Object.fromEntries(new FormData(form)),revision:data.revision||0});data.revision=saved.revision;data.paused=true;data.sendingEnabled=false;section.querySelector('[data-wa-status]').textContent='Credentials saved - Paused';const testButton=section.querySelector('[data-wa-send] button[type="submit"]');if(testButton)testButton.disabled=true;const pauseButton=section.querySelector('[data-wa-pause]');if(pauseButton)pauseButton.textContent='Unpause approved sandbox tests';result.textContent='Encrypted credentials saved. Sandbox sending is paused. Refresh status before testing.';}
     catch(e){result.textContent=sandboxMessage(e);}finally{form.querySelectorAll('input').forEach(x=>x.value='');button.disabled=false;}
    };
   }
   const pause=section.querySelector('[data-wa-pause]');if(pause)pause.onclick=async()=>{pause.disabled=true;try{await post('pause',{paused:!data.paused,confirmed:true});await renderSandbox({root,api,esc});}catch(e){pause.textContent=sandboxMessage(e);pause.disabled=false;}};
   const connect=section.querySelector('[data-wa-connect]');if(connect)connect.onclick=async()=>{connect.disabled=true;const result=section.querySelector('[data-wa-connect-result]');try{await post('configure-webhook',{confirmed:true});result.textContent='Provider configuration receipt recorded. Send a message from the fixed test phone, then refresh to check authenticated receipt. Sending remains paused.';}catch(e){result.textContent=sandboxMessage(e);}finally{connect.disabled=!data.paused;}};
   const send=section.querySelector('[data-wa-send]');
   if(send){let actionKey=crypto.randomUUID();send.onsubmit=async event=>{event.preventDefault();const button=send.querySelector('[type="submit"]'),result=send.querySelector('[data-wa-send-result]');button.disabled=true;
    try{const values=Object.fromEntries(new FormData(send));const outcome=await post('send-test',{actionKey,confirmed:values.confirmed==='on',...(values.type==='text'?{type:'text',text:values.text}:{type:'template',templateName:'disclaimer'})});
     result.textContent=outcome.state==='accepted'?'Provider accepted the test. Refresh for delivery evidence.':outcome.state==='rejected'?'Provider rejected the test. Refresh and review the result.':'Submission outcome is unresolved. Do not resend; reconcile first.';
     if(['accepted','rejected'].includes(outcome.state))actionKey=crypto.randomUUID();
    }catch(e){result.textContent=sandboxMessage(e);}finally{button.disabled=!data.sendingEnabled;}
   };}
  }catch{section.innerHTML='<h3>WhatsApp sandbox</h3><p role="alert">Sandbox status is unavailable. Sending remains controlled on the server.</p>';}
 }
 window.renderLeadIntegrationSetup=async({root,api,escape:esc})=>{
  if(!root)return;
  root.innerHTML='<p role="status">Loading lead integration setup…</p>';
  try{
   const data=await api('/admin/lead-integrations/setup');if(!root.isConnected)return;
   const draft=data.draft||{};
   root.innerHTML=`<p class="tool-note"><b>${data.liveSendingEnabled?'Approved test outreach enabled':'Live sending is off / paused'}.</b> Save connection references here. A saved draft does not connect a provider or activate outreach. Passwords and API keys belong in protected connection setup.</p>
    <div class="kv-grid"><div><b>Meta</b><br>Connection test pending</div><div><b>WhatsApp</b><br>New number and templates needed</div><div><b>Email</b><br>Mailbox connection needed</div><div><b>Calendar</b><br>Sunita’s connection needed</div></div>
    <form class="form-grid" data-lead-integration-form>
     <div><label for="lead-meta-pages">Meta Page IDs</label><input id="lead-meta-pages" name="pageIds" value="${esc((draft.pageIds||[]).join(', '))}" placeholder="Separate IDs with commas"><small>Only NYSA Pages approved for this pilot.</small></div>
     <div><label for="lead-meta-forms">New consent form IDs</label><input id="lead-meta-forms" name="formIds" value="${esc((draft.formIds||[]).join(', '))}" placeholder="Separate IDs with commas"></div>
     <div><label for="lead-wa-ref">WhatsApp provider number reference</label><input id="lead-wa-ref" name="whatsappSenderRef" value="${esc(draft.whatsappSenderRef||'')}"><small>New pilot number. No REM migration.</small></div>
     <div><label for="lead-email-sender">Email sender</label><input id="lead-email-sender" value="lead@nysarealty.com" readonly></div>
     <div><label for="lead-calendar-ref">Sunita’s calendar connection reference</label><input id="lead-calendar-ref" name="calendarConnectionRef" value="${esc(draft.calendarConnectionRef||'')}"></div>
     <div><label for="lead-fallback-owner">Accountable operating owner</label><select id="lead-fallback-owner" name="fallbackOwnerId"><option value="">Select Sunita’s existing operating account</option>${(data.owners||[]).map(owner=>`<option value="${esc(owner.id)}" ${draft.fallbackOwnerId===owner.id?'selected':''}>${esc(owner.name)}</option>`).join('')}</select><small>This sets the automation fallback, without changing teams or roles.</small></div>
     <div><label for="lead-consent-version">Approved consent statement version</label><input id="lead-consent-version" name="statementVersion" value="${esc(draft.statementVersion||'')}"></div>
     <div><label for="lead-consent-field">Meta permission question field</label><input id="lead-consent-field" name="consentField" value="${esc(draft.consentField||'')}"></div>
     <div><label for="lead-consent-value">Exact answer granting permission</label><input id="lead-consent-value" name="consentAcceptedValue" value="${esc(draft.consentAcceptedValue||'')}"></div>
     ${[['countryField','Confirmed country field'],['timeZoneField','Confirmed timezone field'],['timelineField','Timeline field'],['budgetField','Budget field'],['purposeField','Purpose field'],['areaField','Area field']].map(([key,label])=>`<div><label for="lead-map-${key}">${label}</label><input id="lead-map-${key}" name="${key}" value="${esc(draft[key]||'')}"></div>`).join('')}
     <div class="span2"><button class="btn btn-primary" type="submit">Save setup draft</button> <button class="btn" type="button" data-refresh-lead-setup>Refresh status</button></div>
    </form><p data-lead-setup-result role="status" aria-live="polite"></p>
    <details><summary>Protected provider connections</summary><p>Credentials are encrypted on the server and never returned to this screen. Saving credentials does not enable outreach. Outlook and the existing mailbox password remain unchanged.</p>
    ${!data.connectionSetupEnabled?'<p role="status">Protected setup is locked until an approved setup session is enabled.</p>':''}
    ${[['meta','Meta',['appSecret','pageAccessToken','verifyToken','graphVersion']],['email','cPanel email',['password']],['whatsapp','360dialog',['apiKey','webhookPassword','phoneId','accountId']]].map(([provider,label,fields])=>`<form class="form-grid" data-protected-provider="${provider}"><h4 class="span2">${label} · ${(data.connections||[]).some(item=>item.provider===provider)?'Credentials saved; activation off':'Not configured'}</h4>${fields.map(field=>`<div><label for="protected-${provider}-${field}">${esc(({appSecret:'App secret',pageAccessToken:'Page access token',verifyToken:'Webhook verification token',graphVersion:'Approved Graph version',password:'Existing mailbox password',apiKey:'Provider API key',webhookPassword:'Webhook authentication secret',phoneId:'Provider phone number ID',accountId:'WhatsApp Business Account ID'})[field])}</label><input id="protected-${provider}-${field}" name="${field}" type="${['graphVersion','phoneId','accountId'].includes(field)?'text':'password'}" autocomplete="new-password" required ${data.connectionSetupEnabled?'':'disabled'}></div>`).join('')}<button class="btn" type="submit" ${data.connectionSetupEnabled?'':'disabled'}>Save protected connection</button><p data-protected-result role="status"></p></form>`).join('')}</details>
    <p><button class="btn btn-danger" type="button" data-pause-outreach>Pause outreach</button> <small>Resume remains locked until separate activation approval.</small></p><h3>Approved pilot limits</h3><p>UAE and India only · Voice: USD 20/day, 8 minutes, 2 simultaneous calls · WhatsApp and email: USD 10/day · Budgets reset at Dubai midnight.</p>
    <p>AI chat stays open up to 24 hours; 10 replies without booking progress trigger human handoff.</p>
    <h3>Recovery overview</h3><p>${esc(data.pending_receipts)} Meta receipts awaiting retrieval · ${esc(data.exceptions)} cases need attention. Operational lead details remain in the agent’s permitted workspace.</p>`;
   const result=root.querySelector('[data-lead-setup-result]');
   root.querySelector('[data-pause-outreach]').onclick=async()=>{try{await api('/admin/lead-integrations/pause',{method:'POST',body:{paused:true,confirmed:true}});await window.renderLeadIntegrationSetup({root,api,escape:esc});}catch(e){result.textContent=e.message;}};
   root.querySelector('[data-refresh-lead-setup]').addEventListener('click',()=>window.renderLeadIntegrationSetup({root,api,escape:esc}));
   root.querySelectorAll('[data-protected-provider]').forEach(form=>form.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector('button'),result=form.querySelector('[data-protected-result]');button.disabled=true;
    try{await api('/admin/lead-integrations/connections/'+form.dataset.protectedProvider,{method:'POST',body:Object.fromEntries(new FormData(form))});result.textContent='Protected credentials saved. Outreach activation is unchanged.';}
    catch(error){result.textContent=error.message||'Connection could not be saved';}
    finally{form.querySelectorAll('input').forEach(input=>input.value='');button.disabled=false;}
   }));
   root.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;
    const values=Object.fromEntries(new FormData(form));
    const ids=value=>value.split(',').map(v=>v.trim()).filter(Boolean);
    try{const saved=await api('/admin/lead-integrations/setup',{method:'POST',body:{revision:data.revision,
      pageIds:ids(values.pageIds),formIds:ids(values.formIds),whatsappSenderRef:values.whatsappSenderRef.trim(),
      calendarConnectionRef:values.calendarConnectionRef.trim(),emailSender:'lead@nysarealty.com',fallbackOwnerId:values.fallbackOwnerId,
      ...Object.fromEntries(['statementVersion','consentField','consentAcceptedValue','countryField','timeZoneField','timelineField','budgetField','purposeField','areaField'].map(key=>[key,values[key].trim()]))}});
      data.revision=saved.revision;result.textContent='Setup draft saved. Outreach activation is unchanged.';
    }catch(error){result.textContent=error.message||'Setup could not be saved';}finally{button.disabled=false;}
   });
   await renderSandbox({root,api,esc});
  }catch{root.innerHTML='<p role="alert">Lead integration setup is unavailable. Refresh to try again; live sending remains off.</p>';}
 };
})();
