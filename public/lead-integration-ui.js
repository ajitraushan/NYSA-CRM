(()=>{
 window.renderLeadIntegrationSetup=async({root,api,escape:esc})=>{
  if(!root)return;
  root.innerHTML='<p role="status">Loading lead integration setup…</p>';
  try{
   const data=await api('/admin/lead-integrations/setup');if(!root.isConnected)return;
   const draft=data.draft||{};
   root.innerHTML=`<p class="tool-note"><b>Setup draft · live sending is off.</b> Save connection references here. A saved draft does not connect a provider or activate outreach. Passwords and API keys belong in protected connection setup.</p>
    <div class="kv-grid"><div><b>Meta</b><br>Connection test pending</div><div><b>WhatsApp</b><br>New number and templates needed</div><div><b>Email</b><br>Mailbox connection needed</div><div><b>Calendar</b><br>Sunita’s connection needed</div></div>
    <form class="form-grid" data-lead-integration-form>
     <div><label for="lead-meta-pages">Meta Page IDs</label><input id="lead-meta-pages" name="pageIds" value="${esc((draft.pageIds||[]).join(', '))}" placeholder="Separate IDs with commas"><small>Only NYSA Pages approved for this pilot.</small></div>
     <div><label for="lead-meta-forms">New consent form IDs</label><input id="lead-meta-forms" name="formIds" value="${esc((draft.formIds||[]).join(', '))}" placeholder="Separate IDs with commas"></div>
     <div><label for="lead-wa-ref">WhatsApp provider number reference</label><input id="lead-wa-ref" name="whatsappSenderRef" value="${esc(draft.whatsappSenderRef||'')}"><small>New pilot number. No REM migration.</small></div>
     <div><label for="lead-email-sender">Email sender</label><input id="lead-email-sender" value="lead@nysarealty.com" readonly></div>
     <div><label for="lead-calendar-ref">Sunita’s calendar connection reference</label><input id="lead-calendar-ref" name="calendarConnectionRef" value="${esc(draft.calendarConnectionRef||'')}"></div>
     <div class="span2"><button class="btn btn-primary" type="submit">Save setup draft</button> <button class="btn" type="button" data-refresh-lead-setup>Refresh status</button></div>
    </form><p data-lead-setup-result role="status" aria-live="polite"></p>
    <h3>Approved pilot limits</h3><p>UAE and India only · Voice: USD 20/day, 8 minutes, 2 simultaneous calls · WhatsApp and email: USD 10/day · Budgets reset at Dubai midnight.</p>
    <p>AI chat stays open up to 24 hours; 10 replies without booking progress trigger human handoff.</p>
    <h3>Recovery overview</h3><p>${esc(data.pending_receipts)} Meta receipts awaiting retrieval · ${esc(data.exceptions)} cases need attention. Operational lead details remain in the agent’s permitted workspace.</p>`;
   const result=root.querySelector('[data-lead-setup-result]');
   root.querySelector('[data-refresh-lead-setup]').addEventListener('click',()=>window.renderLeadIntegrationSetup({root,api,escape:esc}));
   root.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;
    const values=Object.fromEntries(new FormData(form));
    const ids=value=>value.split(',').map(v=>v.trim()).filter(Boolean);
    try{const saved=await api('/admin/lead-integrations/setup',{method:'POST',body:{revision:data.revision,
      pageIds:ids(values.pageIds),formIds:ids(values.formIds),whatsappSenderRef:values.whatsappSenderRef.trim(),
      calendarConnectionRef:values.calendarConnectionRef.trim(),emailSender:'lead@nysarealty.com'}});
      data.revision=saved.revision;result.textContent='Setup draft saved. Live sending remains off.';
    }catch(error){result.textContent=error.message||'Setup could not be saved';}finally{button.disabled=false;}
   });
  }catch{root.innerHTML='<p role="alert">Lead integration setup is unavailable. Refresh to try again; live sending remains off.</p>';}
 };
})();
