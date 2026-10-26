(()=>{
  const safe=value=>esc(String(value??''));
  const unavailable=(title,provider)=>overlay(`<div class="modal"><button class="close-x">×</button><div class="eyebrow">LOCAL INTEGRATION READINESS</div><h2>${safe(title)}</h2><div class="opportunity-safety-note"><b>${safe(provider)} is safely disabled</b><span>The CORE workflow is ready for local review. No provider account, mailbox, calendar, credential or webhook has been connected. Provider activation will be a separately approved sandbox step.</span></div></div>`);

  window.openNysaEmailComposer=async lead=>{
    let status;try{status=await api('/integrations/microsoft365-email/status');}catch(error){return toast(error.message,7000);}
    if(!status.enabled||status.connection?.status!=='active')return unavailable(`Email ${lead.contactName}`, 'Microsoft 365 Email');
    const dialog=overlay(`<div class="modal lead-modal"><button class="close-x">×</button><div class="eyebrow">OWN MICROSOFT 365 MAILBOX</div><h2>Email ${safe(lead.contactName)}</h2><p class="tool-note">Recipient authority comes only from this Customer record. There is no editable To, CC or BCC field.</p><form id="core-email-form" class="form-grid"><div><label>Purpose</label><select name="purpose"><option value="service_follow_up">Service follow-up</option><option value="meeting_coordination">Meeting coordination</option><option value="viewing_coordination">Viewing coordination</option></select></div><div class="span2"><label>Subject *</label><input name="subject" required minlength="3" maxlength="200"></div><div class="span3"><label>Message *</label><textarea name="body" rows="9" required maxlength="20000"></textarea></div><label class="span3 choice-row"><input name="confirmed" type="checkbox" required> I reviewed this exact message and Customer record.</label><button class="btn btn-primary span3">Prepare and confirm send</button></form></div>`),form=$('#core-email-form',dialog);
    form.addEventListener('submit',async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));try{const prepared=await api(`/crm/leads/${lead.id}/email-drafts`,{method:'POST',body:{purpose:values.purpose,subject:values.subject,body:values.body}});await api(`/crm/leads/${lead.id}/email-drafts/${prepared.draft.id}/send`,{method:'POST',body:{draftVersion:prepared.draft.version,confirmation:'SEND_EMAIL'},headers:{'X-Idempotency-Key':crypto.randomUUID()}});toast('Email confirmed and queued for reconciliation');dialog.remove();}catch(error){toast(error.message,7000);}});
  };

  window.openNysaCalendlyMeeting=async lead=>{
    let status;try{status=await api('/integrations/calendly/status');}catch(error){return toast(error.message,7000);}
    if(!status.enabled||!status.connection||!status.host)return unavailable(`Schedule with ${lead.contactName}`, 'Calendly');
    const choices=status.eventTypes.filter(item=>item.kind==='customer_meeting');if(!choices.length)return unavailable(`Schedule with ${lead.contactName}`, 'Calendly customer-meeting mapping');
    const dialog=overlay(`<div class="modal"><button class="close-x">×</button><div class="eyebrow">MAPPED CALENDLY EVENT</div><h2>Schedule with ${safe(lead.contactName)}</h2><form id="calendly-meeting-form" class="form-grid"><div class="span2"><label>Approved meeting format</label><select name="eventTypeMappingId">${choices.map(item=>`<option value="${safe(item.id)}">${safe(item.durationMinutes)} minutes · ${safe(item.locationMode)}</option>`).join('')}</select></div><label class="span3 choice-row"><input name="confirmed" type="checkbox" required> Prepare one single-use scheduling link for this exact Lead.</label><button class="btn btn-primary span3">Prepare scheduling link</button></form></div>`),form=$('#calendly-meeting-form',dialog);
    form.addEventListener('submit',async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));try{await api(`/crm/leads/${lead.id}/calendly/meeting-intents`,{method:'POST',body:{eventTypeMappingId:values.eventTypeMappingId,confirmation:'PREPARE_LINK'}});toast('Calendly scheduling link prepared');dialog.remove();}catch(error){toast(error.message,7000);}});
  };

  async function renderAdminIntegrationReadiness(){
    if(location.hash!=='#admin'||document.querySelector('#email-calendly-admin-readiness'))return;
    const view=document.querySelector('#view');if(!view)return;
    let email,calendly;try{[email,calendly]=await Promise.all([api('/integrations/microsoft365-email/status'),api('/admin/integrations/calendly/status')]);}catch{return;}
    view.insertAdjacentHTML('afterbegin',`<section id="email-calendly-admin-readiness" class="card"><div class="eyebrow">RELEASE 3D · INTEGRATION READINESS</div><h2>Email and scheduling</h2><div class="kv-grid"><div><b>Microsoft 365 Email</b>${email.enabled?'Enabled':'Disabled pending sandbox approval'}<br><small>Each user’s own mailbox only</small></div><div><b>Calendly team</b>${calendly.enabled?'Enabled':'Disabled pending sandbox approval'}<br><small>${calendly.hosts?.length||0} host mappings · ${calendly.eventTypes?.length||0} event mappings</small></div><div><b>Provider access</b>No external connection in this local build</div></div></section>`);
  }
  window.addEventListener('hashchange',()=>setTimeout(renderAdminIntegrationReadiness,100));
  new MutationObserver(()=>renderAdminIntegrationReadiness()).observe(document.body,{childList:true,subtree:true});
})();
