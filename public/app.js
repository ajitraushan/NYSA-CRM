/* NYSA CRM — frontend SPA (vanilla JS, no build step) */
const $ = (sel, el = document) => el.querySelector(sel);
const app = $('#app');
let TOKEN = null;
let ME = null;
let currentTab = 'dashboard';
let lastListings = [];

const PROPERTY_TYPES = ['Apartment','Villa','Townhouse','Penthouse','Duplex','Plot','Bulk deal'];
const BEDROOMS = ['Studio','1','2','3','4','5+'];
const PAYMENT_PLANS = ['Cash','Mortgage','Developer plan','Post-handover'];
const STATUSES = ['Available','Reserved','Under offer','Closed'];
const TIERS = ['Exclusive to Nysa','Shared network','Off-market'];
const ROLES = { admin:'Admin', internal_broker:'Internal Broker', partner_broker:'Partner Broker', viewer:'Viewer' };
const LEAD_STAGES = ['New','Contacted','Qualified','Viewing','Negotiation','Won','Lost'];
const LEAD_SOURCES = ['Website','WhatsApp','Current CRM','Referral','Social media','Walk-in','Phone','Property portal','Other'];
const BUSINESS_TYPES = ['Sale','Rental','Off-plan','Commercial'];
const TEMPERATURES = ['Hot','Warm','Cold'];
const ACTIVITY_TYPES = ['Task','Note','Call','Email','WhatsApp','Meeting','Viewing'];
const JOB_ROLES = { admin:'Administrator', sales_agent:'Sales Agent', listing_agent:'Listing Agent', manager:'Manager', director:'Director', accountant:'Accountant' };
const COMPANY_TYPES = { developer:'Developer', agency:'Agency', corporate_client:'Corporate Client', landlord_company:'Landlord Company', vendor:'Vendor', other:'Other' };
const hasCrmAccess = () => ME && ['admin','internal_broker'].includes(ME.role);
const isCrmLeader = () => ME && (ME.role === 'admin' || ME.jobRole === 'manager');
const canWriteCrm = () => ME && !['director','accountant'].includes(ME.jobRole);

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    ...opts,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && ME) { logout(false); throw new Error('Session expired — please sign in again'); }
  if (!res.ok) { const error=new Error(data.error || 'Request failed'); error.status=res.status; error.data=data; throw error; }
  return data;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtPrice = (n, cur = 'AED') => esc(cur) + ' ' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtDate = (s) => s ? new Date(s.includes('T') ? s : s + 'Z').toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const canPost = () => ME && (ME.role === 'admin' || ME.role === 'internal_broker' || (ME.role === 'partner_broker' && ME.canPost === 1));
const canEditListing = (l) => ME && (ME.role === 'admin' || l.postedBy === ME.id);
const isViewer = () => ME && ME.role === 'viewer';

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ============ AUTH VIEWS ============ */
function renderSetup(setupEnabled) {
  app.innerHTML = `
  <div class="auth-wrap"><div class="auth-card">
    <h1>NYSA CRM</h1>
    <div class="sub">INITIAL CRM SETUP</div>
    <div id="auth-msg">${setupEnabled ? '<div class="info-msg">Create the first administrator account. This screen closes permanently after setup.</div>' : '<div class="error-msg">Add BOOTSTRAP_KEY in the Node.js application environment variables, then restart the application.</div>'}</div>
    <form id="setup-form">
      <div class="field"><label>Full name</label><input name="name" required autocomplete="name"></div>
      <div class="field"><label>Email</label><input name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label>Phone</label><input name="phone" autocomplete="tel"></div>
      <div class="field"><label>Administrator password</label><input name="password" type="password" required minlength="12" autocomplete="new-password"></div>
      <div class="field"><label>Private setup key</label><input name="bootstrapKey" type="password" required autocomplete="off"></div>
      <button class="btn btn-primary" style="width:100%;margin-top:6px" ${setupEnabled ? '' : 'disabled'}>Create administrator</button>
    </form>
  </div></div>`;
  $('#setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const showErr = (m) => $('#auth-msg').innerHTML = `<div class="error-msg">${esc(m)}</div>`;
    try {
      const { broker } = await api('/auth/setup', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      ME = broker;
      renderShell();
    } catch (err) { showErr(err.message); }
  });
}

function renderLogin(mode = 'login', prefill = {}) {
  app.innerHTML = `
  <div class="auth-wrap"><div class="auth-card">
    <h1>NYSA CRM</h1>
    <div class="sub">PRIVATE REAL ESTATE OPERATIONS</div>
    <div id="auth-msg"></div>
    ${mode === 'login' ? `
      <form id="login-form">
        <div class="field"><label>Email</label><input name="email" type="email" required autocomplete="username"></div>
        <div class="field"><label>Password</label><input name="password" type="password" required autocomplete="current-password"></div>
        <button class="btn btn-primary" style="width:100%;margin-top:6px">Sign in</button>
      </form>
      <div class="switch">Have an invitation code? <a id="to-register">Redeem it</a></div>
    ` : mode === 'redeem' ? `
      <form id="redeem-form">
        <div class="field"><label>Invitation code</label><input name="code" required placeholder="NYSA-XXXXXXXX" value="${esc(prefill.code || '')}"></div>
        <button class="btn btn-primary" style="width:100%;margin-top:6px">Validate code</button>
      </form>
      <div class="switch">Already registered? <a id="to-login">Sign in</a></div>
    ` : `
      <form id="register-form">
        <div class="info-msg">Code accepted — you are joining as <b>${esc(ROLES[prefill.role] || prefill.role)}</b>. Complete your registration.</div>
        <div class="field"><label>Full name</label><input name="name" required></div>
        <div class="field"><label>Email</label><input name="email" type="email" required value="${esc(prefill.issuedToEmail || '')}" ${prefill.issuedToEmail ? 'readonly' : ''}></div>
        <div class="field"><label>Phone</label><input name="phone" placeholder="+971 5x xxx xxxx"></div>
        <div class="field"><label>Brokerage</label><input name="brokerage"></div>
        <div class="field"><label>Password (min 12 characters)</label><input name="password" type="password" required minlength="12"></div>
        <button class="btn btn-primary" style="width:100%;margin-top:6px">Create account</button>
      </form>
      <div class="switch"><a id="to-login">Back to sign in</a></div>
    `}
  </div></div>`;

  const showErr = (m) => $('#auth-msg').innerHTML = `<div class="error-msg">${esc(m)}</div>`;
  $('#to-register')?.addEventListener('click', () => renderLogin('redeem'));
  $('#to-login')?.addEventListener('click', () => renderLogin('login'));

  $('#login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      const { broker } = await api('/auth/login', { method: 'POST', body: f });
      ME = broker;
      renderShell();
    } catch (err) { showErr(err.message); }
  });

  $('#redeem-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = new FormData(e.target).get('code').trim();
    try {
      const r = await api('/auth/redeem-invite', { method: 'POST', body: { code } });
      renderLogin('register', { code, ...r });
    } catch (err) { showErr(err.message); }
  });

  $('#register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      const { broker } = await api('/auth/register', { method: 'POST', body: { ...f, code: prefill.code } });
      ME = broker;
      renderShell();
    } catch (err) { showErr(err.message); }
  });
}

function logout(callApi = true) {
  if (callApi) api('/auth/logout', { method: 'POST' }).catch(() => {});
  TOKEN = null; ME = null;
  renderLogin();
}

/* ============ APP SHELL ============ */
function renderShell() {
  app.innerHTML = `
  <header>
    <div class="brand"><h1>NYSA CRM</h1><span>REAL ESTATE OPERATIONS</span></div>
    <div class="userbox">
      <span>${esc(ME.name)} · ${esc(ME.brokerage || '')}</span>
      <span class="role">${esc(JOB_ROLES[ME.jobRole] || ROLES[ME.role])}</span>
      <button class="btn btn-sm" id="logout-btn">Sign out</button>
    </div>
  </header>
  <nav class="tabs">
    <button data-tab="dashboard" class="active">Dashboard</button>
    ${hasCrmAccess() ? '<button data-tab="crm">Leads</button>' : ''}
    <button data-tab="listings">Inventory</button>
    ${ME.role === 'admin' ? '<button data-tab="admin">Administration</button>' : ''}
  </nav>
  <main id="view"></main>`;
  $('#logout-btn').addEventListener('click', () => logout());
  document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentTab = b.dataset.tab;
     currentTab === 'admin' ? renderAdmin() : currentTab === 'dashboard' ? renderDashboard() : currentTab === 'crm' ? renderCrm() : renderListings();
   }));
  renderDashboard();
}

async function renderDashboard() {
  $('#view').innerHTML = `
    <section class="dashboard-head">
      <div>
        <div class="eyebrow">NYSA REALTY / OPERATIONS</div>
        <h2>Good to see you, ${esc(ME.name.split(' ')[0])}</h2>
        <p>Keep today’s opportunities, inventory, and follow-ups in view.</p>
      </div>
      <div class="dashboard-actions">
        ${hasCrmAccess() ? '<button class="btn btn-primary btn-sm" id="dash-add-lead">+ Add lead</button>' : ''}
        ${canPost() ? '<button class="btn btn-primary btn-sm" id="dash-add">+ Add listing</button>' : ''}
        <button class="btn btn-sm" id="dash-inventory">Open inventory</button>
      </div>
    </section>
    <section id="dash-stats" class="stat-grid"><div class="loading-state">Loading workspace…</div></section>
    <section class="dashboard-grid">
      <div class="dashboard-panel"><div class="panel-head"><div><div class="eyebrow">INVENTORY PULSE</div><h3>Recent opportunities</h3></div><button class="text-btn" id="dash-see-all">View all</button></div><div id="dash-recent" class="recent-list"><div class="loading-state">Loading inventory…</div></div></div>
      <div class="dashboard-panel"><div class="panel-head"><div><div class="eyebrow">WORKSPACE</div><h3>Next actions</h3></div></div><div class="action-list"><button class="action-row" id="dash-action-inventory"><span class="action-icon">↗</span><span><b>Review inventory</b><small>Search and update available properties</small></span></button><button class="action-row" id="dash-action-comments"><span class="action-icon">◎</span><span><b>Check broker conversations</b><small>See the latest listing comments</small></span></button><div class="module-note"><b>CRM pipeline is next</b><span>Leads, viewings, and deals will appear here as those modules are added.</span></div></div></div>
    </section>`;
  if (hasCrmAccess()) {
    const followUpPanel = $('#dash-recent').closest('.dashboard-panel');
    $('.eyebrow', followUpPanel).textContent = 'MY FOLLOW-UPS';
    $('h3', followUpPanel).textContent = 'Assigned activities';
    const note = $('.module-note');
    if (note) {
      $('b', note).textContent = 'Release 1 lead pipeline is live';
      $('span', note).textContent = 'Use Leads to capture customers, assignments, qualification, and every follow-up.';
    }
  }
  $('#dash-inventory').addEventListener('click', () => switchTab('listings'));
  $('#dash-see-all').addEventListener('click', () => switchTab('listings'));
  $('#dash-action-inventory').addEventListener('click', () => switchTab('listings'));
  $('#dash-action-comments').addEventListener('click', () => switchTab('listings'));
  $('#dash-add-lead')?.addEventListener('click', () => openNewLeadForm());
  $('#dash-add')?.addEventListener('click', () => openListingForm());
  try {
    const { listings } = await api('/listings?sort=newest');
    const counts = listings.reduce((a, l) => { a.total++; a[l.status] = (a[l.status] || 0) + 1; return a; }, { total: 0 });
    $('#dash-stats').innerHTML = [['Total inventory', counts.total, 'All active records'], ['Available', counts.Available || 0, 'Open opportunities'], ['Under offer', counts['Under offer'] || 0, 'Needs attention'], ['Reserved', counts.Reserved || 0, 'In progress']].map(([label, value, note]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
    $('#dash-recent').innerHTML = listings.slice(0, 5).map(l => `<button class="recent-row" data-id="${esc(l.id)}"><span class="recent-status status-${esc(l.status.replace(' ', '.'))}"></span><span class="recent-main"><b>${esc(l.project)}</b><small>${esc(l.area)} · ${esc(l.propertyType)} · ${fmtPrice(l.price, l.currency)}</small></span><span class="recent-tag">${esc(l.status)}</span></button>`).join('') || '<div class="empty">No inventory yet.</div>';
    $('#dash-recent').querySelectorAll('.recent-row').forEach(row => row.addEventListener('click', () => openDetail(row.dataset.id)));
    if (hasCrmAccess()) {
      const { stats, dueActivities } = await api('/crm/overview');
      $('#dash-stats').innerHTML = [['Open leads', stats.openLeads, 'Active pipeline'], ['New leads', stats.newLeads, 'Awaiting first contact'], ['Hot leads', stats.hotLeads, 'Priority conversations'], ['Overdue', stats.overdueFollowUps, 'Follow-ups need action']].map(([label, value, note]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
      $('#dash-recent').innerHTML = dueActivities.map(a => `<button class="recent-row" data-lead-id="${esc(a.leadId)}"><span class="recent-status ${a.dueAt && new Date(a.dueAt) < new Date() ? 'status-Closed' : 'status-Available'}"></span><span class="recent-main"><b>${esc(a.subject)}</b><small>${esc(a.contactName)} · ${esc(a.leadTitle)}</small></span><span class="recent-tag">${fmtDate(a.dueAt)}</span></button>`).join('') || '<div class="empty">No assigned activities due.</div>';
      $('#dash-recent').querySelectorAll('[data-lead-id]').forEach(row => row.addEventListener('click', () => openLead(row.dataset.leadId)));
    }
  } catch (err) { $('#dash-stats').textContent = err.message; $('#dash-recent').textContent = err.message; }
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('nav.tabs button').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  tab === 'admin' ? renderAdmin() : tab === 'dashboard' ? renderDashboard() : tab === 'crm' ? renderCrm() : renderListings();
}

/* ============ CRM LEADS ============ */
function renderCrm() {
  $('#view').innerHTML = `
  <section class="dashboard-head">
    <div><div class="eyebrow">CRM / RELEASE 1</div><h2>Lead pipeline</h2><p>Capture, assign, qualify, and follow every customer conversation.</p></div>
    <div class="dashboard-actions">
      ${canWriteCrm() ? '<button class="btn btn-primary" id="crm-add">+ Add lead</button>' : ''}
      <button class="btn" id="crm-companies">Companies</button><button class="btn" id="crm-reports">Reports</button><button class="btn" id="crm-mortgage">Mortgage calculator</button>
      <button class="btn" id="crm-queue">Assignment queue</button>
      <button class="btn" id="crm-sla">SLA queue</button><button class="btn" id="crm-tasks">Task queue</button>
    </div>
  </section>
  <div class="filterbar">
    <div class="filter-grid crm-filter-grid">
      <div><label>Search</label><input id="crm-q" placeholder="Lead or customer name"></div>
      <div><label>Stage</label><select id="crm-stage"><option value="">All stages</option>${opts(LEAD_STAGES)}</select></div>
      <div><label>Qualification</label><select id="crm-temp"><option value="">All</option>${opts(TEMPERATURES)}</select></div>
      <div><label>Assignment</label><select id="crm-owner"><option value="">Everyone</option><option value="me">Assigned to me</option></select></div>
      <div><label>Assignment status</label><select id="crm-assignment"><option value="">All</option><option value="unassigned">Unassigned</option><option value="assigned">Assigned</option><option value="reassignment_due">Reassignment due</option><option value="closed">Closed</option></select></div>
    </div>
    <div class="filter-actions"><button class="btn btn-primary btn-sm" id="crm-apply">Apply</button><button class="btn btn-sm" id="crm-reset">Reset</button><span class="result-count" id="crm-count"></span></div>
  </div>
  <div id="crm-results"><div class="loading-state">Loading leads...</div></div>`;
  $('#crm-add')?.addEventListener('click', openNewLeadForm);
  $('#crm-companies').addEventListener('click', openCompanies);
  $('#crm-reports').addEventListener('click', openCrmReports);
  $('#crm-mortgage').addEventListener('click', openMortgageCalculator);
  $('#crm-queue').addEventListener('click', openAssignmentQueue);
  $('#crm-sla').addEventListener('click',openSlaQueue);$('#crm-tasks').addEventListener('click',openTaskQueue);
  $('#crm-apply').addEventListener('click', loadCRMLeads);
  $('#crm-reset').addEventListener('click', renderCrm);
  $('#crm-q').addEventListener('keydown', e => { if (e.key === 'Enter') loadCRMLeads(); });
  loadCRMLeads();
}

async function loadCRMLeads() {
  const p = new URLSearchParams();
  const set = (k,v) => { if (v) p.set(k,v); };
  set('q',$('#crm-q').value.trim()); set('stage',$('#crm-stage').value);
  set('temperature',$('#crm-temp').value); set('assignedTo',$('#crm-owner').value);
  set('assignmentStatus',$('#crm-assignment').value);
  try {
    const { count, leads } = await api('/crm/leads?' + p.toString());
    $('#crm-count').textContent = `${count} lead${count === 1 ? '' : 's'}`;
    $('#crm-results').innerHTML = leads.length ? `<div class="pipeline-table-wrap"><table class="pipeline-table"><tr><th>Customer / opportunity</th><th>Stage</th><th>Priority</th><th>Business</th><th>Owner</th><th>Next follow-up</th></tr>${leads.map(l => `<tr data-lead-id="${esc(l.id)}">
      <td><b>${esc(l.contactName)}</b><small>${esc(l.title)}${l.contactPhone ? ' · ' + esc(l.contactPhone) : ''}</small></td>
      <td><span class="lead-stage stage-${esc(l.stage.toLowerCase())}">${esc(l.stage)}</span></td>
      <td><span class="lead-temp temp-${esc(l.temperature.toLowerCase())}">${esc(l.temperature)}</span></td>
      <td>${esc(l.businessType)}<small>${esc(l.source)}</small></td>
      <td>${esc(l.assignedToName || l.assignedTeamName || 'Unassigned')}<small>${esc((l.assignmentStatus||'assigned').replace('_',' '))}</small></td>
      <td class="${l.nextFollowUpAt && new Date(l.nextFollowUpAt) < new Date() && !['Won','Lost'].includes(l.stage) ? 'overdue' : ''}">${fmtDate(l.nextFollowUpAt)}</td>
    </tr>`).join('')}</table></div>` : '<div class="empty">No leads match these filters.</div>';
    document.querySelectorAll('[data-lead-id]').forEach(row => row.addEventListener('click', () => openLead(row.dataset.leadId)));
  } catch (err) { $('#crm-results').textContent = err.message; }
}

async function openNewLeadForm() {
  let contacts, staff, teams, companies, listings;
  try {
    [{ contacts }, { staff }, { teams }, { companies }, { listings }] = await Promise.all([api('/crm/contacts'), api('/crm/staff'), api('/crm/teams'), api('/crm/companies'), api('/listings?sort=newest')]);
  } catch (err) { return toast(err.message); }
  const o = overlay(`<div class="modal"><button class="close-x">×</button><h2>Capture new lead</h2>
    <form id="lead-form"><div class="form-grid">
      <div class="span3"><label>Existing contact (optional)</label><select name="contactId"><option value="">Create a new contact below</option>${contacts.map(c => `<option value="${esc(c.id)}">${esc(c.fullName)} · ${esc(c.email || c.phone)}</option>`).join('')}</select></div>
      <div class="span2 new-contact"><label>Customer full name *</label><input name="fullName"></div>
      <div class="new-contact"><label>Customer type</label><select name="contactType"><option>buyer</option><option>seller</option><option>landlord</option><option>tenant</option><option>developer</option><option>investor</option><option>other</option></select></div>
      <div class="new-contact"><label>Email</label><input name="email" type="email"></div>
      <div class="new-contact"><label>Phone</label><input name="phone" placeholder="+971..."></div>
      <div class="new-contact"><label>Preferred channel</label><select name="preferredChannel"><option>WhatsApp</option><option>Phone</option><option>Email</option><option>SMS</option></select></div>
      <div class="new-contact"><label>Company</label><select name="companyId"><option value="">Individual</option>${companies.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>
      <div class="new-contact span2"><label>Public professional profile (optional)</label><input name="publicProfileUrl" type="url" placeholder="https://..."></div>
      <div class="span2"><label>Opportunity title *</label><input name="title" required placeholder="e.g. 2BR home in Dubai Marina"></div>
      <div><label>Qualification</label><select name="temperature">${opts(TEMPERATURES,'Warm')}</select></div>
      <div><label>Source *</label><select name="source">${opts(LEAD_SOURCES)}</select></div>
      <div><label>Business type *</label><select name="businessType">${opts(BUSINESS_TYPES)}</select></div>
      <div><label>Stage</label><select name="stage">${opts(LEAD_STAGES,'New')}</select></div>
      <div><label>Budget from (AED)</label><input name="budgetMin" type="number" min="0"></div>
      <div><label>Budget to (AED)</label><input name="budgetMax" type="number" min="0"></div>
      <div><label>Preferred areas</label><input name="preferredAreas"></div>
      <div><label>Assign team</label><select name="assignedTeamId"><option value="">Unassigned</option>${teams.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></div>
      <div><label>Assign broker</label><select name="assignedTo"><option value="">Unassigned</option>${staff.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div>
      <div><label>Next follow-up</label><input name="nextFollowUpAt" type="datetime-local"></div>
      <div class="span2"><label>Related listing (optional)</label><select name="listingId"><option value="">No listing selected</option>${listings.map(l=>`<option value="${esc(l.id)}">${esc(l.project)} · ${esc(l.area)} · ${fmtPrice(l.price,l.currency)}</option>`).join('')}</select></div>
      <div class="span3"><label>Property requirements / first conversation</label><textarea name="propertyRequirements" rows="3"></textarea></div>
    </div><div class="modal-actions"><button type="button" class="btn" id="lead-cancel">Cancel</button><button class="btn btn-primary">Create lead</button></div></form></div>`);
  const contactSelect = $('[name="contactId"]',o);
  const toggleContact = () => o.querySelectorAll('.new-contact').forEach(x => x.classList.toggle('hidden', Boolean(contactSelect.value)));
  contactSelect.addEventListener('change',toggleContact); toggleContact();
  $('#lead-cancel',o).addEventListener('click',()=>o.remove());
  $('#lead-form',o).addEventListener('submit',async e=>{
    e.preventDefault(); const f=Object.fromEntries(new FormData(e.target));
    try {
      let contactId=f.contactId;
      if(!contactId){
        if(!f.fullName.trim()||(!f.email.trim()&&!f.phone.trim())) throw new Error('New contacts require a name and email or phone');
        const contactBody={fullName:f.fullName,email:f.email,phone:f.phone,contactType:f.contactType,preferredChannel:f.preferredChannel,
          whatsappEnabled:f.preferredChannel==='WhatsApp',companyId:f.companyId||null,publicProfileUrl:f.publicProfileUrl||null};
        let contact;try{contact=await api('/crm/contacts',{method:'POST',body:contactBody});}
        catch(error){if(error.status!==409||!error.data?.duplicates?.length)throw error;
          const names=error.data.duplicates.map(x=>x.fullName).join(', ');if(!confirm(`Possible duplicate found: ${names}. Create a separate contact after review?`))return;
          contact=await api('/crm/contacts',{method:'POST',body:{...contactBody,duplicateReviewed:true}});}
        contactId=contact.id;
      }
      await api('/crm/leads',{method:'POST',body:{contactId,title:f.title,temperature:f.temperature,source:f.source,businessType:f.businessType,stage:f.stage,
        budgetMin:f.budgetMin||null,budgetMax:f.budgetMax||null,preferredAreas:f.preferredAreas,assignedTeamId:f.assignedTeamId||null,
        assignedTo:f.assignedTo||null,nextFollowUpAt:f.nextFollowUpAt||null,propertyRequirements:f.propertyRequirements,listingId:f.listingId||null}});
      toast('Lead created'); o.remove(); loadCRMLeads();
    } catch(err){ toast(err.message); }
  });
}

async function openLead(id) {
  let lead, activities, qualificationGuidance, staff, teams, listings, consent;
  try {
    [{ lead, activities, qualificationGuidance }, { staff }, { teams }, { listings }] = await Promise.all([
      api('/crm/leads/' + id),api('/crm/staff'),api('/crm/teams'),api('/listings?sort=newest')]);
  } catch(err) { return toast(err.message); }
  try{consent=await api(`/crm/contacts/${lead.contactId}/consent`);}catch{consent={effectiveConsent:false,restricted:false};}
  const phoneHref=lead.contactPhone?lead.contactPhone.replace(/\D/g,''):'';
  const contactLinks=consent.restricted?'<span class="pill revoked">Do not contact</span>':`${lead.contactPhone?`<a class="btn btn-sm" href="https://wa.me/${esc(phoneHref)}" target="_blank" rel="noopener">Open WhatsApp</a><a class="btn btn-sm" href="tel:${esc(lead.contactPhone)}">Call</a>`:''}${lead.contactEmail?`<a class="btn btn-sm" href="mailto:${esc(lead.contactEmail)}?subject=${encodeURIComponent(lead.title)}">Email</a>`:''}`;
  const o=overlay(`<div class="modal lead-modal"><button class="close-x">×</button>
    <div class="detail-head"><div><div class="eyebrow">${esc(lead.businessType)} LEAD · ${esc(lead.source)}</div><h2>${esc(lead.contactName)}</h2><p>${esc(lead.title)}</p></div><span class="lead-temp temp-${esc(lead.temperature.toLowerCase())}">${esc(lead.temperature)}</span></div>
    <div class="contact-actions">${contactLinks}<button class="btn btn-sm" id="lead-verify">Verification</button><button class="btn btn-sm" id="lead-governance">Channels, consent & duplicates</button>${!consent.effectiveConsent&&!consent.restricted?'<span class="tool-note" style="margin:6px 0">No effective marketing consent</span>':''}</div>
    <div class="kv-grid"><div><b>Phone</b>${esc(lead.contactPhone||'—')}<br><small>${esc(lead.phoneStatus||'unverified')}</small></div><div><b>Email</b>${esc(lead.contactEmail||'—')}<br><small>${esc(lead.emailStatus||'unverified')}</small></div><div><b>Preferred channel</b>${esc(lead.preferredChannel||'—')}</div>
    <div><b>Owner</b>${esc(lead.assignedToName||'Unassigned')}</div><div><b>Team</b>${esc(lead.assignedTeamName||'—')}</div><div><b>Next follow-up</b>${fmtDate(lead.nextFollowUpAt)}</div>
    <div><b>Budget</b>${lead.budgetMin||lead.budgetMax ? `${lead.budgetMin?fmtPrice(lead.budgetMin):'Any'} – ${lead.budgetMax?fmtPrice(lead.budgetMax):'Any'}`:'—'}</div><div><b>Related listing</b>${esc(lead.listingProject||'—')}</div><div><b>Assignment</b>${esc((lead.assignmentStatus||'assigned').replace('_',' '))}${lead.assignmentDueAt?'<br><small>'+fmtDate(lead.assignmentDueAt)+'</small>':''}</div><div class="span3"><b>Requirements</b>${esc(lead.propertyRequirements||'—')}</div></div>
    <div class="qualification-note"><b>${esc(lead.temperature)} lead response</b><span>Target: within ${qualificationGuidance.responseMinutes < 60 ? qualificationGuidance.responseMinutes + ' minutes' : qualificationGuidance.responseMinutes / 60 + ' hours'}. ${esc(qualificationGuidance.strategy)}</span><small>${esc(qualificationGuidance.cadence)}</small></div>
    <div class="lead-controls"><div><label>Stage</label><select id="lead-stage" ${canWriteCrm()?'':'disabled'}>${opts(LEAD_STAGES,lead.stage)}</select></div><div><label>Qualification</label><select id="lead-temp" ${canWriteCrm()?'':'disabled'}>${opts(TEMPERATURES,lead.temperature)}</select></div>
      ${isCrmLeader()?`<div><label>Team</label><select id="lead-team"><option value="">Unassigned</option>${teams.map(t=>`<option value="${t.id}" ${lead.assignedTeamId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div><div><label>Broker</label><select id="lead-owner"><option value="">Unassigned</option>${staff.map(s=>`<option value="${s.id}" ${lead.assignedTo===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><button class="btn btn-sm" id="lead-assign">Save assignment</button>`:''}
      ${canWriteCrm()&&['unassigned','reassignment_due'].includes(lead.assignmentStatus)?'<button class="btn btn-primary btn-sm" id="lead-claim">Claim lead</button>':''}
      ${canWriteCrm()&&lead.assignedTo===ME.id&&!lead.acceptedAt?'<button class="btn btn-primary btn-sm" id="lead-accept">Accept assignment</button><button class="btn btn-danger btn-sm" id="lead-reject">Reject assignment</button>':''}
      <button class="btn btn-sm" id="lead-assignments">Assignment history</button><button class="btn btn-sm" id="lead-requirements">Structured requirements</button><button class="btn btn-sm" id="lead-tasks">Tasks</button>
      <button class="btn btn-sm" id="lead-assessment">Qualification assessment</button><button class="btn btn-sm" id="lead-finance">Saved financial scenarios</button>
      ${canWriteCrm()?'<button class="btn btn-sm" id="lead-brief">Create value brief</button><button class="btn btn-sm" id="lead-briefs">View value briefs</button>':''}
    </div>
    <div class="comments"><h3>Activity timeline</h3><div id="activity-list">${activityHTML(activities)}</div>
    ${canWriteCrm()?`<form id="activity-form" class="activity-form"><div><label>Type</label><select name="activityType">${opts(ACTIVITY_TYPES,'Call')}</select></div><div class="activity-subject"><label>Subject *</label><input name="subject" required placeholder="What happened or needs to happen?"></div><div><label>Due / reminder</label><input name="dueAt" type="datetime-local"></div><div class="activity-details"><label>Details / outcome</label><textarea name="details" rows="2"></textarea></div><button class="btn btn-primary btn-sm">Add activity</button></form>`:''}</div></div>`);
  $('#lead-stage',o).addEventListener('change',async e=>{
    const body={stage:e.target.value}; if(e.target.value==='Lost'){const reason=prompt('Why was this lead lost?');if(!reason){e.target.value=lead.stage;return;}body.lostReason=reason;}
    try{await api('/crm/leads/'+id,{method:'PATCH',body});toast('Stage updated');o.remove();openLead(id);loadCRMLeads();}catch(err){toast(err.message);e.target.value=lead.stage;}
  });
  $('#lead-temp',o).addEventListener('change',async e=>{try{await api('/crm/leads/'+id,{method:'PATCH',body:{temperature:e.target.value}});toast('Qualification updated');loadCRMLeads();}catch(err){toast(err.message);}});
  $('#lead-assign',o)?.addEventListener('click',async()=>{try{await api(`/crm/leads/${id}/assign`,{method:'POST',body:{assignedTeamId:$('#lead-team',o).value||null,assignedTo:$('#lead-owner',o).value||null}});toast('Assignment updated');o.remove();openLead(id);loadCRMLeads();}catch(err){toast(err.message);}});
  $('#lead-claim',o)?.addEventListener('click',async()=>{const nextActionDue=prompt('Next action due (ISO date/time, e.g. 2026-07-15T10:00:00+04:00)');if(!nextActionDue)return;try{await api(`/crm/leads/${id}/claim`,{method:'POST',body:{nextActionDue}});toast('Lead claimed');o.remove();openLead(id);loadCRMLeads();}catch(err){toast(err.message);}});
  $('#lead-accept',o)?.addEventListener('click',async()=>{const nextActionDue=prompt('Next action due (ISO date/time)');if(!nextActionDue)return;try{await api(`/crm/leads/${id}/assignment/accept`,{method:'POST',body:{nextActionDue}});toast('Assignment accepted');o.remove();openLead(id);}catch(err){toast(err.message);}});
  $('#lead-reject',o)?.addEventListener('click',async()=>{const reason=prompt('Rejection reason');if(!reason)return;try{await api(`/crm/leads/${id}/assignment/reject`,{method:'POST',body:{reason}});toast('Assignment rejected');o.remove();openLead(id);}catch(err){toast(err.message);}});
  $('#lead-assignments',o).addEventListener('click',()=>openLeadAssignments(id));
  $('#lead-requirements',o).addEventListener('click',()=>openLeadRequirements(lead));
  $('#lead-tasks',o).addEventListener('click',()=>openLeadTasks(lead));
  $('#lead-assessment',o).addEventListener('click',()=>openQualificationAssessments(lead));$('#lead-finance',o).addEventListener('click',()=>openFinancialScenarios(lead,listings));
  $('#lead-verify',o).addEventListener('click',()=>openContactVerification(lead,o));
  $('#lead-governance',o).addEventListener('click',()=>openContactGovernance(lead,o));
  $('#lead-brief',o)?.addEventListener('click',()=>openValueBriefForm(lead,listings,o));
  $('#lead-briefs',o)?.addEventListener('click',()=>openValueBriefs(lead,o));
  $('#activity-form',o)?.addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await api(`/crm/leads/${id}/activities`,{method:'POST',body:{activityType:f.activityType,subject:f.subject,dueAt:f.dueAt||null,reminderAt:f.dueAt||null,details:f.details}});toast('Activity added');o.remove();openLead(id);}catch(err){toast(err.message);}});
  o.querySelectorAll('[data-complete-activity]').forEach(b=>b.addEventListener('click',async()=>{try{await api('/crm/activities/'+b.dataset.completeActivity,{method:'PATCH',body:{completed:true}});o.remove();openLead(id);}catch(err){toast(err.message);}}));
}

function activityHTML(activities) {
  return activities.length ? activities.map(a=>`<div class="activity-row ${a.completedAt?'completed':''}"><div class="activity-marker">${esc(a.activityType.slice(0,1))}</div><div><b>${esc(a.subject)}</b><small>${esc(a.activityType)} · ${esc(a.ownerName)} · ${fmtDate(a.dueAt||a.createdAt)}</small>${a.details?`<p>${esc(a.details)}</p>`:''}</div><div class="activity-actions">${a.dueAt?`<a class="btn btn-sm" href="/api/crm/activities/${esc(a.id)}/calendar">Calendar</a>`:''}${!a.completedAt&&a.activityType==='Task'?`<button class="btn btn-sm" data-complete-activity="${esc(a.id)}">Complete</button>`:''}</div></div>`).join('') : '<div class="empty">No activity recorded yet.</div>';
}

async function openCompanies() {
  let companies,staff;try{[{companies},{staff}]=await Promise.all([api('/crm/companies'),api('/crm/staff')]);}catch(err){return toast(err.message);}
  const o=overlay(`<div class="modal lead-modal"><button class="close-x">×</button><h2>Companies and organisations</h2>
    ${canWriteCrm()?`<form id="company-form" class="form-grid compact-form"><div class="span2"><label>Company name *</label><input name="name" required></div><div><label>Category</label><select name="companyType">${Object.entries(COMPANY_TYPES).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></div><div><label>Initial business role</label><select name="companyRole"><option>developer</option><option>agency</option><option>employer</option><option>supplier</option><option>corporate_client</option><option>landlord</option><option>vendor</option><option>other</option></select></div><div><label>Email</label><input name="email" type="email"></div><div><label>Phone</label><input name="phone"></div><div><label>Website</label><input name="website" type="url"></div><div><label>Owner</label><select name="ownerId">${staff.map(s=>`<option value="${s.id}" ${s.id===ME.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="span2"><label>Address</label><input name="address"></div><button class="btn btn-primary btn-sm">Add company</button></form>`:''}
    <div class="pipeline-table-wrap" style="margin-top:18px"><table><tr><th>Company</th><th>Category</th><th>Owner</th><th>Contacts</th><th>Contact</th><th></th></tr>${companies.map(c=>`<tr><td><b>${esc(c.name)}</b><small>${esc(c.website||'')}</small></td><td>${esc(COMPANY_TYPES[c.companyType]||c.companyType)}</td><td>${esc(c.ownerName||'—')}</td><td>${c.contactCount}</td><td>${esc(c.email||c.phone||'—')}</td><td><button class="btn btn-sm" data-company-roles="${c.id}">Roles</button></td></tr>`).join('')}</table></div></div>`);
  $('#company-form',o)?.addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{const company=await api('/crm/companies',{method:'POST',body:f});await api(`/crm/companies/${company.id}/roles`,{method:'POST',body:{roleCode:f.companyRole,isPrimary:true}});toast('Company created');o.remove();openCompanies();}catch(err){toast(err.message);}});
  o.querySelectorAll('[data-company-roles]').forEach(b=>b.addEventListener('click',()=>openCompanyRoles(b.dataset.companyRoles)));
}

async function openSlaQueue(){let leads;try{({leads}=await api('/crm/sla-queue'));}catch(err){return toast(err.message);}const now=Date.now();overlay(`<div class="modal lead-modal"><button class="close-x">×</button><h2>Acceptance and first-contact SLA</h2><table><tr><th>Customer</th><th>SLA</th><th>Deadline</th><th>State</th></tr>${leads.map(l=>{const breached=new Date(l.activeDeadline).getTime()<=now;return `<tr data-lead-id="${l.id}"><td>${esc(l.contactName)}<small>${esc(l.title)}</small></td><td>${esc(l.slaKind)}</td><td>${fmtDate(l.activeDeadline)}</td><td><span class="pill ${breached?'revoked':'active'}">${breached?'Breached':'Approaching'}</span></td></tr>`;}).join('')||'<tr><td colspan="4">No active SLA records</td></tr>'}</table></div>`);}
async function openTaskQueue(){let tasks;try{({tasks}=await api('/crm/tasks'));}catch(err){return toast(err.message);}overlay(`<div class="modal lead-modal"><button class="close-x">×</button><h2>Task queue</h2><table><tr><th>Task</th><th>Lead</th><th>Assignee</th><th>Status</th><th>Due</th></tr>${tasks.map(t=>`<tr><td>${esc(t.subject)}</td><td>${esc(t.contactName)}<small>${esc(t.leadTitle)}</small></td><td>${esc(t.assigneeName)}</td><td>${esc(t.status)}</td><td>${fmtDate(t.dueAt)}</td></tr>`).join('')||'<tr><td colspan="5">No tasks</td></tr>'}</table></div>`);}

async function openLeadAssignments(id){let assignments;try{({assignments}=await api(`/crm/leads/${id}/assignments`));}catch(err){return toast(err.message);}overlay(`<div class="modal lead-modal"><button class="close-x">×</button><h2>Assignment history</h2><table><tr><th>Sequence</th><th>Team</th><th>Agent</th><th>Status</th><th>Offered</th><th>Responded</th><th>Reason</th></tr>${assignments.map(a=>`<tr><td>${a.sequenceNo}</td><td>${esc(a.teamName||'—')}</td><td>${esc(a.agentName||'Queue')}</td><td>${esc(a.status)}</td><td>${fmtDate(a.offeredAt)}</td><td>${fmtDate(a.respondedAt)}</td><td>${esc(a.responseReason||'—')}</td></tr>`).join('')||'<tr><td colspan="7">No history</td></tr>'}</table></div>`);}

async function openLeadRequirements(lead){let requirements;try{({requirements}=await api(`/crm/leads/${lead.id}/requirements`));}catch(err){return toast(err.message);}const o=overlay(`<div class="modal lead-modal"><button class="close-x">×</button><h2>Structured requirements</h2><div>${requirements.map(x=>`<div class="activity-row"><div><b>Version ${x.versionNo}: ${esc(x.businessLine)}</b><small>${esc(x.purpose)} · ${esc(x.fundingMethod)} · ${esc(x.timelineCode)} · ${fmtDate(x.createdAt)}</small><p>${esc((x.areas||[]).join(', ')||'No areas')} · ${esc((x.propertyTypes||[]).join(', ')||'Any property')}</p></div></div>`).join('')||'<div class="empty">No structured requirement yet.</div>'}</div>${canWriteCrm()?`<form id="requirement-form" class="form-grid"><div><label>Business line *</label><input name="businessLine" value="${esc(lead.businessType)}" required></div><div><label>Purpose *</label><select name="purpose"><option value="own_use">Own use</option><option value="investment">Investment</option><option value="business">Business</option><option value="other">Other</option></select></div><div><label>Funding *</label><select name="fundingMethod"><option>unknown</option><option>cash</option><option>mortgage</option><option>mixed</option></select></div><div><label>Timeline *</label><input name="timelineCode" required placeholder="0_3_months"></div><div><label>Areas (comma separated)</label><input name="areas"></div><div><label>Property types (comma separated)</label><input name="propertyTypes"></div><div><label>Budget min</label><input name="budgetMin" type="number" min="0"></div><div><label>Budget max</label><input name="budgetMax" type="number" min="0"></div><div class="span3"><label>Notes</label><textarea name="notes"></textarea></div><button class="btn btn-primary btn-sm">Save new version</button></form>`:''}</div>`);$('#requirement-form',o)?.addEventListener('submit',async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.areas=b.areas.split(',').map(x=>x.trim()).filter(Boolean);b.propertyTypes=b.propertyTypes.split(',').map(x=>x.trim()).filter(Boolean);try{await api(`/crm/leads/${lead.id}/requirements`,{method:'POST',body:b});toast('Requirement version saved');o.remove();openLeadRequirements(lead);}catch(err){toast(err.message);}});}

async function openLeadTasks(lead){let tasks;try{({tasks}=await api('/crm/tasks'));tasks=tasks.filter(x=>x.leadId===lead.id);}catch(err){return toast(err.message);}const o=overlay(`<div class="modal lead-modal"><button class="close-x">×</button><h2>Lead tasks</h2><table><tr><th>Task</th><th>Priority</th><th>Status</th><th>Due</th><th></th></tr>${tasks.map(t=>`<tr><td>${esc(t.subject)}</td><td>${esc(t.priority)}</td><td>${esc(t.status)}</td><td>${fmtDate(t.dueAt)}</td><td>${!['completed','cancelled'].includes(t.status)?`<button class="btn btn-sm" data-complete-task="${t.id}">Complete</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5">No tasks</td></tr>'}</table>${canWriteCrm()?`<form id="task-form" class="admin-toolbar"><div><label>Subject *</label><input name="subject" required></div><div><label>Due *</label><input name="dueAt" type="datetime-local" required></div><div><label>Priority</label><select name="priority"><option>normal</option><option>high</option><option>urgent</option><option>low</option></select></div><button class="btn btn-primary btn-sm">Add task</button></form>`:''}</div>`);$('#task-form',o)?.addEventListener('submit',async e=>{e.preventDefault();try{await api(`/crm/leads/${lead.id}/tasks`,{method:'POST',body:Object.fromEntries(new FormData(e.target))});o.remove();openLeadTasks(lead);}catch(err){toast(err.message);}});o.querySelectorAll('[data-complete-task]').forEach(b=>b.addEventListener('click',async()=>{const outcome=prompt('Completion outcome');if(!outcome)return;try{await api(`/crm/tasks/${b.dataset.completeTask}`,{method:'PATCH',body:{status:'completed',outcome}});o.remove();openLeadTasks(lead);}catch(err){toast(err.message);}}));}

async function openQualificationAssessments(lead){let assessments;try{({assessments}=await api(`/crm/leads/${lead.id}/qualification-assessments`));}catch(err){return toast(err.message);}const o=overlay(`<div class="modal lead-modal"><button class="close-x">×</button><h2>Qualification assessment history</h2>${assessments.map(a=>`<div class="activity-row"><div><b>${esc(a.finalTemperature)} · score ${a.calculatedScore}</b><small>${esc(a.modelName)} v${a.modelVersion} · ${fmtDate(a.assessedAt)}</small><p>${(a.factorContributions||[]).map(x=>`${esc(x.label||x.code)}: ${x.value??'missing'} × ${x.weight} = ${Number(x.contribution||0).toFixed(1)}`).join('<br>')}${a.overrideReason?'<br>Override: '+esc(a.overrideReason):''}</p></div></div>`).join('')||'<div class="empty">No assessment yet.</div>'}${canWriteCrm()?`<form id="assessment-form"><p class="tool-note">Enter factor inputs as a JSON object using the stable codes in the active approved model.</p><label>Factor inputs *</label><textarea name="inputs" rows="5" required>{}</textarea>${isCrmLeader()?'<div class="admin-toolbar"><div><label>Override result</label><select name="overrideTemperature"><option value="">No override</option><option>Hot</option><option>Warm</option><option>Cold</option></select></div><div><label>Override reason</label><input name="overrideReason"></div></div>':''}<button class="btn btn-primary btn-sm">Calculate and save assessment</button></form>`:''}</div>`);$('#assessment-form',o)?.addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{f.inputs=JSON.parse(f.inputs);await api(`/crm/leads/${lead.id}/qualification-assessments`,{method:'POST',body:f});toast('Assessment saved');o.remove();openQualificationAssessments(lead);}catch(err){toast(err.message);}});}

async function openFinancialScenarios(lead,listings){let scenarios;try{({scenarios}=await api(`/crm/leads/${lead.id}/financial-scenarios`));}catch(err){return toast(err.message);}const o=overlay(`<div class="modal lead-modal"><button class="close-x">×</button><h2>Immutable financial scenarios</h2><table><tr><th>Scenario</th><th>Type</th><th>Property</th><th>Headline result</th><th>Assumptions</th></tr>${scenarios.map(s=>`<tr><td>${esc(s.scenarioName)}<small>${fmtDate(s.createdAt)}</small></td><td>${esc(s.scenarioType)}</td><td>${esc(s.listingProject||'Unlinked')}</td><td>${s.scenarioType==='mortgage'?fmtPrice(s.monthlyPayment)+'/month':`${s.grossYield}% gross · ${s.netYield}% net`}</td><td>${esc(s.assumptionName)} v${s.assumptionVersion}<small>${esc(s.disclaimer)}</small></td></tr>`).join('')||'<tr><td colspan="5">No saved scenarios</td></tr>'}</table>${canWriteCrm()?`<form id="scenario-form" class="form-grid"><div><label>Name *</label><input name="scenarioName" required></div><div><label>Type</label><select name="scenarioType"><option>mortgage</option><option>roi</option></select></div><div><label>Property</label><select name="listingId"><option value="">Unlinked</option>${listings.map(l=>`<option value="${l.id}">${esc(l.project)} · ${fmtPrice(l.price)}</option>`).join('')}</select></div><div class="span3"><label>Inputs JSON *</label><textarea name="inputs" rows="5" required>{"propertyPrice":1000000,"downPaymentPercent":20,"annualRatePercent":4.5,"years":25,"additionalCosts":0}</textarea></div><button class="btn btn-primary btn-sm">Calculate and save snapshot</button></form>`:''}</div>`);$('#scenario-form',o)?.addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{f.inputs=JSON.parse(f.inputs);f.listingId=f.listingId||null;await api(`/crm/leads/${lead.id}/financial-scenarios`,{method:'POST',body:f});toast('Financial snapshot saved');o.remove();openFinancialScenarios(lead,listings);}catch(err){toast(err.message);}});}

async function openCompanyRoles(companyId){let roles;try{({roles}=await api(`/crm/companies/${companyId}/roles`));}catch(err){return toast(err.message);}const o=overlay(`<div class="modal"><button class="close-x">×</button><h2>Company business roles</h2><div>${roles.map(r=>`<span class="pill active">${esc(r.roleCode)}${r.isPrimary?' · primary':''}</span>`).join(' ')||'No roles yet'}</div>${canWriteCrm()?`<form id="company-role-form" class="admin-toolbar" style="margin-top:18px"><select name="roleCode"><option>developer</option><option>agency</option><option>employer</option><option>supplier</option><option>corporate_client</option><option>landlord</option><option>vendor</option><option>other</option></select><label><input type="checkbox" name="isPrimary"> Primary</label><button class="btn btn-primary btn-sm">Add role</button></form>`:''}</div>`);$('#company-role-form',o)?.addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.isPrimary=Boolean(f.isPrimary);try{await api(`/crm/companies/${companyId}/roles`,{method:'POST',body:f});o.remove();openCompanyRoles(companyId);}catch(err){toast(err.message);}});}

async function openCrmReports() {
  let report;try{report=await api('/crm/reports/summary');}catch(err){return toast(err.message);}
  const rows=(items,value='count')=>items.map(x=>`<tr><td>${esc(x.label||x.name)}</td><td>${x[value]??0}</td></tr>`).join('');
  const o=overlay(`<div class="modal lead-modal"><button class="close-x">×</button><div class="detail-head"><div><div class="eyebrow">MANAGEMENT REPORT</div><h2>CRM performance summary</h2></div><button class="btn btn-sm" id="report-print">Print</button></div>
    <p class="report-date">Generated ${fmtDate(report.generatedAt)}</p><div class="report-grid"><div><h3>Lead stages</h3><table><tr><th>Stage</th><th>Leads</th></tr>${rows(report.stages)}</table></div><div><h3>Lead sources</h3><table><tr><th>Source</th><th>Leads</th></tr>${rows(report.sources)}</table></div><div><h3>Activities</h3><table><tr><th>Type</th><th>Records</th></tr>${rows(report.activities)}</table></div><div><h3>Broker performance</h3><table><tr><th>Broker</th><th>Leads / Won / Calls</th></tr>${report.agents.map(a=>`<tr><td>${esc(a.name)}</td><td>${a.totalLeads} / ${a.wonLeads} / ${a.calls}</td></tr>`).join('')}</table></div><div><h3>Recent lead movement</h3><table><tr><th>Customer</th><th>Movement</th></tr>${(report.movements||[]).map(x=>`<tr><td>${esc(x.contactName)}<small>${fmtDate(x.timestamp)}</small></td><td>${esc(x.fromStage)} → ${esc(x.toStage)}</td></tr>`).join('')}</table></div><div><h3>Closed leads / sales booked</h3><table><tr><th>Customer</th><th>Result</th></tr>${(report.closedLeads||[]).map(x=>`<tr><td>${esc(x.contactName)}<small>${esc(x.title)}</small></td><td>${esc(x.stage)}${x.lostReason?' · '+esc(x.lostReason):''}</td></tr>`).join('')}</table></div><div class="span2"><h3>Call report</h3><table><tr><th>When</th><th>Customer</th><th>Subject</th><th>Owner</th></tr>${(report.calls||[]).map(x=>`<tr><td>${fmtDate(x.createdAt)}</td><td>${esc(x.contactName)}</td><td>${esc(x.subject)}</td><td>${esc(x.ownerName)}</td></tr>`).join('')}</table></div></div></div>`);$('#report-print',o).addEventListener('click',()=>window.print());
}

function openMortgageCalculator() {
  const o=overlay(`<div class="modal" style="max-width:720px"><button class="close-x">×</button><h2>Mortgage and repayment calculator</h2><p class="tool-note">Illustrative estimate only. Bank rates, fees, eligibility and final repayments may differ.</p>
    <form id="mortgage-form"><div class="form-grid"><div><label>Property price (AED)</label><input name="propertyPrice" type="number" min="1" required></div><div><label>Down payment %</label><input name="downPaymentPercent" type="number" min="0" max="100" value="20" required></div><div><label>Loan amount (optional)</label><input name="loanAmount" type="number" min="0"></div><div><label>Annual interest %</label><input name="annualRatePercent" type="number" min="0" step="0.01" value="4.5" required></div><div><label>Term (years)</label><input name="years" type="number" min="1" max="50" value="25" required></div><div><label>Additional upfront costs</label><input name="additionalCosts" type="number" min="0" value="0"></div><div><label>Monthly income (for DBR)</label><input name="monthlyIncome" type="number" min="1"></div><div><label>Existing monthly debt</label><input name="monthlyDebt" type="number" min="0" value="0"></div></div><div class="modal-actions"><button class="btn btn-primary">Calculate</button></div></form><div id="mortgage-result"></div></div>`);
  $('#mortgage-form',o).addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{const x=await api('/crm/tools/mortgage',{method:'POST',body:f});$('#mortgage-result',o).innerHTML=`<div class="calculator-result"><div><span>Monthly repayment</span><strong>${fmtPrice(x.monthlyPayment)}</strong></div><div><span>Loan principal / LTV</span><strong>${fmtPrice(x.principal)} · ${x.loanToValue}%</strong></div><div><span>Upfront cash</span><strong>${fmtPrice(x.upfrontCash)}</strong></div><div><span>Total repayment / interest</span><strong>${fmtPrice(x.totalRepayment)} / ${fmtPrice(x.totalInterest)}</strong></div>${x.debtBurdenRatio!==null?`<div><span>Debt burden ratio</span><strong>${x.debtBurdenRatio}%</strong></div>`:''}</div><p class="tool-note">Illustrative estimate only. Bank rates, fees, eligibility and final repayments may differ.</p>`;}catch(err){toast(err.message);}});
}

async function openAssignmentQueue() {
  let leads;try{({leads}=await api('/crm/reassignment-queue'));}catch(err){return toast(err.message);}
  const o=overlay(`<div class="modal lead-modal"><button class="close-x">×</button><h2>Assignment and reassignment queue</h2><p class="tool-note">Unassigned leads and leads whose response SLA has expired are available here.</p><div class="pipeline-table-wrap"><table><tr><th>Customer</th><th>Opportunity</th><th>Status</th><th>Previous owner</th><th></th></tr>${leads.map(l=>`<tr><td>${esc(l.contactName)}</td><td>${esc(l.title)}</td><td>${esc(l.assignmentStatus.replace('_',' '))}</td><td>${esc(l.assignedToName||'—')}</td><td>${canWriteCrm()?`<button class="btn btn-primary btn-sm" data-claim="${l.id}">Claim</button>`:''}</td></tr>`).join('')}</table>${leads.length?'':'<div class="empty">The assignment queue is clear.</div>'}</div></div>`);
  o.querySelectorAll('[data-claim]').forEach(b=>b.addEventListener('click',async()=>{const nextActionDue=prompt('Next action due (ISO date/time)');if(!nextActionDue)return;try{await api(`/crm/leads/${b.dataset.claim}/claim`,{method:'POST',body:{nextActionDue}});toast('Lead claimed');o.remove();openAssignmentQueue();loadCRMLeads();}catch(err){toast(err.message);}}));
}

function openContactVerification(lead,parent) {
  const o=overlay(`<div class="modal" style="max-width:620px"><button class="close-x">×</button><h2>Contact verification and public profile</h2><p class="tool-note">Format checks are automatic. Mark verified only after an authorised manual or provider check. Record public professional information only when lawful and relevant.</p><form id="verify-form"><div class="form-grid"><div><label>Email status</label><select name="emailStatus">${['unverified','format_valid','verified','invalid'].map(x=>`<option ${lead.emailStatus===x?'selected':''}>${x}</option>`).join('')}</select></div><div><label>Phone status</label><select name="phoneStatus">${['unverified','format_valid','verified','invalid'].map(x=>`<option ${lead.phoneStatus===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="span3"><label>Public professional profile URL</label><input name="publicProfileUrl" type="url" value="${esc(lead.publicProfileUrl||'')}"></div><div class="span3"><label>Screening notes</label><textarea name="screeningNotes" rows="3">${esc(lead.screeningNotes||'')}</textarea></div></div><div class="modal-actions"><button class="btn btn-primary">Save verification</button></div></form></div>`);
  $('#verify-form',o).addEventListener('submit',async e=>{e.preventDefault();try{await api(`/crm/contacts/${lead.contactId}/verification`,{method:'PATCH',body:Object.fromEntries(new FormData(e.target))});toast('Verification updated');o.remove();parent.remove();openLead(lead.id);}catch(err){toast(err.message);}});
}

async function openContactGovernance(lead,parent){
  let channels,candidates,consent;try{[{channels},{candidates},consent]=await Promise.all([
    api(`/crm/contacts/${lead.contactId}/channels`),api(`/crm/contacts/${lead.contactId}/duplicates`),api(`/crm/contacts/${lead.contactId}/consent`)]);
  }catch(err){return toast(err.message);}
  const o=overlay(`<div class="modal lead-modal"><button class="close-x">×</button><h2>Contact governance</h2>
    <div class="kv-grid"><div><b>Marketing consent</b>${consent.effectiveConsent?'Granted':'Not granted'}</div><div><b>Communication restriction</b>${consent.restricted?'Do not contact':'None'}</div><div><b>Evidence</b>${consent.activeAgreement?esc(consent.activeAgreement.templateName+' v'+consent.activeAgreement.templateVersion):'No active executed agreement'}</div></div>
    <h3 style="margin-top:20px">Validated channels</h3><div class="pipeline-table-wrap"><table><tr><th>Kind</th><th>Label</th><th>Raw value</th><th>Normalized</th><th>Verification</th><th>WhatsApp</th><th>Restriction</th></tr>
    ${channels.map(c=>`<tr><td>${esc(c.channelKind)}</td><td>${esc(c.usageLabel)}</td><td>${esc(c.rawValue)}</td><td class="mono">${esc(c.normalizedValue)}</td><td>${esc(c.verificationStatus)}</td><td>${c.whatsappEnabled?'Yes':'No'}</td><td>${esc(c.restrictionStatus)}</td></tr>`).join('')||'<tr><td colspan="7">No channels</td></tr>'}</table></div>
    ${canWriteCrm()?`<form id="channel-form" class="form-grid compact-form" style="margin-top:16px"><div><label>Kind</label><select name="channelKind"><option>Phone</option><option>Email</option></select></div><div><label>Usage label</label><input name="usageLabel" value="Primary"></div><div><label>Value</label><input name="rawValue" required></div><div><label><input name="whatsappEnabled" type="checkbox"> WhatsApp enabled</label></div><button class="btn btn-primary btn-sm">Add channel</button></form>
    <form id="contact-role-form" class="admin-toolbar"><div><label>Additional customer role</label><select name="roleCode"><option>buyer</option><option>seller</option><option>landlord</option><option>tenant</option><option>developer</option><option>investor</option><option>other</option></select></div><button class="btn btn-sm">Add role</button></form>`:''}
    <h3 style="margin-top:20px">Duplicate review</h3>${candidates.length?`<table><tr><th>Candidate</th><th>Match</th><th></th></tr>${candidates.map(c=>`<tr><td>${esc(c.fullName)}<small>${esc(c.email||c.phone||'')}</small></td><td>${esc(c.matchType)}</td><td>${canWriteCrm()&&isCrmLeader()?`<button class="btn btn-danger btn-sm" data-merge="${c.id}">Merge into candidate</button>`:''}</td></tr>`).join('')}</table>`:'<div class="empty">No likely duplicates found.</div>'}</div>`);
  $('#channel-form',o)?.addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await api(`/crm/contacts/${lead.contactId}/channels`,{method:'POST',body:{...f,whatsappEnabled:Boolean(f.whatsappEnabled)}});toast('Channel added');o.remove();openContactGovernance(lead,parent);}catch(err){if(err.status===409&&err.data?.duplicates?.length&&confirm(`This channel exists on ${err.data.duplicates.map(x=>x.fullName).join(', ')}. Add after duplicate review?`)){await api(`/crm/contacts/${lead.contactId}/channels`,{method:'POST',body:{...f,whatsappEnabled:Boolean(f.whatsappEnabled),duplicateReviewed:true}});o.remove();openContactGovernance(lead,parent);}else toast(err.message);}});
  $('#contact-role-form',o)?.addEventListener('submit',async e=>{e.preventDefault();try{await api(`/crm/contacts/${lead.contactId}/roles`,{method:'POST',body:Object.fromEntries(new FormData(e.target))});toast('Contact role added');}catch(err){toast(err.message);}});
  o.querySelectorAll('[data-merge]').forEach(b=>b.addEventListener('click',async()=>{const reason=prompt('Required merge reason');if(!reason)return;try{await api(`/crm/contacts/${lead.contactId}/merge`,{method:'POST',body:{targetContactId:b.dataset.merge,reason}});toast('Contacts merged');o.remove();parent.remove();loadCRMLeads();}catch(err){toast(err.message);}}));
}

function openValueBriefForm(lead,listings,parent) {
  const o=overlay(`<div class="modal"><button class="close-x">×</button><h2>Create customer value brief</h2><form id="brief-form"><div class="form-grid"><div class="span3"><label>Property *</label><select name="listingId" required><option value="">Select listing</option>${listings.map(l=>`<option value="${l.id}" ${lead.listingId===l.id?'selected':''}>${esc(l.project)} · ${esc(l.area)} · ${fmtPrice(l.price,l.currency)}</option>`).join('')}</select></div><div><label>Expected annual rent</label><input name="expectedAnnualRent" type="number" min="0"></div><div><label>Estimated annual costs</label><input name="estimatedAnnualCosts" type="number" min="0" value="0"></div><div class="span3"><label>Strong points of the deal *</label><textarea name="strengths" rows="3" required placeholder="Location, pricing, payment plan, demand, developer track record..."></textarea></div><div class="span3"><label>Why this customer should consider it *</label><textarea name="recommendation" rows="3" required></textarea></div></div><div class="modal-actions"><button class="btn btn-primary">Generate brief</button></div></form></div>`);
  $('#brief-form',o).addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await api(`/crm/leads/${lead.id}/value-briefs`,{method:'POST',body:f});toast('Value brief created');o.remove();parent.remove();openValueBriefs(lead);}catch(err){toast(err.message);}});
}

async function openValueBriefs(lead,parent) {
  let briefs;try{({briefs}=await api(`/crm/leads/${lead.id}/value-briefs`));}catch(err){return toast(err.message);}
  parent?.remove();const o=overlay(`<div class="modal lead-modal brief-print"><button class="close-x">×</button><div class="detail-head"><div><div class="eyebrow">NYSA REALTY · CUSTOMER VALUE BRIEF</div><h2>${esc(lead.contactName)}</h2></div><button class="btn btn-sm" id="brief-print">Print</button></div>${briefs.map(b=>`<section class="value-brief"><h3>${esc(b.project)}</h3><p class="brief-meta">${esc(b.area)} · ${esc(b.propertyType)}${b.bedrooms?' · '+esc(b.bedrooms)+' BR':''} · ${fmtPrice(b.price,b.currency)}</p><div class="calculator-result"><div><span>Expected annual rent</span><strong>${b.expectedAnnualRent?fmtPrice(b.expectedAnnualRent,b.currency):'Not provided'}</strong></div><div><span>Estimated net ROI</span><strong>${b.roiPercent==null?'Not calculated':b.roiPercent+'%'}</strong></div></div><h4>Deal strengths</h4><p>${esc(b.strengths)}</p><h4>Recommendation</h4><p>${esc(b.recommendation)}</p></section>`).join('')||'<div class="empty">No value briefs yet.</div>'}</div>`);$('#brief-print',o).addEventListener('click',()=>window.print());
}

/* ============ LISTINGS ============ */
const opts = (arr, sel) => arr.map(o => `<option ${o === sel ? 'selected' : ''}>${esc(o)}</option>`).join('');

function renderListings() {
  $('#view').innerHTML = `
  <div class="filterbar">
    <div class="filter-grid">
      <div><label>Search</label><input id="f-q" placeholder="Project, developer, area…"></div>
      <div><label>Area / community</label><input id="f-area" placeholder="e.g. Palm Jebel Ali"></div>
      <div><label>Property type</label><select id="f-type"><option value="">Any</option>${opts(PROPERTY_TYPES)}</select></div>
      <div><label>Bedrooms</label><select id="f-beds"><option value="">Any</option>${opts(BEDROOMS)}</select></div>
      <div><label>Min budget (AED)</label><input id="f-min" type="number" min="0" placeholder="0"></div>
      <div><label>Max budget (AED)</label><input id="f-max" type="number" min="0" placeholder="Any"></div>
      <div><label>Payment plan</label><select id="f-plan"><option value="">Any</option>${opts(PAYMENT_PLANS)}</select></div>
      <div><label>Status</label><select id="f-status"><option value="">Any</option>${opts(STATUSES, 'Available')}</select></div>
      <div><label>Exclusivity</label><select id="f-tier"><option value="">Any</option>${opts(TIERS)}</select></div>
      <div><label>Developer</label><input id="f-dev" placeholder="e.g. Emaar"></div>
      <div><label>Handover before</label><input id="f-hb" type="date"></div>
      <div><label>Handover after</label><input id="f-ha" type="date"></div>
    </div>
    <div class="filter-actions">
      <button class="btn btn-primary btn-sm" id="f-apply">Apply filters</button>
      <button class="btn btn-sm" id="f-reset">Reset</button>
      <select id="f-sort" style="width:auto">
        <option value="newest">Newest first</option>
        <option value="price_asc">Price: low → high</option>
        <option value="price_desc">Price: high → low</option>
        <option value="discount">Biggest discount vs reference</option>
        <option value="handover">Nearest handover</option>
      </select>
      ${canPost() ? '<button class="btn btn-primary btn-sm" id="add-listing-btn">+ Add listing</button>' : ''}
      <span class="result-count" id="f-count"></span>
    </div>
  </div>
  <div id="results" class="grid"></div>`;

  $('#f-apply').addEventListener('click', loadListings);
  $('#f-reset').addEventListener('click', () => { renderListings(); });
  $('#f-sort').addEventListener('change', loadListings);
  $('#add-listing-btn')?.addEventListener('click', () => openListingForm());
  $('#view').querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') loadListings(); }));
  loadListings();
}

async function loadListings() {
  const requestId = (loadListings.requestId || 0) + 1;
  loadListings.requestId = requestId;
  const p = new URLSearchParams();
  const set = (k, v) => { if (v) p.set(k, v); };
  set('q', $('#f-q').value.trim()); set('area', $('#f-area').value.trim());
  set('propertyType', $('#f-type').value); set('bedrooms', $('#f-beds').value);
  set('minPrice', $('#f-min').value); set('maxPrice', $('#f-max').value);
  set('paymentPlanType', $('#f-plan').value); set('status', $('#f-status').value);
  set('exclusivityTier', $('#f-tier').value); set('developer', $('#f-dev').value.trim());
  set('handoverBefore', $('#f-hb').value); set('handoverAfter', $('#f-ha').value);
  set('sort', $('#f-sort').value);
  try {
    const { count, listings } = await api('/listings?' + p.toString());
    if (requestId !== loadListings.requestId) return;
    lastListings = listings;
    $('#f-count').textContent = count + ' listing' + (count === 1 ? '' : 's');
    $('#results').innerHTML = listings.length ? listings.map(cardHTML).join('')
      : '<div class="empty" style="grid-column:1/-1">No listings match these filters.</div>';
    document.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => openDetail(c.dataset.id)));
  } catch (err) { toast(err.message); }
}

function cardHTML(l) {
  return `
    <div class="card" data-id="${esc(l.id)}">
    ${l.discountPercent > 0 ? `<div class="discount-tag">−${l.discountPercent}% vs ref</div>` : ''}
    <h3>${esc(l.project)}</h3>
    <div class="meta">${esc(l.area)}${l.developer ? ' · ' + esc(l.developer) : ''}</div>
    <div class="price">${fmtPrice(l.price, l.currency)}${l.referencePrice ? ` <small>ref ${fmtPrice(l.referencePrice, l.currency)}</small>` : ''}</div>
    <div class="specs">
      <span>${esc(l.propertyType)}</span>
      ${l.bedrooms ? `<span>${esc(l.bedrooms)} BR</span>` : ''}
      ${l.sizeSqft ? `<span>${Number(l.sizeSqft).toLocaleString()} sqft</span>` : ''}
      <span>${l.handoverDate === 'Ready' ? 'Ready' : 'HO ' + esc(l.handoverDate || 'TBC')}</span>
    </div>
    <div class="badges">
      <span class="badge status-${esc(l.status.replace(' ', '.'))}">${esc(l.status)}${l.closedReason ? ' · ' + esc(l.closedReason) : ''}</span>
      <span class="badge tier">${esc(l.exclusivityTier)}</span>
      ${l.paymentPlanType ? `<span class="badge">${esc(l.paymentPlanType)}</span>` : ''}
    </div>
    <div class="comment-ct">${l.commentCount || 0} 💬 · ${esc(l.postedByName)}</div>
  </div>`;
}

/* ============ DETAIL + COMMENTS ============ */
function overlay(html) {
  const o = document.createElement('div');
  o.className = 'overlay'; o.innerHTML = html;
  o.addEventListener('click', (e) => { if (e.target === o) o.remove(); });
  o.querySelector('.close-x')?.addEventListener('click', () => o.remove());
  document.body.appendChild(o);
  return o;
}

async function openDetail(id) {
  let l;
  try { l = await api('/listings/' + id); } catch (e) { return toast(e.message); }
  const plan = [
    l.paymentPlanType,
    l.downPaymentPercent != null ? l.downPaymentPercent + '% down' : null,
    l.onHandoverPercent != null ? l.onHandoverPercent + '% on handover' : null,
    l.postHandoverYears != null ? l.postHandoverYears + ' yrs post-handover' : null
  ].filter(Boolean).join(' · ');
  const o = overlay(`
  <div class="modal">
    <button class="close-x">✕</button>
    <div class="detail-head">
      <div>
        <h2 style="margin-bottom:2px">${esc(l.project)}</h2>
        <div style="color:var(--muted);font-size:13px">${esc(l.area)}${l.developer ? ' · ' + esc(l.developer) : ''}</div>
      </div>
      <div style="text-align:right">
        <div class="detail-price">${fmtPrice(l.price, l.currency)}</div>
        ${l.referencePrice ? `<div style="color:var(--muted);font-size:12px">ref ${fmtPrice(l.referencePrice, l.currency)}${l.discountPercent > 0 ? ` · <span style="color:var(--green)">−${l.discountPercent}%</span>` : ''}</div>` : ''}
      </div>
    </div>
    <div class="badges" style="margin-top:10px">
      <span class="badge status-${esc(l.status.replace(' ', '.'))}">${esc(l.status)}${l.closedReason ? ' · ' + esc(l.closedReason) : ''}</span>
      <span class="badge tier">${esc(l.exclusivityTier)}</span>
    </div>
    <div class="kv-grid">
      <div><b>Type</b>${esc(l.propertyType)}</div>
      <div><b>Bedrooms</b>${esc(l.bedrooms || '—')}</div>
      <div><b>Size</b>${l.sizeSqft ? Number(l.sizeSqft).toLocaleString() + ' sqft' : '—'}</div>
      <div><b>Handover</b>${esc(l.handoverDate || 'TBC')}</div>
      <div class="span2"><b>Payment plan</b>${esc(plan || '—')}${l.paymentPlanNotes ? '<br><span style="color:var(--muted);font-size:12px">' + esc(l.paymentPlanNotes) + '</span>' : ''}</div>
      <div><b>Posted by</b>${esc(l.postedByName)}<br><span style="color:var(--muted);font-size:12px">${esc(l.postedByBrokerage || '')}</span></div>
      <div><b>Contact</b>${esc(l.contact || '—')}</div>
      <div><b>Listed</b>${fmtDate(l.createdAt)}</div>
    </div>
    ${l.notes ? `<div class="notes-block">${esc(l.notes)}</div>` : ''}
    ${canEditListing(l) ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-sm" id="d-edit">Edit listing</button>
      ${l.status !== 'Closed' ? `
        <select id="d-status" style="width:auto" class="btn-sm">
          ${STATUSES.filter(s => s !== 'Closed').map(s => `<option ${s === l.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="btn btn-sm" id="d-close">Mark closed…</button>` : `<button class="btn btn-sm" id="d-reopen">Reopen as Available</button>`}
      ${ME.role === 'admin' ? '<button class="btn btn-sm btn-danger" id="d-archive">Archive (soft delete)</button>' : ''}
    </div>` : ''}
    <div class="comments">
      <h3>Broker coordination</h3>
      <div id="c-list">Loading…</div>
      ${!isViewer() ? `
      <div class="comment-form">
        <input id="c-input" placeholder="e.g. Client interested, arranging a viewing…">
        <button class="btn btn-primary btn-sm" id="c-post" style="white-space:nowrap">Post</button>
      </div>` : ''}
    </div>
  </div>`);

  $('#d-edit', o)?.addEventListener('click', () => { o.remove(); openListingForm(l); });
  $('#d-status', o)?.addEventListener('change', async (e) => {
    try { await api(`/listings/${l.id}/status`, { method: 'PATCH', body: { status: e.target.value } }); toast('Status updated'); o.remove(); loadListings(); }
    catch (err) { toast(err.message); }
  });
  $('#d-close', o)?.addEventListener('click', () => { o.remove(); openCloseModal(l); });
  $('#d-reopen', o)?.addEventListener('click', async () => {
    try { await api(`/listings/${l.id}/status`, { method: 'PATCH', body: { status: 'Available' } }); toast('Listing reopened'); o.remove(); loadListings(); }
    catch (err) { toast(err.message); }
  });
  $('#d-archive', o)?.addEventListener('click', async () => {
    if (!confirm('Archive this listing? It will be hidden from all brokers but retained for audit.')) return;
    try { await api('/listings/' + l.id, { method: 'DELETE' }); toast('Listing archived'); o.remove(); loadListings(); }
    catch (err) { toast(err.message); }
  });
  $('#c-post', o)?.addEventListener('click', () => postComment(l.id, o));
  $('#c-input', o)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') postComment(l.id, o); });
  loadComments(l.id, o);
}

async function loadComments(listingId, o) {
  try {
    const { comments } = await api(`/listings/${listingId}/comments`);
    $('#c-list', o).innerHTML = comments.length ? comments.map(c => `
      <div class="comment">
        <div class="c-head"><b>${esc(c.authorName)}</b><span>${esc(c.authorBrokerage || '')}</span><span>· ${fmtDate(c.createdAt)}${c.editedAt ? ' (edited)' : ''}</span></div>
        <p>${esc(c.body)}</p>
        ${(c.authorId === ME.id || ME.role === 'admin') ? `
        <div class="c-actions">
          ${c.authorId === ME.id ? `<a data-edit="${c.id}">Edit</a>` : ''}
          <a data-del="${c.id}">Delete</a>
        </div>` : ''}
      </div>`).join('') : '<div style="color:var(--muted);font-size:12px;padding:8px 0">No comments yet.</div>';
    o.querySelectorAll('[data-edit]').forEach(a => a.addEventListener('click', async () => {
      const cur = comments.find(c => c.id === a.dataset.edit);
      const body = prompt('Edit comment (allowed within 15 minutes of posting):', cur.body);
      if (body === null || !body.trim()) return;
      try { await api('/comments/' + a.dataset.edit, { method: 'PATCH', body: { body } }); loadComments(listingId, o); }
      catch (err) { toast(err.message); }
    }));
    o.querySelectorAll('[data-del]').forEach(a => a.addEventListener('click', async () => {
      if (!confirm('Delete this comment?')) return;
      try { await api('/comments/' + a.dataset.del, { method: 'DELETE' }); loadComments(listingId, o); }
      catch (err) { toast(err.message); }
    }));
  } catch (err) { $('#c-list', o).textContent = err.message; }
}

async function postComment(listingId, o) {
  const input = $('#c-input', o);
  if (!input.value.trim()) return;
  try {
    await api(`/listings/${listingId}/comments`, { method: 'POST', body: { body: input.value } });
    input.value = '';
    loadComments(listingId, o);
  } catch (err) { toast(err.message); }
}

/* ============ ADD / EDIT LISTING ============ */
function openListingForm(l = null) {
  const v = (f) => l ? esc(l[f] ?? '') : '';
  const o = overlay(`
  <div class="modal">
    <button class="close-x">✕</button>
    <h2>${l ? 'Edit listing' : 'Add pocket listing'}</h2>
    <form id="listing-form">
      <div class="form-grid">
        <div class="span2"><label>Project *</label><input name="project" required value="${v('project')}"></div>
        <div><label>Developer</label><input name="developer" value="${v('developer')}"></div>
        <div><label>Area / community *</label><input name="area" required value="${v('area')}"></div>
        <div><label>Property type *</label><select name="propertyType">${opts(PROPERTY_TYPES, l?.propertyType)}</select></div>
        <div><label>Bedrooms</label><select name="bedrooms"><option value="">—</option>${opts(BEDROOMS, l?.bedrooms)}</select></div>
        <div><label>Size (sqft)</label><input name="sizeSqft" type="number" min="0" value="${v('sizeSqft')}"></div>
        <div><label>Asking price (AED) *</label><input name="price" type="number" min="1" required value="${v('price')}"></div>
        <div><label>Reference / market price</label><input name="referencePrice" type="number" min="0" value="${v('referencePrice')}"></div>
        <div><label>Payment plan</label><select name="paymentPlanType"><option value="">—</option>${opts(PAYMENT_PLANS, l?.paymentPlanType)}</select></div>
        <div><label>Down payment %</label><input name="downPaymentPercent" type="number" min="0" max="100" value="${v('downPaymentPercent')}"></div>
        <div><label>On handover %</label><input name="onHandoverPercent" type="number" min="0" max="100" value="${v('onHandoverPercent')}"></div>
        <div><label>Post-handover years</label><input name="postHandoverYears" type="number" min="0" value="${v('postHandoverYears')}"></div>
        <div class="span2"><label>Payment plan notes</label><input name="paymentPlanNotes" value="${v('paymentPlanNotes')}"></div>
        <div><label>Handover ("Ready" or date)</label><input name="handoverDate" placeholder="Ready or 2027-06-01" value="${v('handoverDate')}"></div>
        <div><label>Exclusivity tier</label><select name="exclusivityTier">${opts(TIERS, l?.exclusivityTier ?? 'Off-market')}</select></div>
        <div class="span2"><label>Contact for this listing</label><input name="contact" value="${l ? esc(l.contact ?? '') : esc(ME.phone || '')}"></div>
        <div class="span3"><label>Notes (visible to all brokers)</label><textarea name="notes" rows="3">${v('notes')}</textarea></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" id="lf-cancel">Cancel</button>
        <button class="btn btn-primary">${l ? 'Save changes' : 'Post listing'}</button>
      </div>
    </form>
  </div>`);
  $('#lf-cancel', o).addEventListener('click', () => o.remove());
  $('#listing-form', o).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    for (const k of ['sizeSqft','price','referencePrice','downPaymentPercent','onHandoverPercent','postHandoverYears'])
      f[k] = f[k] === '' ? null : +f[k];
    for (const k of ['developer','bedrooms','paymentPlanType','paymentPlanNotes','handoverDate','contact','notes'])
      if (f[k] === '') f[k] = null;
    try {
      if (l) await api('/listings/' + l.id, { method: 'PATCH', body: f });
      else await api('/listings', { method: 'POST', body: f });
      toast(l ? 'Listing updated' : 'Listing posted');
      o.remove(); loadListings();
    } catch (err) { toast(err.message); }
  });
}

function openCloseModal(l) {
  const o = overlay(`
  <div class="modal" style="max-width:420px">
    <button class="close-x">✕</button>
    <h2>Close listing</h2>
    <p style="color:var(--muted);font-size:13px;margin-bottom:14px">${esc(l.project)} — closed listings stay visible in search but are excluded from the default Available view.</p>
    <label>Reason *</label>
    <select id="close-reason"><option>Sold</option><option>Withdrawn</option><option>Expired</option></select>
    <div class="modal-actions">
      <button class="btn" id="cl-cancel">Cancel</button>
      <button class="btn btn-primary" id="cl-confirm">Mark as Closed</button>
    </div>
  </div>`);
  $('#cl-cancel', o).addEventListener('click', () => o.remove());
  $('#cl-confirm', o).addEventListener('click', async () => {
    try {
      await api(`/listings/${l.id}/status`, { method: 'PATCH', body: { status: 'Closed', closedReason: $('#close-reason', o).value } });
      toast('Listing closed'); o.remove(); loadListings();
    } catch (err) { toast(err.message); }
  });
}

/* ============ ADMIN ============ */
async function renderAdmin() {
  $('#view').innerHTML = `
  <div class="admin-section"><h2>NYSA Organization Settings</h2><p class="tool-note">Versioned company identity used by proposals, documents and disclaimers. This is separate from external company records.</p>
    <form id="organization-form" class="form-grid"><div><label>Legal name *</label><input name="legalName" required></div><div><label>Display name *</label><input name="displayName" required></div><div><label>Trade license</label><input name="tradeLicenseNumber"></div><div><label>Registration authority</label><input name="registrationAuthority"></div><div><label>Primary email</label><input name="primaryEmail" type="email"></div><div><label>Primary phone</label><input name="primaryPhone"></div><div><label>Website</label><input name="websiteUrl" type="url"></div><div><label>Currency</label><input name="defaultCurrency" value="AED" maxlength="3"></div><div class="span3"><label>Registered address</label><input name="registeredAddress"></div><div class="span3"><label>Default proposal disclaimer</label><textarea name="defaultDisclaimer" rows="2"></textarea></div><button class="btn btn-primary btn-sm">Save active version</button></form><div id="organization-version" class="tool-note" style="margin-top:10px"></div>
  </div>
  <div class="admin-section"><h2>Controlled values</h2><p class="tool-note">Stable codes cannot be renamed after creation and used values are retired, never deleted.</p>
    <form id="value-set-form" class="admin-toolbar"><div><label>Stable code</label><input name="stableCode" required placeholder="loss_reason"></div><div><label>Name</label><input name="name" required></div><div><label>Class</label><select name="configurationClass"><option>A</option><option>B</option><option>C</option></select></div><button class="btn btn-primary btn-sm">Create value set</button></form><div id="value-set-table">Loading...</div>
  </div>
  <div class="admin-section"><h2>Business hours and SLA policies</h2><p class="tool-note">Policies are versioned. Activating a draft retires the previous policy without rewriting existing lead deadlines.</p>
    <form id="sla-form" class="admin-toolbar"><div><label>Name</label><input name="name" required placeholder="Dubai working week"></div><div><label>Work days (0 Sun…6 Sat)</label><input name="workDays" value="1,2,3,4,5"></div><div><label>Start minute</label><input name="workStartMinute" type="number" value="540"></div><div><label>End minute</label><input name="workEndMinute" type="number" value="1080"></div><div><label>Acceptance min</label><input name="acceptanceMinutes" type="number" value="30"></div><div><label>First-contact min</label><input name="firstContactMinutes" type="number" value="240"></div><button class="btn btn-primary btn-sm">Create draft</button></form><div id="sla-table">Loading...</div>
  </div>
  <div class="admin-section"><h2>Lead routing rules</h2><form id="routing-form" class="admin-toolbar"><div><label>Name</label><input name="name" required></div><div><label>Priority</label><input name="priority" type="number" value="100"></div><div><label>Source (blank = any)</label><select name="source"><option value="">Any</option>${SOURCES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div><label>Business type</label><select name="businessType"><option value="">Any</option>${BUSINESS_TYPES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div><label>Team</label><select name="teamId" id="routing-team" required></select></div><div><label>Named agent (optional)</label><select name="agentId" id="routing-agent"><option value="">Team queue</option></select></div><button class="btn btn-primary btn-sm">Add rule</button></form><div id="routing-table">Loading...</div></div>
  <div class="admin-section"><h2>Website intake operations</h2><p class="tool-note">Only event metadata and error codes are retained; full customer payloads are not exposed here.</p><div id="intake-table">Loading...</div></div>
  <div class="admin-section"><h2>Qualification model versions</h2><p class="tool-note">Active versions are immutable. Factors use non-sensitive numeric business inputs and explainable weighted contributions.</p><form id="qualification-model-form" class="form-grid"><div><label>Stable model code *</label><input name="modelCode" required value="lead_readiness"></div><div><label>Name *</label><input name="name" required value="Lead readiness"></div><div><label>Purpose *</label><input name="purpose" required value="Prioritize response"></div><div><label>Business line</label><input name="businessLine"></div><div><label>Warm minimum</label><input name="warmMin" type="number" value="45"></div><div><label>Hot minimum</label><input name="hotMin" type="number" value="75"></div><div class="span3"><label>Factors JSON *</label><textarea name="factors" rows="5" required>[{"code":"budget_readiness","label":"Budget readiness","inputSource":"agent_confirmed","min":0,"max":10,"weight":1,"required":true,"missingTreatment":"reject"}]</textarea></div><div class="span3"><label>Guidance JSON</label><textarea name="guidance" rows="3">{"Hot":{"responseMinutes":15,"strategy":"Call immediately"},"Warm":{"responseMinutes":240,"strategy":"Contact today"},"Cold":{"responseMinutes":1440,"strategy":"Permission-based nurture"}}</textarea></div><button class="btn btn-primary btn-sm">Create draft version</button></form><div id="qualification-model-table">Loading...</div></div>
  <div class="admin-section"><h2>Regulatory and fee assumption versions</h2><form id="assumption-form" class="form-grid"><div><label>Name *</label><input name="name" value="UAE property finance" required></div><div><label>Currency</label><input name="currency" value="AED"></div><div class="span3"><label>Assumptions JSON *</label><textarea name="assumptions" rows="3" required>{"note":"Illustrative rates and fees are entered per scenario"}</textarea></div><div class="span3"><label>Estimate disclaimer *</label><textarea name="disclaimer" required>Illustrative estimate only; lender, regulatory, fee and property outcomes may differ and are not guaranteed.</textarea></div><button class="btn btn-primary btn-sm">Create draft version</button></form><div id="assumption-table">Loading...</div></div>
  <div class="admin-section">
    <h2>CRM teams</h2>
    <div class="admin-toolbar">
      <div><label>Team name</label><input id="team-name" placeholder="e.g. Residential Sales" style="width:220px"></div>
      <div><label>Lead response SLA (hours)</label><input id="team-sla" type="number" min="1" max="168" value="4" style="width:110px"></div>
      <button class="btn btn-primary btn-sm" id="team-create" style="height:33px">Create team</button>
    </div>
    <div id="team-table">Loading...</div>
  </div>
  <div class="admin-section">
    <h2>Invitations</h2>
    <div class="admin-toolbar">
      <div><label>Scope to email (optional)</label><input id="inv-email" type="email" placeholder="broker@partner.ae" style="width:220px"></div>
      <div><label>Role</label><select id="inv-role" style="width:170px">
        <option value="internal_broker">Internal Broker</option><option value="partner_broker">Partner Broker</option>
        <option value="viewer">Viewer</option><option value="admin">Admin</option></select></div>
      <div><label>Internal job role</label><select id="inv-job-role" style="width:160px">${Object.entries(JOB_ROLES).map(([k,v])=>`<option value="${k}" ${k==='sales_agent'?'selected':''}>${v}</option>`).join('')}</select></div>
      <div><label>Max uses</label><input id="inv-uses" type="number" min="1" value="1" style="width:80px"></div>
      <div><label>Expires</label><input id="inv-exp" type="date" style="width:150px"></div>
      <button class="btn btn-primary btn-sm" id="inv-create" style="height:33px">Issue invitation</button>
    </div>
    <div id="inv-table">Loading…</div>
  </div>
  <div class="admin-section"><h2>Brokers</h2><div id="broker-table">Loading…</div></div>
  <div class="admin-section">
    <h2>Audit log</h2>
    <div class="admin-toolbar">
      <div><label>Entity type</label><select id="al-type" style="width:150px"><option value="">All</option>
        <option>Listing</option><option>Comment</option><option>Broker</option><option>Invitation</option><option>Team</option><option>Contact</option><option>Lead</option><option>Activity</option><option>Company</option><option>ValueBrief</option></select></div>
      <button class="btn btn-sm" id="al-refresh" style="height:33px">Refresh</button>
    </div>
    <div id="audit-table">Loading…</div>
  </div>`;
  $('#inv-create').addEventListener('click', createInvite);
  $('#team-create').addEventListener('click', createTeam);
  $('#al-refresh').addEventListener('click', loadAudit);
  $('#al-type').addEventListener('change', loadAudit);
  $('#organization-form').addEventListener('submit',saveOrganization);
  $('#value-set-form').addEventListener('submit',createValueSet);
  $('#sla-form').addEventListener('submit',createSlaPolicy);$('#routing-form').addEventListener('submit',createRoutingRule);
  $('#qualification-model-form').addEventListener('submit',createQualificationModel);$('#assumption-form').addEventListener('submit',createAssumptionVersion);
  loadOrganization();loadValueSets();loadSlaPolicies();loadRoutingRules();loadIntakeEvents();loadQualificationModels();loadAssumptionVersions();loadTeams(); loadInvites(); loadBrokers(); loadAudit();
}

async function createSlaPolicy(e){e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.workDays=b.workDays.split(',').map(Number);for(const k of ['workStartMinute','workEndMinute','acceptanceMinutes','firstContactMinutes'])b[k]=Number(b[k]);try{await api('/admin/sla-policies',{method:'POST',body:b});e.target.reset();toast('SLA policy draft created');loadSlaPolicies();}catch(err){toast(err.message);}}
async function loadSlaPolicies(){try{const{policies}=await api('/admin/sla-policies');$('#sla-table').innerHTML=`<table><tr><th>Name</th><th>Hours</th><th>Acceptance</th><th>First contact</th><th>Status</th><th></th></tr>${policies.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.workStartMinute}–${p.workEndMinute} · ${esc((p.workDays||[]).join(','))}</td><td>${p.acceptanceMinutes} min</td><td>${p.firstContactMinutes} min</td><td>${esc(p.status)}</td><td>${p.status==='draft'?`<button class="btn btn-primary btn-sm" data-activate-sla="${p.id}">Activate</button>`:''}</td></tr>`).join('')}</table>`;document.querySelectorAll('[data-activate-sla]').forEach(b=>b.addEventListener('click',async()=>{try{await api(`/admin/sla-policies/${b.dataset.activateSla}/activate`,{method:'POST'});loadSlaPolicies();}catch(err){toast(err.message);}}));}catch(err){$('#sla-table').textContent=err.message;}}
async function createRoutingRule(e){e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.priority=Number(b.priority);b.assignmentMethod=b.agentId?'named_agent':'team_queue';b.agentId=b.agentId||null;b.source=b.source||null;b.businessType=b.businessType||null;try{await api('/admin/routing-rules',{method:'POST',body:b});e.target.reset();loadRoutingRules();}catch(err){toast(err.message);}}
async function loadRoutingRules(){try{const[{rules},{teams},{staff}]=await Promise.all([api('/admin/routing-rules'),api('/crm/teams'),api('/crm/staff')]);$('#routing-team').innerHTML=teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');$('#routing-agent').innerHTML='<option value="">Team queue</option>'+staff.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');$('#routing-table').innerHTML=`<table><tr><th>Priority</th><th>Rule</th><th>Match</th><th>Destination</th><th>Status</th></tr>${rules.map(x=>`<tr><td>${x.priority}</td><td>${esc(x.name)}</td><td>${esc(x.source||'Any source')} · ${esc(x.businessType||'Any business')}</td><td>${esc(x.teamName)}${x.agentName?' · '+esc(x.agentName):' · team queue'}</td><td>${x.active?'Active':'Retired'}</td></tr>`).join('')}</table>`;}catch(err){$('#routing-table').textContent=err.message;}}
async function loadIntakeEvents(){try{const{events}=await api('/admin/website-intake');$('#intake-table').innerHTML=`<table><tr><th>Event</th><th>Status</th><th>Received</th><th>Attempts</th><th>Error</th></tr>${events.map(x=>`<tr><td class="mono">${esc(x.eventId)}</td><td>${esc(x.status)}</td><td>${fmtDate(x.receivedAt)}</td><td>${x.attemptCount}</td><td>${esc(x.errorCode||'—')}</td></tr>`).join('')}</table>`;}catch(err){$('#intake-table').textContent=err.message;}}
async function createQualificationModel(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{const body={...f,factors:JSON.parse(f.factors),guidance:JSON.parse(f.guidance||'{}'),thresholds:{warmMin:Number(f.warmMin),hotMin:Number(f.hotMin)}};await api('/admin/qualification-models',{method:'POST',body});toast('Qualification model draft created');loadQualificationModels();}catch(err){toast(err.message);}}
async function loadQualificationModels(){try{const{models}=await api('/admin/qualification-models');$('#qualification-model-table').innerHTML=`<table><tr><th>Model</th><th>Version</th><th>Status</th><th>Thresholds</th><th></th></tr>${models.map(m=>`<tr><td>${esc(m.name)}<small>${esc(m.modelCode)}</small></td><td>${m.version}</td><td>${esc(m.status)}</td><td>Warm ${m.thresholds.warmMin} · Hot ${m.thresholds.hotMin}</td><td>${m.status==='draft'?`<button class="btn btn-sm" data-approve-model="${m.id}">Approve</button>`:''}${m.status==='approved'?`<button class="btn btn-primary btn-sm" data-activate-model="${m.id}">Activate</button>`:''}</td></tr>`).join('')}</table>`;document.querySelectorAll('[data-approve-model]').forEach(b=>b.addEventListener('click',async()=>{const reason=prompt('Approval reason');if(!reason)return;try{await api(`/admin/qualification-models/${b.dataset.approveModel}/approve`,{method:'POST',body:{reason}});loadQualificationModels();}catch(err){toast(err.message);}}));document.querySelectorAll('[data-activate-model]').forEach(b=>b.addEventListener('click',async()=>{try{await api(`/admin/qualification-models/${b.dataset.activateModel}/activate`,{method:'POST'});loadQualificationModels();}catch(err){toast(err.message);}}));}catch(err){$('#qualification-model-table').textContent=err.message;}}
async function createAssumptionVersion(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{f.assumptions=JSON.parse(f.assumptions);await api('/admin/regulatory-assumptions',{method:'POST',body:f});toast('Assumption draft created');loadAssumptionVersions();}catch(err){toast(err.message);}}
async function loadAssumptionVersions(){try{const{versions}=await api('/admin/regulatory-assumptions');$('#assumption-table').innerHTML=`<table><tr><th>Name</th><th>Version</th><th>Effective</th><th>Status</th><th></th></tr>${versions.map(v=>`<tr><td>${esc(v.name)}</td><td>${v.version}</td><td>${fmtDate(v.effectiveFrom)}</td><td>${esc(v.status)}</td><td>${v.status==='draft'?`<button class="btn btn-primary btn-sm" data-activate-assumption="${v.id}">Activate</button>`:''}</td></tr>`).join('')}</table>`;document.querySelectorAll('[data-activate-assumption]').forEach(b=>b.addEventListener('click',async()=>{try{await api(`/admin/regulatory-assumptions/${b.dataset.activateAssumption}/activate`,{method:'POST'});loadAssumptionVersions();}catch(err){toast(err.message);}}));}catch(err){$('#assumption-table').textContent=err.message;}}

async function loadOrganization(){
  try{const{organization:o}=await api('/crm/organization');if(!o){$('#organization-version').textContent='No active organization version yet.';return;}
    const form=$('#organization-form');for(const key of ['legalName','displayName','tradeLicenseNumber','registrationAuthority','primaryEmail','primaryPhone','websiteUrl','defaultCurrency','registeredAddress','defaultDisclaimer'])if(form.elements[key])form.elements[key].value=o[key]||'';
    $('#organization-version').textContent=`Active version ${o.version} · effective ${fmtDate(o.effectiveFrom)}`;
  }catch(err){$('#organization-version').textContent=err.message;}
}

async function saveOrganization(e){e.preventDefault();const body=Object.fromEntries(new FormData(e.target));body.status='active';try{await api('/crm/organization/versions',{method:'POST',body});toast('Organization version activated');loadOrganization();}catch(err){toast(err.message);}}

async function createValueSet(e){e.preventDefault();try{await api('/admin/value-sets',{method:'POST',body:Object.fromEntries(new FormData(e.target))});e.target.reset();toast('Value set created');loadValueSets();}catch(err){toast(err.message);}}

async function loadValueSets(){
  try{const{sets}=await api('/admin/value-sets');$('#value-set-table').innerHTML=sets.length?`<table><tr><th>Set</th><th>Class</th><th>Definitions</th><th></th></tr>${sets.map(s=>`<tr><td><b>${esc(s.name)}</b><small class="mono">${esc(s.stableCode)}</small></td><td>${esc(s.configurationClass)}</td><td>${(s.definitions||[]).map(v=>`${esc(v.displayLabelEn)} <small>(${esc(v.definitionStatus)})</small>`).join('<br>')||'—'}</td><td><button class="btn btn-sm" data-add-definition="${s.id}">Add definition</button></td></tr>`).join('')}</table>`:'<div class="empty">No controlled value sets yet.</div>';
    document.querySelectorAll('[data-add-definition]').forEach(b=>b.addEventListener('click',()=>openValueDefinition(b.dataset.addDefinition)));
  }catch(err){$('#value-set-table').textContent=err.message;}
}

function openValueDefinition(setId){const o=overlay(`<div class="modal"><button class="close-x">×</button><h2>Add controlled value</h2><form id="definition-form"><div class="form-grid"><div><label>Stable code *</label><input name="stableCode" required></div><div><label>English label *</label><input name="displayLabelEn" required></div><div><label>Arabic label</label><input name="displayLabelAr"></div><div><label>Status</label><select name="definitionStatus"><option>draft</option><option>active</option><option>deprecated</option><option>retired</option></select></div><div><label>Display order</label><input name="displayOrder" type="number" value="0"></div><div><label><input name="isDefault" type="checkbox"> Default</label></div></div><div class="modal-actions"><button class="btn btn-primary">Create</button></div></form></div>`);$('#definition-form',o).addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.isDefault=Boolean(f.isDefault);try{await api(`/admin/value-sets/${setId}/definitions`,{method:'POST',body:f});toast('Controlled value created');o.remove();loadValueSets();}catch(err){toast(err.message);}});}

async function createTeam() {
  try {
    await api('/crm/teams', { method:'POST', body:{ name:$('#team-name').value.trim(), leadResponseHours:+$('#team-sla').value } });
    $('#team-name').value=''; toast('Team created'); loadTeams(); loadBrokers();
  } catch (err) { toast(err.message); }
}

async function loadTeams() {
  try {
    const [{ teams },{ staff }] = await Promise.all([api('/crm/teams'),api('/crm/staff')]);
    $('#team-table').innerHTML = teams.length ? `<table><tr><th>Team</th><th>Manager</th><th>Members</th><th>Response SLA</th><th></th></tr>${teams.map(t=>`<tr><td><b>${esc(t.name)}</b></td><td><select data-team-manager="${t.id}" style="width:170px"><option value="">Unassigned</option>${staff.map(s=>`<option value="${s.id}" ${t.managerId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></td><td>${t.memberCount}</td><td><input data-team-sla="${t.id}" type="number" min="1" max="168" value="${t.leadResponseHours}" style="width:80px"></td><td><button class="btn btn-danger btn-sm" data-team-deactivate="${t.id}">Deactivate</button></td></tr>`).join('')}</table>` : '<div class="empty">No teams yet. Create the first team before assigning leads.</div>';
    const save=async(id,body)=>{try{await api('/crm/teams/'+id,{method:'PATCH',body});toast('Team updated');loadTeams();}catch(err){toast(err.message);}};
    document.querySelectorAll('[data-team-manager]').forEach(s=>s.addEventListener('change',()=>save(s.dataset.teamManager,{managerId:s.value||null})));
    document.querySelectorAll('[data-team-sla]').forEach(i=>i.addEventListener('change',()=>save(i.dataset.teamSla,{leadResponseHours:+i.value})));
    document.querySelectorAll('[data-team-deactivate]').forEach(b=>b.addEventListener('click',()=>{if(confirm('Deactivate this team? Existing history is retained.'))save(b.dataset.teamDeactivate,{active:false});}));
  } catch (err) { $('#team-table').textContent=err.message; }
}

async function createInvite() {
  try {
    const inv = await api('/admin/invitations', { method: 'POST', body: {
      issuedToEmail: $('#inv-email').value.trim() || null,
      role: $('#inv-role').value,
      jobRole: $('#inv-job-role').value,
      maxUses: +$('#inv-uses').value || 1,
      expiresAt: $('#inv-exp').value || null
    }});
    toast('Invitation created: ' + inv.code);
    loadInvites();
  } catch (err) { toast(err.message); }
}

async function loadInvites() {
  try {
    const { invitations } = await api('/admin/invitations');
    $('#inv-table').innerHTML = `<table><tr><th>Code</th><th>Access / job role</th><th>Scoped to</th><th>Uses</th><th>Expires</th><th>Status</th><th></th></tr>
    ${invitations.map(i => `<tr>
      <td class="mono">${esc(i.code)}</td><td>${esc(ROLES[i.role])}${i.jobRole?' · '+esc(JOB_ROLES[i.jobRole]||i.jobRole):''}</td><td>${esc(i.issuedToEmail || 'Anyone')}</td>
      <td>${i.usedCount}/${i.maxUses}</td><td>${i.expiresAt ? esc(i.expiresAt.slice(0,10)) : '—'}</td>
      <td><span class="pill ${esc(i.status)}">${esc(i.status)}</span></td>
      <td>${i.status === 'active' ? `<button class="btn btn-sm btn-danger" data-revoke-inv="${i.id}">Revoke</button>` : ''}</td>
    </tr>`).join('')}</table>`;
    document.querySelectorAll('[data-revoke-inv]').forEach(b => b.addEventListener('click', async () => {
      try { await api('/admin/invitations/' + b.dataset.revokeInv, { method: 'DELETE' }); loadInvites(); } catch (e) { toast(e.message); }
    }));
  } catch (err) { $('#inv-table').textContent = err.message; }
}

async function loadBrokers() {
  try {
    const [{ brokers }, { teams }] = await Promise.all([api('/admin/brokers'), api('/crm/teams')]);
    $('#broker-table').innerHTML = `<table><tr><th>Name</th><th>Email</th><th>Brokerage</th><th>Access role</th><th>Job role</th><th>CRM team</th><th>Can post</th><th>Status</th><th></th></tr>
    ${brokers.map(b => `<tr>
      <td>${esc(b.name)}</td><td>${esc(b.email)}</td><td>${esc(b.brokerage || '—')}</td>
      <td><select data-role="${b.id}" style="width:150px" ${b.id === ME.id ? 'disabled' : ''}>
        ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${b.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td>${['admin','internal_broker'].includes(b.role)?`<select data-job-role="${b.id}" style="width:150px">${Object.entries(JOB_ROLES).map(([k,v])=>`<option value="${k}" ${b.jobRole===k?'selected':''}>${v}</option>`).join('')}</select>`:'—'}</td>
      <td>${['admin','internal_broker'].includes(b.role) ? `<select data-team="${b.id}" style="width:150px"><option value="">Unassigned</option>${teams.map(t=>`<option value="${t.id}" ${b.teamId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>` : '—'}</td>
      <td>${b.role === 'partner_broker' ? `<input type="checkbox" data-canpost="${b.id}" ${b.canPost ? 'checked' : ''}>` : (b.role === 'viewer' ? 'No' : 'Yes')}</td>
      <td><span class="pill ${esc(b.status)}">${esc(b.status)}</span></td>
      <td>${b.id !== ME.id ? (b.status === 'active'
        ? `<button class="btn btn-sm btn-danger" data-revoke="${b.id}">Revoke access</button>`
        : `<button class="btn btn-sm" data-restore="${b.id}">Restore</button>`) : ''}</td>
    </tr>`).join('')}</table>`;
    const patch = async (id, body) => { try { await api('/admin/brokers/' + id, { method: 'PATCH', body }); loadBrokers(); } catch (e) { toast(e.message); loadBrokers(); } };
    document.querySelectorAll('[data-role]').forEach(s => s.addEventListener('change', () => patch(s.dataset.role, { role: s.value })));
    document.querySelectorAll('[data-job-role]').forEach(s => s.addEventListener('change', () => patch(s.dataset.jobRole, { jobRole: s.value })));
    document.querySelectorAll('[data-team]').forEach(s => s.addEventListener('change', () => patch(s.dataset.team, { teamId: s.value || null })));
    document.querySelectorAll('[data-canpost]').forEach(c => c.addEventListener('change', () => patch(c.dataset.canpost, { canPost: c.checked })));
    document.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', () => {
      if (confirm('Revoke access? The broker is signed out immediately.')) patch(b.dataset.revoke, { status: 'revoked' });
    }));
    document.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => patch(b.dataset.restore, { status: 'active' })));
  } catch (err) { $('#broker-table').textContent = err.message; }
}

async function loadAudit() {
  try {
    const p = $('#al-type').value ? '?entityType=' + $('#al-type').value : '';
    const { entries } = await api('/admin/audit-log' + p);
    $('#audit-table').innerHTML = `<table><tr><th>When</th><th>Entity</th><th>Action</th><th>By</th><th>Details</th></tr>
    ${entries.map(e => `<tr>
      <td style="white-space:nowrap">${fmtDate(e.timestamp)}</td>
      <td>${esc(e.entityType)} <span class="mono" style="color:var(--muted)">${esc(e.entityId.slice(0, 8))}</span></td>
      <td>${esc(e.action)}</td><td>${esc(e.performedByName)}</td>
      <td>${e.details ? `<details class="json-details"><summary>view</summary><pre class="mono" style="white-space:pre-wrap;font-size:11px;color:var(--muted)">${esc(JSON.stringify(JSON.parse(e.details), null, 1))}</pre></details>` : '—'}</td>
    </tr>`).join('')}</table>`;
  } catch (err) { $('#audit-table').textContent = err.message; }
}

/* ============ BOOT ============ */
(async function boot() {
  try { ME = await api('/me'); return renderShell(); } catch {}
  try {
    const setup = await api('/auth/setup-status');
    if (setup.needsSetup) return renderSetup(setup.setupEnabled);
  } catch {}
  renderLogin();
})();
