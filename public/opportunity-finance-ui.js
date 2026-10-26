(()=>{
  const safe=v=>esc(v??''),money=v=>'AED '+Number(v||0).toLocaleString('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const input=(name,label,type='text',extra='')=>`<div><label for="of-${name}">${label}</label><input id="of-${name}" name="${name}" type="${type}" ${extra}></div>`;
  const status='<p class="span3" data-status role="status"></p>';
  function submit(form,url,body,reload){
    form.addEventListener('input',()=>delete form.dataset.key);
    form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button[type="submit"]'),message=form.querySelector('[data-status]');
      if(button.disabled)return;button.disabled=true;message.textContent='Saving…';
      try{await api(url,{method:'POST',refreshWorkspace:false,body:{...await body(),idempotencyKey:form.dataset.key||(form.dataset.key=crypto.randomUUID())}});await reload();}
      catch(error){message.textContent=error.message;}finally{button.disabled=false;}
    };
  }
  window.renderOpportunityFinanceReceipts=async({reference=''}={})=>{
    const view=document.querySelector('#view');
    if(!['director','accountant'].includes(ME.jobRole)){view.textContent='Finance receipt authority required';return;}
    view.innerHTML=`<section class="dashboard-head"><div><h2>Finance receipts</h2><p>Opportunity-linked payment evidence and receipt reconciliation. No Deal is required.</p></div></section>
      <form id="of-search" class="form-grid">${input('query','Opportunity reference','search')}<button type="submit" class="btn">Search receipts</button></form><div id="of-register"></div><section id="of-detail" class="dashboard-panel" hidden></section>`;
    view.querySelector('#of-query').value=reference;
    async function load(){
      const target=view.querySelector('#of-register');
      try{const data=await api('/finance/commission-opportunities?q='+encodeURIComponent(view.querySelector('#of-query').value));
        target.innerHTML=`<p>Latest ${data.limit} matching Opportunities.</p><div class="pipeline-table-wrap"><table><thead><tr><th>Opportunity</th><th>Stage</th><th>Confirmed receipt</th><th>Proof files</th><th>Action</th></tr></thead><tbody>${data.opportunities.map(o=>`<tr><td>${safe(o.opportunityReference)}</td><td>${safe(o.stage)}</td><td>${o.confirmedActualReceived==null?'Not confirmed':money(o.confirmedActualReceived)}</td><td>${o.proofCount}</td><td><button class="btn" data-of-open="${o.id}">Open receipts</button></td></tr>`).join('')||'<tr><td colspan="5">No matching Opportunities.</td></tr>'}</tbody></table></div>`;
        target.querySelectorAll('[data-of-open]').forEach(b=>b.onclick=()=>open(b.dataset.ofOpen));
      }catch(error){target.textContent=error.message;}
    }
    async function open(id){
      const target=view.querySelector('#of-detail'),base=`/finance/opportunities/${id}`;target.hidden=false;target.textContent='Loading receipts…';
      try{
        const [data,proofData]=await Promise.all([api(base+'/commission'),api(base+'/commission-proofs')]);
        const current=data.confirmations.find(c=>c.status==='confirmed'),o=data.opportunity,directReceipts=data.receipts.filter(r=>r.entryType==='receipt'&&!r.invoiceReference);
        const net=data.receipts.reduce((sum,r)=>sum+(r.entryType==='reversal'?-1:1)*Number(r.amount),0);
        target.innerHTML=`<h3>${safe(o.opportunityReference)}</h3><p>${safe(o.stage)}</p><div class="market-kpis">
          <div><small>Originating / servicing split</small><b>${safe(o.originatingAgentSplitPercent)}% / ${safe(o.servicingAgentSplitPercent)}%</b></div>
          <div><small>Expected commission (${data.expectationBasis==='issued_invoices'?'issued invoices':'agreed expectation'})</small><b>${money(data.expectedCompanyReceipt)}</b></div>
          <div><small>Net commission recorded (excludes VAT)</small><b>${money(net)}</b></div>
          <div><small>Payment confirmation</small><b>${current?(current.expectationBasis==='issued_invoices'?'Confirmed from invoice payment':'Confirmed'):directReceipts.length?'Direct receipt requires reconciliation':data.receipts.length?'Invoice confirmation sync required':'Not recorded'}</b></div></div>
          <h4>Commission proof</h4><p>Upload evidence against this Opportunity. Uploading a file does not record or confirm a payment.</p>
          <form id="of-proof" class="form-grid">${input('proofFile','Proof file (PDF, PNG or JPEG, maximum 5 MB)','file','accept=".pdf,.png,.jpg,.jpeg" required')}<button type="submit" class="btn btn-primary">Upload commission proof</button>${status}</form>
          ${proofData.proofs.map(p=>`<div class="official-document-gate"><div><b>${safe(p.fileName)}</b><br><small>${safe(p.proofReference)} · SHA-256 ${safe(p.fileHash)}</small></div><a class="btn" href="/api${base}/commission-proofs/${p.id}/download" download>Download proof</a></div>`).join('')||'<p>No commission proof uploaded.</p>'}
          <h4>Recorded receipts</h4><p>Invoice payments appear here automatically as net commission. Do not enter them again.</p><div class="pipeline-table-wrap"><table><thead><tr><th>Receipt / invoice</th><th>Net amount</th><th>Date</th><th>Finance reference</th><th>Evidence</th></tr></thead><tbody>${data.receipts.map(r=>`<tr><td>${safe(r.receiptReference)}<br><small>${safe(r.invoiceReference||'Direct receipt')}${r.entryType==='reversal'?' · Reversal':''}</small></td><td>${r.entryType==='reversal'?'−':''}${money(r.amount)}</td><td style="white-space:nowrap">${safe(r.receivedDate)}</td><td>${safe(r.financeReference)}</td><td>${safe(r.evidenceReference)}</td></tr>`).join('')||'<tr><td colspan="5">No actual receipt recorded.</td></tr>'}</tbody></table></div>
          <details><summary>Record a direct receipt not already recorded against an invoice</summary><p>For an invoice payment use Receivables, so its balance and VAT update together. This direct form records commission excluding VAT.</p>
          <form id="of-receipt" class="form-grid">${input('amount','Actual net commission received *','text','placeholder="e.g. 100K or 1.5M" required')}${input('receivedDate','Company-account receipt date *','date','required')}
          <div><label for="of-method">Payment method *</label><select id="of-method" name="receiptMethod"><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="card">Card</option><option value="other_confirmed">Other confirmed</option></select></div>
          ${input('financeReference','Finance reference *','text','required')}<div><label for="of-proofId">Uploaded commission proof</label><select id="of-proofId" name="proofId"><option value="">Use an evidence reference instead</option>${proofData.proofs.map(p=>`<option value="${p.id}">${safe(p.fileName)}</option>`).join('')}</select></div>
          ${input('evidenceReference','Evidence reference (required without proof)','text','required')}<button type="submit" class="btn">Record immutable receipt</button>${status}</form></details>
          ${directReceipts.length&&!current&&(data.expectation||data.issuedInvoiceCount)?`<form id="of-confirm" class="form-grid"><h4 class="span3">Reconcile a direct receipt</h4><p class="span3">Invoice payments are confirmed automatically when recorded in Receivables. Use this only for a payment entered directly without an invoice.</p>${input('reason','Reconciliation reason *','text','required minlength="10"')}${input('confirmationEvidence','Reconciliation evidence reference *','text','required')}<button type="submit" class="btn btn-primary">Confirm direct receipt reconciliation</button>${status}</form>`:directReceipts.length&&!current?'<p>Record the Opportunity invoice before reconciling its direct receipts.</p>':''}
          ${current?`<p>Confirmed ${money(current.confirmedActualReceived)} · Variance ${money(current.varianceAmount)} · ${safe(current.receiptDate)}</p>`:''}`;
        const reload=async()=>{await open(id);await load();};
        submit(target.querySelector('#of-proof'),base+'/commission-proofs',async()=>{
          const file=target.querySelector('#of-proofFile').files[0];if(!file||file.size>5*1024*1024||!['application/pdf','image/png','image/jpeg'].includes(file.type))throw new Error('Choose a PDF, PNG or JPEG no larger than 5 MB');
          const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Cannot read file'));reader.readAsDataURL(file);});
          return{fileName:file.name,mediaType:file.type,base64};
        },reload);
        const receipt=target.querySelector('#of-receipt');receipt.elements.receivedDate.value=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dubai'});
        receipt.elements.proofId.onchange=()=>{receipt.elements.evidenceReference.required=!receipt.elements.proofId.value;};
        submit(receipt,base+'/commission-receipts',()=>Object.fromEntries(new FormData(receipt)),reload);
        const confirm=target.querySelector('#of-confirm');if(confirm)submit(confirm,base+'/commission-receipt-confirmations',()=>({reason:confirm.elements.reason.value,evidenceReference:confirm.elements.confirmationEvidence.value}),reload);
        target.scrollIntoView({block:'start',behavior:'instant'});
      }catch(error){target.textContent=error.message;}
    }
    view.querySelector('#of-search').onsubmit=e=>{e.preventDefault();load();};await load();
  };
  window.renderFinanceReceipts=window.renderOpportunityFinanceReceipts;
})();
