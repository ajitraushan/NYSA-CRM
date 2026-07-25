function dealWorkspaceHTML({deals=[],bookings=[],writable}){
  const activeBooking=bookings.find(x=>x.status==='reserved'),deal=deals[0];
  if(!deal){
    const create=writable&&activeBooking?`<details class="opportunity-inline-form" open><summary>Create governed Deal from active reservation</summary>
      <div class="deal-origin-summary"><b>${esc(activeBooking.bookingReference)} · ${esc(activeBooking.listingProject)}</b><span>Exact accepted Offer Revision ${esc(activeBooking.acceptedRevisionNumber)} · ${fmtPrice(activeBooking.bookingAmount,activeBooking.currency)}</span></div>
      <form id="deal-create-form" class="form-grid" data-booking-id="${esc(activeBooking.id)}">
        ${activeBooking.offerType==='commercial'?'<div><label>Commercial transaction *</label><select name="commercialMode"><option value="">Select sale or rental</option><option value="sale">Commercial sale</option><option value="rental">Commercial rental</option></select></div>':''}
        <div><label>Target completion *</label><input type="datetime-local" name="targetCompletionAt" required></div>
        <div class="span3 opportunity-safety-note"><b>Terms cannot be retyped here</b><span>The Deal inherits the exact accepted offer revision, listing and active reservation. CORE will also add the Opportunity customer as the primary buyer or tenant and instantiate the approved checklist version.</span></div>
        <button class="btn btn-primary span3">Create governed Deal</button>
      </form></details>`:'';
    const blocker=!activeBooking?'<div class="deal-gate blocked"><b>Deal not ready</b><span>An active governed reservation is required before a Deal can be created.</span></div>':'';
    return `<div class="comments deal-workspace" data-flow-pane="deal"><h3>6. Deal and completion</h3><p class="tool-note">Deal is the authoritative completion record. It begins only from an active reservation and exact accepted offer revision.</p>${blocker}${create}</div>`;
  }
  const parties=(deal.parties||[]).filter(x=>!x.effectiveTo),items=deal.checklistItems||[],gates=deal.closureGates||[],
    dealEditable=writable&&['draft','completion_in_progress'].includes(deal.status),
    checklistEditable=(writable||ME?.jobRole==='director')&&['draft','completion_in_progress'].includes(deal.status),
    requiredPartiesComplete=Boolean(gates.find(x=>x.code==='parties')?.complete),
    managementReviewComplete=items.some(x=>x.required&&['manager','director'].includes(x.responsibleRole)&&x.status==='completed'),
    partyAdditionAllowed=dealEditable&&!managementReviewComplete,
    approvalReady=gates.filter(x=>['terms','reservation','parties','checklist'].includes(x.code)).every(x=>x.complete),
    closureAuthority=ME?.jobRole==='director'||(ME?.jobRole==='manager'&&!['commercial_sale','commercial_rental'].includes(deal.dealType));
  const partyRows=parties.map(x=>`<div class="deal-party-row"><div><b>${esc(x.partyName)}</b><span>${esc(x.partyRole.replaceAll('_',' '))} · ${esc(x.side.replaceAll('_',' '))}</span></div><small>${esc(x.sourceEvidence)}</small></div>`).join('');
  const itemRows=items.map(x=>{const roleAllowed=x.responsibleRole==='sales_agent'?['sales_agent','manager'].includes(ME?.jobRole):x.responsibleRole===ME?.jobRole;return`<article class="deal-checklist-item ${x.status}" data-checklist-item-id="${esc(x.id)}" data-item-version="${esc(x.version)}"><div><b>${esc(x.displayOrder)}. ${esc(x.label)}</b><span>${esc(x.responsibleRole.replaceAll('_',' '))} · ${x.required?'Required':'Optional'}${x.evidenceRequired?' · Evidence required':''}</span></div><strong>${esc(x.status.replaceAll('_',' '))}</strong>${checklistEditable&&roleAllowed&&x.status!=='completed'?`<form class="deal-checklist-form"><input name="evidenceReference" required placeholder="Evidence reference or maintained record"><input type="hidden" name="status" value="completed"><button class="btn btn-sm">Mark complete</button></form>`:x.evidenceReference?`<small>Evidence: ${esc(x.evidenceReference)}</small>`:`<small>${roleAllowed?'Evidence not yet recorded':`Awaiting ${esc(x.responsibleRole.replaceAll('_',' '))}`}</small>`}</article>`}).join('');
  const approvalAction=['draft','completion_in_progress'].includes(deal.status)&&approvalReady?
    closureAuthority?`<form id="deal-approval-form" class="form-grid opportunity-inline-form">
      <div class="span2"><label>Closure approval decision basis *</label><input name="reason" minlength="5" required placeholder="Reviewed completion evidence and approved for closure"></div>
      <div><label>Approval evidence reference *</label><input name="evidenceReference" required placeholder="Approval email, meeting or maintained record"></div>
      <button class="btn btn-primary span3">Approve Deal for authoritative closure</button>
    </form>`:`<div class="deal-gate blocked"><b>Closure approval required</b><span>${['commercial_sale','commercial_rental'].includes(deal.dealType)?'A Director must approve this commercial Deal.':'The managed-team Manager or a Director must approve this Deal.'}</span></div>`:
    deal.status==='approved'?
      closureAuthority?`<form id="deal-close-won-form" class="form-grid opportunity-inline-form">
        <div><label>Actual completion *</label><input type="datetime-local" name="actualCompletionAt" required></div>
        <div><label>Final evidence reference *</label><input name="evidenceReference" required placeholder="Transfer, tenancy or completion record"></div>
        <div class="span3"><label>Final completion note *</label><textarea name="completionNote" minlength="5" required></textarea></div>
        <label class="span3"><input type="checkbox" name="confirmAuthoritativeClosure" required> I confirm the transaction is complete and CORE should close the Deal, Opportunity, reservation and inventory.</label>
        <button class="btn btn-primary span3">Close Deal as Won</button>
      </form>`:`<div class="deal-gate blocked"><b>Approved — authoritative closure pending</b><span>The authorized Manager or Director must complete the final Closed Won action.</span></div>`:
    deal.status==='closed_won'?`<div class="deal-gate complete"><b>Deal authoritatively closed won</b><span>${fmtDate(deal.actualCompletionAt)} · ${esc(deal.closedByName||'Authorized approver')} · Evidence ${esc(deal.closureEvidenceReference)}</span></div>`:
    deal.status==='closed_lost'?`<div class="deal-gate blocked"><b>Deal closed lost</b><span>${esc(deal.closedReason)} · ${esc(deal.closedByName||'Authorized approver')} · Evidence ${esc(deal.closureEvidenceReference)}</span></div>`:'';
  const lostAction=closureAuthority&&['draft','completion_in_progress','approved'].includes(deal.status)?`<details class="opportunity-inline-form deal-lost-action"><summary>Transaction will not complete</summary>
    <p class="tool-note">Use only when this governed transaction has failed. CORE will close the Deal and Opportunity, cancel the reservation and restore the inventory status held before reservation.</p>
    <form id="deal-close-lost-form" class="form-grid">
      <div><label>Controlled reason *</label><select name="reasonCode" required><option value="">Select reason</option><option value="customer_withdrew">Customer withdrew</option><option value="finance_failed">Finance failed</option><option value="legal_or_compliance">Legal or compliance</option><option value="seller_or_landlord_withdrew">Seller / landlord withdrew</option><option value="terms_not_agreed">Terms not agreed</option><option value="reservation_expired">Reservation expired</option><option value="other">Other</option></select></div>
      <div><label>Evidence reference *</label><input name="evidenceReference" required></div>
      <div class="span3"><label>Clear explanation *</label><textarea name="reason" minlength="5" required></textarea></div>
      <label class="span3"><input type="checkbox" name="confirmCloseLost" required> I confirm this transaction cannot complete and its reservation should be released.</label>
      <button class="btn span3">Close Deal as Lost and release inventory</button>
    </form></details>`:'';
  return `<div class="comments deal-workspace" data-flow-pane="deal" data-deal-id="${esc(deal.id)}" data-deal-version="${esc(deal.version)}">
    <h3>6. Deal and completion</h3>
    <div class="deal-head"><div><span>${esc(deal.dealReference)} · ${esc(deal.dealType.replaceAll('_',' '))}</span><h4>${esc(deal.listingProject)}</h4><small>Booking ${esc(deal.bookingReference)} · exact Offer Revision ${esc(deal.acceptedRevisionNumber)}</small></div><div><b>${fmtPrice(deal.agreedValue,deal.currency)}</b><span>${esc(deal.status.replaceAll('_',' '))}</span></div></div>
    <section class="deal-gates"><h4>Closure readiness</h4>${gates.map(x=>`<div class="deal-gate ${x.complete?'complete':'blocked'}"><b>${x.complete?'✓':'!'} ${esc(x.label)}</b><span>${x.complete?'Completed':'Blocks closure'}</span></div>`).join('')}<p>Checklist review confirms the evidence. Closure approval is a separate management authorization; Closed Won then updates Deal, Opportunity, reservation and inventory together.</p>${approvalAction}</section>
    <section><h4>Transaction parties</h4>${partyRows||'<div class="empty compact">No parties recorded.</div>'}
      ${partyAdditionAllowed?`<details class="opportunity-inline-form"><summary>${requiredPartiesComplete?'Add another transaction party':'Add missing required transaction party'}</summary><form id="deal-party-form" class="form-grid">
        <div><label>Party source *</label><select name="partyKind"><option value="contact">Contact</option><option value="company">Company</option></select></div>
        <div class="span2"><label>Contact / company *</label><select name="partyId" required><option value="">Loading permitted records…</option></select></div>
        <div><label>Role *</label><select name="partyRole"><option>buyer</option><option>seller</option><option>tenant</option><option>landlord</option><option>developer</option><option value="buyer_representative">Buyer representative</option><option value="seller_representative">Seller representative</option><option value="tenant_representative">Tenant representative</option><option value="landlord_representative">Landlord representative</option><option>other</option></select></div>
        <div><label>Side *</label><select name="side"><option value="buyer_side">Buyer / tenant side</option><option value="seller_side">Seller / landlord side</option><option value="neutral">Neutral</option></select></div>
        <div><label>Representation *</label><input name="representation" value="direct" required></div>
        <div class="span2"><label>Source evidence *</label><input name="sourceEvidence" required placeholder="Maintained contact/company record, mandate, email or other source"></div>
        <label><input type="checkbox" name="isPrimary"> Primary party for this role</label><button class="btn btn-primary">Add party</button>
      </form></details>`:!dealEditable?'<p class="tool-note">Transaction parties are locked because this Deal has entered approval or closure.</p>':''}</section>
    <section><h4>${esc(deal.checklistName)} · Template version ${esc(deal.templateVersionNo)}</h4><p class="tool-note">This checklist is an exact instance of the approved template version; later template changes do not rewrite this Deal.</p>${itemRows}</section>${lostAction}
  </div>`;
}

function bindDealWorkspace(root,{opportunityId,onChanged}){
  const refresh=message=>{toast(message);root.remove();onChanged();};
  const create=$('#deal-create-form',root);
  if(create){const target=create.elements.targetCompletionAt,date=new Date(Date.now()+14*86400000);target.value=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
    create.addEventListener('submit',async event=>{event.preventDefault();const body=Object.fromEntries(new FormData(create));body.targetCompletionAt=new Date(body.targetCompletionAt).toISOString();try{await api(`/crm/bookings/${create.dataset.bookingId}/deal`,{method:'POST',body});refresh('Governed Deal created with exact accepted terms, customer party and approved checklist version');}catch(error){toast(error.message,9000);}});
  }
  const partyForm=$('#deal-party-form',root),dealRoot=$('.deal-workspace[data-deal-id]',root);
  if(partyForm&&dealRoot){let options={contacts:[],companies:[]};const select=partyForm.elements.partyId,render=()=>{const rows=partyForm.elements.partyKind.value==='contact'?options.contacts:options.companies;select.innerHTML='<option value="">Select a maintained record</option>'+rows.map(x=>`<option value="${esc(x.id)}">${esc(x.fullName||x.name)}${x.email?' · '+esc(x.email):''}</option>`).join('');};
    api(`/crm/opportunities/${opportunityId}/deal-party-options`).then(value=>{options=value;render();}).catch(error=>toast(error.message,7000));
    partyForm.elements.partyKind.addEventListener('change',render);
    partyForm.addEventListener('submit',async event=>{event.preventDefault();const raw=Object.fromEntries(new FormData(partyForm)),body={partyRole:raw.partyRole,side:raw.side,representation:raw.representation,sourceEvidence:raw.sourceEvidence,isPrimary:Boolean(raw.isPrimary),contactId:raw.partyKind==='contact'?raw.partyId:null,companyId:raw.partyKind==='company'?raw.partyId:null};try{await api(`/crm/deals/${dealRoot.dataset.dealId}/parties`,{method:'POST',body});refresh('Transaction party added to the Deal');}catch(error){toast(error.message,8000);}});
  }
  root.querySelectorAll('.deal-checklist-form').forEach(form=>form.addEventListener('submit',async event=>{event.preventDefault();const item=form.closest('[data-checklist-item-id]'),body=Object.fromEntries(new FormData(form));try{await api(`/crm/deals/${dealRoot.dataset.dealId}/checklist-items/${item.dataset.checklistItemId}`,{method:'PATCH',body:{...body,expectedVersion:Number(item.dataset.itemVersion)}});refresh('Checklist item completed with its evidence reference');}catch(error){toast(error.message,8000);}}));
  const approvalForm=$('#deal-approval-form',root);
  approvalForm?.addEventListener('submit',async event=>{event.preventDefault();const body=Object.fromEntries(new FormData(approvalForm));try{await api(`/crm/deals/${dealRoot.dataset.dealId}/approval`,{method:'POST',body:{...body,expectedVersion:Number(dealRoot.dataset.dealVersion)}});refresh('Deal approved and frozen for authoritative closure');}catch(error){toast(error.message,9000);}});
  const closeForm=$('#deal-close-won-form',root);
  if(closeForm){const field=closeForm.elements.actualCompletionAt,date=new Date();field.value=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
    closeForm.addEventListener('submit',async event=>{event.preventDefault();const raw=Object.fromEntries(new FormData(closeForm)),body={...raw,actualCompletionAt:new Date(raw.actualCompletionAt).toISOString(),confirmAuthoritativeClosure:Boolean(raw.confirmAuthoritativeClosure),expectedVersion:Number(dealRoot.dataset.dealVersion)};try{await api(`/crm/deals/${dealRoot.dataset.dealId}/close-won`,{method:'POST',body});refresh('Deal, Opportunity, reservation and inventory closed together as Won');}catch(error){toast(error.message,10000);}});
  }
  const lostForm=$('#deal-close-lost-form',root);
  lostForm?.addEventListener('submit',async event=>{event.preventDefault();const raw=Object.fromEntries(new FormData(lostForm)),body={...raw,confirmCloseLost:Boolean(raw.confirmCloseLost),expectedVersion:Number(dealRoot.dataset.dealVersion)};try{await api(`/crm/deals/${dealRoot.dataset.dealId}/close-lost`,{method:'POST',body});refresh('Deal and Opportunity closed lost; reservation released and inventory restored');}catch(error){toast(error.message,10000);}});
}
