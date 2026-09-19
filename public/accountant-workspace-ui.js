(()=>{
  const tabs=Object.freeze([
    {id:'dashboard',label:'Dashboard'}, {id:'opportunities',label:'Opportunities'},
    {id:'myLeave',label:'My Leave'}, {id:'financeReceipts',label:'Commission Payments'},
    {id:'receivables',label:'Receivables'}
  ]);
  window.accountantTabs=tabs;
  window.accountantTabAllowed=tab=>tabs.some(t=>t.id===tab);
  const safe=v=>esc(v??''),money=(v,c='AED')=>v==null?'Not recorded':`${safe(c)} ${Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const pct=v=>v==null?'Not recorded':`${safe(v)}%`;
  window.renderAccountantDashboard=async()=>{
    const view=document.querySelector('#view');
    view.innerHTML=`<section class="dashboard-head"><div><div class="eyebrow">ACCOUNTANT WORKSPACE</div><h2>Dashboard</h2><p>Review Opportunity commission information and manage actual company-account receipts.</p></div></section>
      <section class="dashboard-panel"><h3>Your workspaces</h3><div class="dashboard-actions">
      ${tabs.slice(1).map(t=>`<button class="btn" data-accountant-tab="${t.id}">${t.label}</button>`).join('')}</div>
      <p>Opportunities are read-only. The Accountant prepares commission payments and records them only after MD approval.</p></section>
      <section class="dashboard-panel"><h3>Commission work requiring action</h3><p>Closed Won Opportunities appear here until their first commission invoice is created.</p><div id="accountant-invoice-work" class="loading-state">Loading invoice work…</div></section>`;
    view.querySelectorAll('[data-accountant-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.accountantTab));
    const invoiceTarget=view.querySelector?.('#accountant-invoice-work');if(!invoiceTarget)return;
    try{
      const {opportunities}=await api('/finance/receivables/awaiting');
      invoiceTarget.className='';invoiceTarget.innerHTML=opportunities.length?opportunities.map(o=>`<div class="deal-gate ${o.commissionStatus==='ready'?'complete':'blocked'}"><b>Create commission invoice · ${safe(o.opportunityReference)}</b><span>Closed ${safe(o.closedAt||'—')} · Commission pending ${o.expectedCommission==null?'— review commission terms':money(o.expectedCommission)}</span><button class="btn btn-primary btn-sm" data-open-receivables>Open Receivables</button></div>`).join(''):'<div class="empty compact">No Closed Won Opportunity is awaiting its first commission invoice.</div>';
      invoiceTarget.querySelectorAll('[data-open-receivables]').forEach(button=>button.onclick=()=>switchTab('receivables'));
    }catch(error){invoiceTarget.textContent=error.message;}
  };
  const showReceipts=async reference=>{
    currentTab='financeReceipts';
    document.querySelectorAll('nav.tabs button[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='financeReceipts'));
    await window.renderCommissionPayments({reference});
  };
  window.renderAccountantOpportunities=async({q='',page=1}={})=>{
    const view=document.querySelector('#view');
    view.innerHTML=`<section class="dashboard-head"><div><h2>Opportunities</h2><p>Read-only finance view. Search by Opportunity reference.</p></div></section>
      <form id="accountant-search" class="form-grid"><div><label for="accountant-reference">Reference</label><input id="accountant-reference" value="${safe(q)}"></div><button class="btn">Search</button></form>
      <div id="accountant-opportunities" class="loading-state">Loading Opportunities…</div>`;
    view.querySelector('#accountant-search').onsubmit=e=>{e.preventDefault();window.renderAccountantOpportunities({q:view.querySelector('#accountant-reference').value});};
    const target=view.querySelector('#accountant-opportunities');
    try{
      const data=await api('/finance/accountant-opportunities?'+new URLSearchParams({q,page}));
      target.className='';target.innerHTML=`<p>${data.count} matching Opportunities · Page ${data.page} of ${data.pageCount}</p>
        <div class="pipeline-table-wrap"><table><thead><tr><th>Opportunity</th><th>Stage</th><th>Agreed gross commission</th><th>Agent split</th><th></th></tr></thead><tbody>
        ${data.opportunities.map(o=>`<tr><td>${safe(o.opportunityReference)}<br><small>${safe(o.title)}</small></td><td>${safe(o.stage)}</td><td>${money(o.agreedGrossCommission,o.currency)}</td><td>Originating ${pct(o.originatingAgentSplitPercent)}<br>Servicing ${pct(o.servicingAgentSplitPercent)}</td><td><button class="btn" data-accountant-open="${safe(o.id)}">View opportunity</button></td></tr>`).join('')||'<tr><td colspan="5">No matching Opportunities.</td></tr>'}
        </tbody></table></div><div class="dashboard-actions"><button class="btn" data-page="${data.page-1}" ${data.page<=1?'disabled':''}>Previous</button><button class="btn" data-page="${data.page+1}" ${data.page>=data.pageCount?'disabled':''}>Next</button></div>`;
      target.querySelectorAll('[data-accountant-open]').forEach(b=>b.onclick=()=>window.openAccountantOpportunity(b.dataset.accountantOpen));
      target.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>window.renderAccountantOpportunities({q,page:Number(b.dataset.page)}));
    }catch(error){target.textContent=error.message;}
  };
  window.openAccountantOpportunity=async id=>{
    try{
      const {opportunity:o}=await api(`/finance/accountant-opportunities/${encodeURIComponent(id)}`);
      const dialog=overlay(`<div class="modal"><button class="close-x">×</button><div class="eyebrow">READ-ONLY FINANCE VIEW</div><h2>${safe(o.opportunityReference)}</h2><p>${safe(o.title)} · ${safe(o.stage)}</p>
        <div class="market-kpis">
        <div><small>Agreed transaction value</small><b>${money(o.agreedValue,o.currency)}</b></div><div><small>Agreed gross commission</small><b>${money(o.agreedGrossCommission,o.currency)}</b></div>
        <div><small>Existing agent split</small><b>Originating ${pct(o.originatingAgentSplitPercent)}</b><small>Servicing ${pct(o.servicingAgentSplitPercent)}</small></div>
        <div><small>Frozen expected company receipt</small><b>${o.expectedCompanyReceipt==null?'Not frozen':money(o.expectedCompanyReceipt,o.currency)}</b></div>
        <div><small>Confirmed actual receipt</small><b>${o.confirmedActualReceived==null?'Not confirmed':money(o.confirmedActualReceived,o.currency)}</b></div></div>
        <p>Agreed gross commission is derived from maintained commission terms and the agreed transaction value; it is not an invoice or agent payout.</p>
        <button class="btn btn-primary" data-accountant-receipts>Open Commission Payments</button></div>`);
      dialog.querySelector('[data-accountant-receipts]')?.addEventListener('click',()=>{dialog.remove();showReceipts(o.opportunityReference);});
    }catch(error){toast(error.message,7000);}
  };
})();
