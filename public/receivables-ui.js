(()=>{
  const safe=value=>esc(value),money=cents=>'AED '+(Number(cents||0)/100).toLocaleString('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const key=()=>crypto.randomUUID();
  const labels={scheduled:'Awaiting invoice',unpaid:'Awaiting payment',part_paid:'Part paid',paid:'Paid',cancelled:'Cancelled · no longer due',superseded:'Superseded · no longer due'};
  const input=(name,label,type='text',extra='')=>`<div><label for="ar-${name}">${label}</label><input id="ar-${name}" name="${name}" type="${type}" ${extra}></div>`;
  const formStatus='<p data-form-status role="status" class="span3"></p>';
  const dubaiToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function bindSubmit(form,url,bodyFn,done){
    form.addEventListener('input',()=>delete form.dataset.requestKey);
    form.onsubmit=async event=>{
      event.preventDefault();const button=form.querySelector('button[type="submit"]'),status=form.querySelector('[data-form-status]');
      if(button.disabled)return;
      button.disabled=true;status.classList.remove('receivable-form-error');status.setAttribute('role','status');status.textContent='Saving…';
      try{
        const body=bodyFn();body.idempotencyKey=form.dataset.requestKey||(form.dataset.requestKey=key());
        const data=await api(url,{method:'POST',refreshWorkspace:false,body});
        status.textContent='Saved.';await done(data);
      }catch(error){status.classList.add('receivable-form-error');status.setAttribute('role','alert');status.textContent=error.message;}finally{button.disabled=false;}
    };
  }
  window.renderCommissionReceivables=async(options={})=>{
    const {parseReceiptAmount}=await import('/money-input.js');
    const centsOf=value=>Math.round(parseReceiptAmount(value)*100);
    const view=document.querySelector('#view');
    if(!['director','accountant'].includes(ME.jobRole)){view.innerHTML='<p>Finance authority required.</p>';return;}
    view.innerHTML=`<div class="receivables-dark"><div id="ar-overview"><section class="dashboard-head"><div><div class="eyebrow">FINANCE · OPPORTUNITY RECEIVABLES</div><h2>Commission receivables</h2><p>Closed Opportunity → commission due → invoice → payment realization.</p></div><button class="btn btn-primary" id="ar-new">Create commission invoice</button></section>
      <div class="ar-stage-strip"><span>1 · Closed Won handoff</span><span>2 · Schedule commission</span><span>3 · Generate invoice</span><span>4 · Record payment</span></div>
      <p class="tool-note"><b>How this links to payout:</b> Each payment instalment is a separate receivable and invoice. Creating an invoice does not create or approve an agent payout. When Finance records an actual cleared payment, NYSA posts the commission-only Finance Receipt excluding VAT; that receipt is the source for the separate agent-credit and payout approval workflow.</p>
      <form id="ar-filter" class="ar-filter">${input('search','Search Opportunity, payer or invoice','search')}<button class="btn" type="submit">Search</button><select id="ar-status" name="status" aria-label="Status"><option value="">All</option><option value="scheduled">Awaiting invoice</option><option value="unpaid">Awaiting payment</option><option value="part_paid">Part paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option><option value="superseded">Superseded</option></select></form>
      <section id="ar-awaiting-panel" class="dashboard-panel" hidden><h3>Closed Opportunities awaiting invoicing</h3><p>The Accountant starts here. These Closed Won Opportunities have commission pending and no commission schedule yet.</p><div id="ar-awaiting"></div></section><section id="ar-adjustments"></section><div id="ar-summary"></div><section id="ar-register" aria-label="Commission Receivables Register"></section></div>
      <section id="ar-editor" class="ar-workspace" aria-label="Receivable workspace" hidden></section></div>`;
    let page=1,loadSequence=0;
    const editor=view.querySelector('#ar-editor');
    async function loadAwaiting(){const target=view.querySelector('#ar-awaiting'),panel=view.querySelector('#ar-awaiting-panel');try{const data=await api('/finance/receivables/awaiting');panel.hidden=!data.opportunities.length;if(!data.opportunities.length){target.innerHTML='';return;}target.innerHTML=data.opportunities.map(o=>`<div class="deal-gate ${o.commissionStatus==='ready'?'complete':'blocked'}"><b>${safe(o.opportunityReference)}</b><span>Closed ${safe(o.closedAt||'—')} · Commission pending ${o.expectedCommission==null?'— commission terms need review':'AED '+Number(o.expectedCommission).toLocaleString('en-AE',{minimumFractionDigits:2})} · Select the payer when creating the invoice</span><button class="btn btn-primary btn-sm" data-ar-start="${safe(o.id)}" data-ar-reference="${safe(o.opportunityReference)}">Create invoice</button></div>`).join('');target.querySelectorAll('[data-ar-start]').forEach(button=>button.onclick=()=>newSchedule(button.dataset.arStart,button.dataset.arReference));}catch(error){panel.hidden=false;target.innerHTML=`<p role="alert">${safe(error.message)}</p>`;}}
    async function load(){
      const sequence=++loadSequence,filter=view.querySelector('#ar-filter'),params=new URLSearchParams({q:filter.elements.search.value,status:filter.elements.status.value,page});
      try{
        const data=await api('/finance/receivables?'+params);if(sequence!==loadSequence||!view.querySelector('#ar-register'))return;
        const s=data.summary;
        view.querySelector('#ar-summary').innerHTML=`<div class="ar-kpis">${[['Scheduled incl. VAT',s.scheduledCents],['Invoiced outstanding',s.outstandingCents],['Collected incl. VAT',s.collectedCents],['Overdue balance',s.overdueCents]].map(([label,value])=>`<div><small>${label}</small><strong>${money(value)}</strong></div>`).join('')}</div><p>${s.invoiceCount} invoices · totals for all filtered results · as of ${safe(data.asOf)} (Dubai)</p>`;
        view.querySelector('#ar-register').innerHTML=`<h3>Commission Receivables Register</h3><p>Each row is one commission receivable instalment linked to an Opportunity.</p><div class="pipeline-table-wrap"><table class="ar-table"><thead><tr><th>Receivable / Opportunity / instalment</th><th>Payer</th><th>Invoice ref / date</th><th>Due / milestone</th><th>Commission</th><th>VAT 5%</th><th>Total</th><th>Collected / balance</th><th>Status</th><th>Next action</th></tr></thead><tbody>${data.invoices.map(i=>`<tr><td><b>${safe(i.scheduleReference)}</b><small>${safe(i.opportunityReference)} · Instalment ${i.instalmentNumber}</small></td><td>${safe(i.payerName)}<small>${safe(i.payerType)}</small></td><td>${safe(i.invoiceReference||'Not issued')}<small>${safe(i.invoiceDate||'—')}</small></td><td>${safe(i.dueDate)}<small>${safe(i.milestone)}</small></td><td>${money(i.commissionCents)}</td><td>${money(i.vatCents)}</td><td>${money(i.totalCents)}</td><td>${money(i.collectedCents)}<small>Balance ${money(i.balanceCents)}</small></td><td><b>${labels[i.status]}</b>${i.overdue?'<small class="ar-overdue">Overdue</small>':''}</td><td><button class="btn btn-sm" data-ar-open="${safe(i.id)}">${i.state==='planned'?'Generate invoice':i.balanceCents>0?'Record payment':'View receipt / details'}</button></td></tr>`).join('')||'<tr><td colspan="10">No receivables match these filters.</td></tr>'}</tbody></table></div><div class="ar-actions"><button class="btn" id="ar-prev" ${page===1?'disabled':''}>Previous page</button><span>Page ${page}</span><button class="btn" id="ar-next" ${page*50>=s.invoiceCount?'disabled':''}>Next page</button></div>`;
        view.querySelectorAll('[data-ar-open]').forEach(button=>button.onclick=()=>openInvoice(button.dataset.arOpen));
        view.querySelector('#ar-prev').onclick=()=>{page--;load();};view.querySelector('#ar-next').onclick=()=>{page++;load();};
      }catch(error){view.querySelector('#ar-register').innerHTML=`<p role="alert">${safe(error.message)}</p>`;}
    }
    const overview=view.querySelector('#ar-overview');
    function showEditor(){overview.hidden=true;editor.hidden=false;editor.scrollIntoView({block:'start'});}
    function closeEditor(){if(options.onBack)return options.onBack();editor.hidden=true;overview.hidden=false;overview.scrollIntoView({block:'start'});}
    async function newSchedule(preselectedOpportunityId=null,preselectedOpportunityReference=''){
      editor.innerHTML=`<div class="ar-actions"><h3>Create commission invoice</h3><button type="button" class="btn" id="ar-cancel-editor">Back to Receivables Register</button></div><p>Select the commission receivable from a Closed Won Opportunity and its payer, then issue one invoice for each commission payment instalment. VAT is added at 5%. NYSA assigns each invoice number beginning with NYSA-INV- and the invoice date when you confirm.</p>
        <form id="ar-create" class="form-grid">
        ${input('opp-query','Find by Opportunity reference, customer or payer','search')}<button type="button" class="btn" id="ar-find-opportunity">Find commission receivables</button><div><label for="ar-opportunity">Commission receivable / Closed Opportunity *</label><select id="ar-opportunity" name="opportunityId" required><option value="">Select a commission receivable</option></select></div>
        <div><label for="ar-payer-type">Payer type *</label><select id="ar-payer-type" name="payerType"><option value="customer">Customer</option><option value="agency">Agency</option><option value="developer">Developer</option></select></div>${input('payer-query','Find payer by name','search')}<button type="button" class="btn" id="ar-find-payer">Find payers</button><div><label for="ar-payer">Payer *</label><select id="ar-payer" name="payerId" required><option value="">Search and select a payer</option></select></div>
        <div class="span3" id="ar-opportunity-context" role="status">Select a commission receivable to review the Closed Opportunity, outstanding commission and agent split.</div>
        ${input('commissionAmount','Total commission excluding VAT (AED) *','text','data-business-amount placeholder="e.g. 100K or 1.5M" required')}
        <div class="span3"><h4>Invoices by payment instalment</h4><p>Create the first invoice now. For off-plan commission, add one separate invoice for every agreed payment instalment.</p><div id="ar-instalments"></div><button type="button" class="btn" id="ar-add-instalment">Add another invoice</button><p id="ar-preview" role="status"></p></div>
        <button type="submit" class="btn btn-primary">Generate and issue invoice(s)</button><button type="button" class="btn" id="ar-cancel-editor-bottom">Cancel</button>${formStatus}</form>`;
      showEditor();const form=editor.querySelector('#ar-create'),rows=editor.querySelector('#ar-instalments');
      const preview=()=>{
        try{
        let commission=0,vat=0;
        rows.querySelectorAll('[data-ar-instalment]').forEach(row=>{const value=row.querySelector('[name="instalmentAmount"]').value;const cents=value?centsOf(value):0;commission+=cents;vat+=Math.floor((cents*5+50)/100);});
        editor.querySelector('#ar-preview').textContent=`Invoices: commission ${money(commission)} + VAT ${money(vat)} = ${money(commission+vat)}. Commission still to allocate: ${money((form.elements.commissionAmount.value?centsOf(form.elements.commissionAmount.value):0)-commission)}.`;
        }catch(error){editor.querySelector('#ar-preview').textContent=error.message;}
      };
      let rowNumber=0;
      const addRow=()=>{
        if(rows.children.length>=60)return;rowNumber++;
        const row=document.createElement('div');row.className='ar-instalment';row.dataset.arInstalment='';
        row.innerHTML=`<div><label for="ar-amount-${rowNumber}">Invoice ${rowNumber} commission *</label><input id="ar-amount-${rowNumber}" name="instalmentAmount" type="text" data-business-amount placeholder="e.g. 40K or 2.5K" required></div><div><label for="ar-due-${rowNumber}">Payment due date *</label><input id="ar-due-${rowNumber}" name="dueDate" type="date" required></div><div><label for="ar-milestone-${rowNumber}">Payment milestone</label><input id="ar-milestone-${rowNumber}" name="milestone" maxlength="200" placeholder="e.g. Booking / construction milestone"></div>${rowNumber===1?'<span class="ar-required-row">Required first invoice</span>':'<button type="button" class="btn" data-remove>Remove this invoice</button>'}`;
        const remove=row.querySelector('[data-remove]');if(remove)remove.onclick=()=>{row.remove();delete form.dataset.requestKey;preview();};rows.append(row);preview();
      };
      editor.querySelector('#ar-add-instalment').onclick=()=>{delete form.dataset.requestKey;addRow();};addRow();form.addEventListener('input',preview);
      let contextSequence=0,payerRevision=0;
      form.elements.payerId.addEventListener('change',()=>payerRevision++);
      form.elements.payerType.addEventListener('change',()=>payerRevision++);
      form.elements.opportunityId.onchange=async()=>{
        const seq=++contextSequence,id=form.elements.opportunityId.value,target=editor.querySelector('#ar-opportunity-context'),revision=payerRevision;
        delete form.dataset.requestKey;
        if(!id){target.textContent='Select a commission receivable to review its commission terms.';return;}
        target.textContent='Loading agreed commission…';
        try{
          const {context:c}=await api(`/finance/receivables/opportunities/${id}/context`);
          if(seq!==contextSequence||form.elements.opportunityId.value!==id)return;
          if(revision===payerRevision){
            if(c.dealType==='off_plan'){
              form.elements.payerType.value='developer';
              form.elements.payerId.innerHTML='<option value="">Select the maintained Developer</option>';
              form.querySelector('[data-form-status]').textContent='Off-plan commission must be invoiced to the maintained Developer. Find and select the Developer linked to this Deal or Inventory.';
            }else if(c.stage==='Closed Won'&&c.dealStatus==='closed_won'&&c.customerId&&c.customerName){
              form.elements.payerType.value='customer';
              form.elements.payerId.innerHTML=`<option value="${safe(c.customerId)}">${safe(c.customerName)}</option>`;
              form.elements['payer-query'].value='';
              form.querySelector('[data-form-status]').textContent='Buyer selected from the Closed Opportunity. Change the payer if the commission is payable by another party.';
            }
          }
          const amount=v=>v==null?'Not recorded':money(Math.round(Number(v)*100));
          target.innerHTML=`<b>${safe(c.opportunityReference)}</b><p>Agreed gross commission: ${amount(c.agreedGrossCommission)} · Referral fee recorded on Opportunity: ${amount(c.referralFee)} · Expected company receipt: ${amount(c.expectedCompanyReceipt)} · Already scheduled excluding VAT: ${money(c.scheduledCommissionCents)}</p><p>Originating agent split: ${safe(c.originatingAgentSplitPercent??'Not recorded')}% · Servicing agent split: ${safe(c.servicingAgentSplitPercent??'Not recorded')}%. Review any referral fee before invoicing; these agreed terms do not calculate agent payout.</p>`;
          if(c.currency&&c.currency!=='AED'){target.textContent+=' Only AED schedules are supported.';return;}
          const basis=c.expectedCompanyReceipt??c.agreedGrossCommission;
          if(basis!=null&&!form.elements.commissionAmount.value){const remaining=Math.round(Number(basis)*100)-Number(c.scheduledCommissionCents);if(remaining>0)form.elements.commissionAmount.value=(remaining/100).toFixed(2);preview();}
        }catch(error){if(seq===contextSequence)target.textContent=error.message;}
      };
      const lookup=async(kind)=>{
        const select=form.elements[kind==='opportunity'?'opportunityId':'payerId'],status=form.querySelector('[data-form-status]');select.innerHTML='<option value="">Loading…</option>';
        try{
          const payerType=form.elements.payerType.value;
          const url=kind==='opportunity'?'/finance/receivables/opportunities?q='+encodeURIComponent(form.elements['opp-query'].value):'/finance/receivables/payers?type='+payerType+'&q='+encodeURIComponent(form.elements['payer-query'].value);
          const data=await api(url);if(kind==='payer'&&form.elements.payerType.value!==payerType)return;
          const found=kind==='opportunity'?data.opportunities:data.payers;
          select.innerHTML=`<option value="">${kind==='opportunity'?'Select a commission receivable':'Select a payer'}</option>`+found.map(row=>`<option value="${safe(row.id)}"${kind==='opportunity'?` data-deal-type="${safe(row.dealType||'')}"`:''}>${kind==='opportunity'?`${safe(row.opportunityReference)} · ${safe(row.displayParty)} · ${money(row.outstandingCommissionCents)} outstanding`:safe(row.name)}</option>`).join('');
          status.textContent=`Showing up to ${data.limit} matches. Narrow your search if needed.`;
        }catch(error){select.innerHTML='<option value="">Search failed</option>';status.textContent=error.message;}
      };
      editor.querySelector('#ar-find-opportunity').onclick=()=>lookup('opportunity');editor.querySelector('#ar-find-payer').onclick=()=>lookup('payer');
      form.elements.opportunityId.addEventListener('change',()=>{const status=form.querySelector('[data-form-status]'),selected=form.elements.opportunityId.selectedOptions[0];if(selected?.dataset.dealType==='off_plan'){form.elements.payerType.value='developer';form.elements.payerId.innerHTML='<option value="">Select the maintained Developer</option>';form.elements['payer-query'].value='';status.textContent='Off-plan commission must be invoiced to the maintained Developer. Select Find payers, then choose the Developer linked to this Deal or Inventory.';}});
        if(preselectedOpportunityId){form.elements.opportunityId.innerHTML=`<option value="${safe(preselectedOpportunityId)}">${safe(preselectedOpportunityReference||'Closed Opportunity')}</option>`;form.elements.opportunityId.value=preselectedOpportunityId;form.elements.opportunityId.dispatchEvent(new Event('change'));}
      form.elements.payerType.onchange=()=>{form.elements.payerId.innerHTML='<option value="">Search and select a payer</option>';delete form.dataset.requestKey;};
      editor.querySelector('#ar-cancel-editor').onclick=closeEditor;editor.querySelector('#ar-cancel-editor-bottom').onclick=closeEditor;
      bindSubmit(form,'/finance/receivables/schedules',()=>({opportunityId:form.elements.opportunityId.value,payerType:form.elements.payerType.value,payerId:form.elements.payerId.value,commissionAmount:form.elements.commissionAmount.value,
        issueInvoices:true,instalments:[...rows.querySelectorAll('[data-ar-instalment]')].map(row=>({commissionAmount:row.querySelector('[name="instalmentAmount"]').value,dueDate:row.querySelector('[name="dueDate"]').value,milestone:row.querySelector('[name="milestone"]').value}))}),async data=>{
          if(!options.onBack){await loadAwaiting();await load();}await openInvoice(data.invoices[0].id);toast(`${data.invoices.length} commission invoice${data.invoices.length===1?'':'s'} issued with NYSA invoice number${data.invoices.length===1?'':'s'}.`);
        });
    }
    async function openInvoice(id){
      editor.innerHTML='<p>Loading invoice…</p>';showEditor();
      try{
        const data=await api('/finance/receivables/'+id),i=data.invoice;
        let proofs=[];
        proofs=(await api(`/finance/opportunities/${i.opportunityId}/commission-proofs`)).proofs;
        editor.innerHTML=`<div class="ar-actions"><h3>Receivable details · ${safe(i.opportunityReference)} · instalment ${i.instalmentNumber}</h3><button class="btn" id="ar-close-detail">Back to Receivables Register</button></div><p>${safe(i.payerName)} (${safe(i.payerType)}) · Receivable ${safe(i.scheduleReference)}</p><p><b>${labels[i.status]}${i.overdue?' · Overdue':''}</b> · Invoice ${safe(i.invoiceReference||'not issued')} · Date ${safe(i.invoiceDate||'—')} · Due ${safe(i.dueDate)}</p><p>Commission ${money(i.commissionCents)} + VAT ${money(i.vatCents)} = ${money(i.totalCents)} · Collected ${money(i.collectedCents)} · Balance ${money(i.balanceCents)}</p>
          ${i.state==='planned'?`<form id="ar-issue" class="form-grid"><h4 class="span3">Generate invoice</h4><p class="span3">NYSA will assign the next invoice number in the format <b>NYSA-INV-YYYY-######</b> and use today as the invoice date. The payment due date remains ${safe(i.dueDate)}.</p><button type="submit" class="btn btn-primary">Generate invoice</button>${formStatus}</form>`:''}
          ${i.state==='issued'?`<div class="ar-document-action"><div><h4>Paper tax invoice</h4><p>Open the NYSA-branded invoice to preview, print or save it as PDF.</p></div><a class="btn btn-primary" href="/api/finance/receivables/${safe(i.id)}/document" target="_blank" rel="noopener">Preview / print invoice</a></div>`:''}
          ${i.state==='issued'&&i.balanceCents>0?`<form id="ar-collect" class="form-grid"><h4 class="span3">Record payment once</h4><p class="span3">Enter the actual amount received including VAT. For a cheque, use the clearance date; for cash or bank payment, use the date received. Do not use an expected payment, cheque issue or deposit date. This saves the invoice payment and its commission-only Finance Receipt together against this Opportunity.</p>${input('amount','Collected including VAT (AED) *','text','data-business-amount placeholder="e.g. 2.5K, 100K or 1.5M" required')}${input('receivedDate','Payment realization date *','date',`min="${safe(i.invoiceDate)}" max="${dubaiToday()}" required`)}<div><label for="ar-method">Payment method *</label><select id="ar-method" name="receiptMethod"><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="card">Card</option><option value="other_confirmed">Other confirmed</option></select></div>${input('financeReference','Incoming payment reference *','text','placeholder="Bank transaction, cheque or cash-receipt number" required minlength="3" maxlength="200"')}<div><label for="ar-proof">Payment proof already uploaded</label><select id="ar-proof" name="proofId"><option value="">No uploaded proof — enter a payment evidence reference</option>${proofs.map(p=>`<option value="${safe(p.id)}">${safe(p.fileName)} · ${safe(p.proofReference)}</option>`).join('')}</select></div>${input('evidenceReference','Payment evidence reference (required only if no proof is selected)','text','placeholder="Bank statement, deposit slip or receipt document reference" required minlength="3" maxlength="200"')}<p class="span3 tool-note">Provide either an uploaded payment proof or a payment evidence reference. You do not need both.</p><p class="span3" data-ar-payment-preview role="status"></p><button type="submit" class="btn btn-primary">Record payment and linked receipt</button>${formStatus}</form>`:''}
          <h4>Collection history</h4><div class="pipeline-table-wrap"><table><thead><tr><th>Date</th><th>Total / commission / VAT</th><th>Incoming payment reference / evidence</th><th>Finance Receipt / payout source</th><th>Status / correction</th></tr></thead><tbody>${data.collections.map(c=>`<tr><td>${safe(c.receivedDate)}</td><td>${money(c.amountCents)}<small>Commission ${c.netCommissionCents==null?'Unlinked':money(c.netCommissionCents)} · VAT ${c.vatCents==null?'Unlinked':money(c.vatCents)}</small></td><td>${safe(c.financeReference)}<small>${safe(c.evidenceReference)}</small></td><td>${c.commissionReceiptId?'Commission-only Finance Receipt created; available to the separate payout workflow':c.netCommissionCents!=null?'VAT rounding only; no payout source':'Legacy — needs reconciliation'}</td><td>${c.reversalId?`Reversed: ${safe(c.reversalReason)}`:c.netCommissionCents!=null?`<button type="button" class="btn" data-ar-reverse="${safe(c.id)}">Correct payment</button>`:'Review with Finance'}</td></tr>`).join('')||'<tr><td colspan="5">No collections recorded.</td></tr>'}</tbody></table></div><div id="ar-correction"></div>
          ${i.state==='planned'?`<details><summary>Cancel this unissued instalment</summary><p>This instalment has not been issued and may be cancelled directly.</p><form id="ar-cancel-invoice" class="form-grid">${input('reason','Cancellation reason *','text','required minlength="10" maxlength="1000"')}<button type="submit" class="btn">Cancel unissued instalment</button>${formStatus}</form></details>`:''}
          ${i.state==='issued'&&i.collectedCents===0&&ME.jobRole==='accountant'&&!data.adjustments.some(a=>a.status==='pending')?`<details open><summary>Request invoice cancellation or amendment</summary><p>An issued invoice is formally no longer due only after MD approval. An amendment supersedes this invoice and creates a replacement schedule; no credit note is created in this workflow.</p><form id="ar-adjust" class="form-grid"><div><label for="ar-requestType">Request *</label><select id="ar-requestType" name="requestType"><option value="cancel">Cancel — no longer due</option><option value="amend">Amend — replace invoice</option></select></div>${input('reason','Business reason *','text','required minlength="10" maxlength="1000"')}${input('evidenceReference','Supporting reference *','text','required minlength="3" maxlength="200"')}<div data-amend-field hidden>${input('commissionAmount','Replacement commission excluding VAT *','text','placeholder="e.g. 87K"')}</div><div data-amend-field hidden>${input('dueDate','Replacement payment due date *','date',`min="${dubaiToday()}"`)}</div><button type="submit" class="btn btn-primary">Send to MD for approval</button>${formStatus}</form></details>`:''}
          ${data.adjustments.length?`<details open><summary>Cancellation / amendment history (${data.adjustments.length})</summary><ul>${data.adjustments.map(a=>`<li><b>${safe(a.requestType==='cancel'?'Cancellation':'Amendment')} · ${safe(a.status)}</b> — ${safe(a.reason)} · evidence ${safe(a.evidenceReference)}</li>`).join('')}</ul></details>`:''}
          <details><summary>Audit history (${data.events.length})</summary><ul>${data.events.map(e=>`<li>${safe(e.createdAt)} · ${safe(e.action.replaceAll('_',' '))}</li>`).join('')}</ul></details>`;
        editor.querySelector('#ar-close-detail').onclick=closeEditor;
        const reload=async()=>{if(!options.onBack)await load();await openInvoice(id);};
        const collectionForm=editor.querySelector('#ar-collect');
        if(collectionForm){
          const receiptDate=collectionForm.elements.receivedDate,dateStatus=collectionForm.querySelector('[data-form-status]');
          const validateReceiptDate=()=>{
            const value=receiptDate.value,today=dubaiToday();let message='';
            if(value>today)message=`Payment not recorded. Payment realization date cannot be in the future. Enter the date the cheque cleared or the cash/bank payment was received, on or before ${today}.`;
            else if(value&&value<i.invoiceDate)message=`Payment not recorded. Payment realization date cannot be earlier than the invoice date (${i.invoiceDate}).`;
            receiptDate.setCustomValidity(message);
            if(message){dateStatus.dataset.receiptDateError='1';dateStatus.classList.add('receivable-form-error');dateStatus.setAttribute('role','alert');dateStatus.textContent=message;}
            else if(dateStatus.dataset.receiptDateError){delete dateStatus.dataset.receiptDateError;dateStatus.classList.remove('receivable-form-error');dateStatus.setAttribute('role','status');dateStatus.textContent='';}
          };
          receiptDate.addEventListener('input',validateReceiptDate);
          receiptDate.addEventListener('invalid',validateReceiptDate);
          const syncPaymentEvidence=()=>{const evidence=collectionForm.elements.evidenceReference,hasProof=Boolean(collectionForm.elements.proofId.value);evidence.required=!hasProof;evidence.disabled=hasProof;if(hasProof)evidence.value='';delete collectionForm.dataset.requestKey;};
          collectionForm.elements.proofId.onchange=syncPaymentEvidence;syncPaymentEvidence();
          collectionForm.elements.amount.addEventListener('input',()=>{
            const target=collectionForm.querySelector('[data-ar-payment-preview]');
            try{const gross=centsOf(collectionForm.elements.amount.value);target.textContent=`Payment ${money(gross)} including VAT. Balance after payment: ${money(i.balanceCents-gross)}. The server calculates and preserves the exact commission/VAT split.`;}
            catch(error){target.textContent=error.message;}
          });
        }
        for(const [selector,action] of [['#ar-issue','issue'],['#ar-collect','collections'],['#ar-cancel-invoice','cancel']]){
          const form=editor.querySelector(selector);if(form)bindSubmit(form,`/finance/receivables/${id}/${action}`,()=>Object.fromEntries(new FormData(form)),reload);
        }
        const adjustmentForm=editor.querySelector('#ar-adjust');
        if(adjustmentForm){
          const toggle=()=>adjustmentForm.querySelectorAll('[data-amend-field]').forEach(field=>{const amend=adjustmentForm.elements.requestType.value==='amend';field.hidden=!amend;field.querySelector('input').required=amend;});
          adjustmentForm.elements.requestType.onchange=toggle;toggle();
          bindSubmit(adjustmentForm,`/finance/receivables/${id}/adjustment-requests`,()=>Object.fromEntries(new FormData(adjustmentForm)),reload);
        }
        editor.querySelectorAll('[data-ar-reverse]').forEach(button=>button.onclick=()=>{
          const target=editor.querySelector('#ar-correction');target.innerHTML=`<form class="form-grid"><h4 class="span3">Reverse an incorrect payment</h4><p class="span3">Reverses this payment and its linked commission receipt together, retaining the original evidence and your reason. Existing frozen agent credit requires Director review first.</p>${input('correctionReason','Correction reason *','text','required minlength="10" maxlength="1000"')}<button type="submit" class="btn">Reverse payment and linked receipt</button>${formStatus}</form>`;
          const form=target.querySelector('form');bindSubmit(form,`/finance/receivables/${id}/reverse`,()=>({collectionId:button.dataset.arReverse,reason:form.elements.correctionReason.value}),reload);
        });
        showEditor();
      }catch(error){editor.innerHTML=`<p role="alert">${safe(error.message)}</p>`;}
    }
    async function loadAdjustments(){
      const target=view.querySelector('#ar-adjustments');
      try{const data=await api('/finance/receivables-adjustments');if(!data.requests.length){target.innerHTML='';return;}
        target.innerHTML=`<section class="dashboard-panel"><h3>${ME.jobRole==='director'?'Invoice approvals':'My invoice change requests'}</h3><div class="pipeline-table-wrap"><table><thead><tr><th>Opportunity</th><th>Invoice</th><th>Request</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead><tbody>${data.requests.map(r=>`<tr><td>${safe(r.opportunityReference)}</td><td>${safe(r.invoiceReference)}</td><td>${safe(r.requestType==='cancel'?'Cancel — no longer due':'Amend and replace')}</td><td>${safe(r.reason)}<small>${safe(r.evidenceReference)}</small></td><td><b>${safe(r.status)}</b></td><td>${ME.jobRole==='director'&&r.status==='pending'?`<button class="btn btn-sm" data-ar-decide="${safe(r.id)}" data-decision="approve">Approve</button> <button class="btn btn-sm" data-ar-decide="${safe(r.id)}" data-decision="reject">Reject</button>`:'—'}</td></tr>`).join('')}</tbody></table></div></section>`;
        target.querySelectorAll('[data-ar-decide]').forEach(button=>button.onclick=async()=>{const decisionReason=prompt(`${button.dataset.decision==='approve'?'Approval':'Rejection'} reason`);if(!decisionReason)return;try{await api(`/finance/receivables-adjustments/${button.dataset.arDecide}/decision`,{method:'POST',refreshWorkspace:false,body:{decision:button.dataset.decision,decisionReason,idempotencyKey:key()}});toast(`Request ${button.dataset.decision}d`);await Promise.all([loadAdjustments(),loadAwaiting(),load()]);}catch(error){toast(error.message,9000);}});
      }catch(error){target.innerHTML=`<p role="alert">${safe(error.message)}</p>`;}
    }
    view.querySelector('#ar-new').onclick=()=>newSchedule();view.querySelector('#ar-filter').onsubmit=event=>{event.preventDefault();page=1;load();};if(options.startId)return newSchedule(options.startId,options.startReference);if(options.invoiceId)return openInvoice(options.invoiceId);await Promise.all([loadAwaiting(),loadAdjustments(),load()]);
  };
})();
