(()=>{
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
  }catch{root.innerHTML='<p role="alert">Lead integration setup is unavailable. Refresh to try again; live sending remains off.</p>';}
 };
})();
