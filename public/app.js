/* Nysa Pocket Ledger — frontend SPA (vanilla JS, no build step) */
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

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    ...opts,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && ME) { logout(false); throw new Error('Session expired — please sign in again'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
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
    <h1>Nysa Realty</h1>
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
    <h1>Nysa Realty</h1>
    <div class="sub">POCKET LEDGER — PRIVATE BROKER ACCESS</div>
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
    <div class="brand"><h1>Nysa Realty</h1><span>POCKET LEDGER</span></div>
    <div class="userbox">
      <span>${esc(ME.name)} · ${esc(ME.brokerage || '')}</span>
      <span class="role">${esc(ROLES[ME.role])}</span>
      <button class="btn btn-sm" id="logout-btn">Sign out</button>
    </div>
  </header>
  <nav class="tabs">
    <button data-tab="dashboard" class="active">Dashboard</button>
    <button data-tab="listings">Inventory</button>
    ${ME.role === 'admin' ? '<button data-tab="admin">Administration</button>' : ''}
  </nav>
  <main id="view"></main>`;
  $('#logout-btn').addEventListener('click', () => logout());
  document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentTab = b.dataset.tab;
     currentTab === 'admin' ? renderAdmin() : currentTab === 'dashboard' ? renderDashboard() : renderListings();
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
        ${canPost() ? '<button class="btn btn-primary btn-sm" id="dash-add">+ Add listing</button>' : ''}
        <button class="btn btn-sm" id="dash-inventory">Open inventory</button>
      </div>
    </section>
    <section id="dash-stats" class="stat-grid"><div class="loading-state">Loading workspace…</div></section>
    <section class="dashboard-grid">
      <div class="dashboard-panel"><div class="panel-head"><div><div class="eyebrow">INVENTORY PULSE</div><h3>Recent opportunities</h3></div><button class="text-btn" id="dash-see-all">View all</button></div><div id="dash-recent" class="recent-list"><div class="loading-state">Loading inventory…</div></div></div>
      <div class="dashboard-panel"><div class="panel-head"><div><div class="eyebrow">WORKSPACE</div><h3>Next actions</h3></div></div><div class="action-list"><button class="action-row" id="dash-action-inventory"><span class="action-icon">↗</span><span><b>Review inventory</b><small>Search and update available properties</small></span></button><button class="action-row" id="dash-action-comments"><span class="action-icon">◎</span><span><b>Check broker conversations</b><small>See the latest listing comments</small></span></button><div class="module-note"><b>CRM pipeline is next</b><span>Leads, viewings, and deals will appear here as those modules are added.</span></div></div></div>
    </section>`;
  $('#dash-inventory').addEventListener('click', () => switchTab('listings'));
  $('#dash-see-all').addEventListener('click', () => switchTab('listings'));
  $('#dash-action-inventory').addEventListener('click', () => switchTab('listings'));
  $('#dash-action-comments').addEventListener('click', () => switchTab('listings'));
  $('#dash-add')?.addEventListener('click', () => openListingForm());
  try {
    const { listings } = await api('/listings?sort=newest');
    const counts = listings.reduce((a, l) => { a.total++; a[l.status] = (a[l.status] || 0) + 1; return a; }, { total: 0 });
    $('#dash-stats').innerHTML = [['Total inventory', counts.total, 'All active records'], ['Available', counts.Available || 0, 'Open opportunities'], ['Under offer', counts['Under offer'] || 0, 'Needs attention'], ['Reserved', counts.Reserved || 0, 'In progress']].map(([label, value, note]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
    $('#dash-recent').innerHTML = listings.slice(0, 5).map(l => `<button class="recent-row" data-id="${esc(l.id)}"><span class="recent-status status-${esc(l.status.replace(' ', '.'))}"></span><span class="recent-main"><b>${esc(l.project)}</b><small>${esc(l.area)} · ${esc(l.propertyType)} · ${fmtPrice(l.price, l.currency)}</small></span><span class="recent-tag">${esc(l.status)}</span></button>`).join('') || '<div class="empty">No inventory yet.</div>';
    $('#dash-recent').querySelectorAll('.recent-row').forEach(row => row.addEventListener('click', () => openDetail(row.dataset.id)));
  } catch (err) { $('#dash-stats').textContent = err.message; $('#dash-recent').textContent = err.message; }
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('nav.tabs button').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  tab === 'admin' ? renderAdmin() : tab === 'dashboard' ? renderDashboard() : renderListings();
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
  <div class="admin-section">
    <h2>Invitations</h2>
    <div class="admin-toolbar">
      <div><label>Scope to email (optional)</label><input id="inv-email" type="email" placeholder="broker@partner.ae" style="width:220px"></div>
      <div><label>Role</label><select id="inv-role" style="width:170px">
        <option value="internal_broker">Internal Broker</option><option value="partner_broker">Partner Broker</option>
        <option value="viewer">Viewer</option><option value="admin">Admin</option></select></div>
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
        <option>Listing</option><option>Comment</option><option>Broker</option><option>Invitation</option></select></div>
      <button class="btn btn-sm" id="al-refresh" style="height:33px">Refresh</button>
    </div>
    <div id="audit-table">Loading…</div>
  </div>`;
  $('#inv-create').addEventListener('click', createInvite);
  $('#al-refresh').addEventListener('click', loadAudit);
  $('#al-type').addEventListener('change', loadAudit);
  loadInvites(); loadBrokers(); loadAudit();
}

async function createInvite() {
  try {
    const inv = await api('/admin/invitations', { method: 'POST', body: {
      issuedToEmail: $('#inv-email').value.trim() || null,
      role: $('#inv-role').value,
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
    $('#inv-table').innerHTML = `<table><tr><th>Code</th><th>Role</th><th>Scoped to</th><th>Uses</th><th>Expires</th><th>Status</th><th></th></tr>
    ${invitations.map(i => `<tr>
      <td class="mono">${esc(i.code)}</td><td>${esc(ROLES[i.role])}</td><td>${esc(i.issuedToEmail || 'Anyone')}</td>
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
    const { brokers } = await api('/admin/brokers');
    $('#broker-table').innerHTML = `<table><tr><th>Name</th><th>Email</th><th>Brokerage</th><th>Role</th><th>Can post</th><th>Status</th><th></th></tr>
    ${brokers.map(b => `<tr>
      <td>${esc(b.name)}</td><td>${esc(b.email)}</td><td>${esc(b.brokerage || '—')}</td>
      <td><select data-role="${b.id}" style="width:150px" ${b.id === ME.id ? 'disabled' : ''}>
        ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${b.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td>${b.role === 'partner_broker' ? `<input type="checkbox" data-canpost="${b.id}" ${b.canPost ? 'checked' : ''}>` : (b.role === 'viewer' ? 'No' : 'Yes')}</td>
      <td><span class="pill ${esc(b.status)}">${esc(b.status)}</span></td>
      <td>${b.id !== ME.id ? (b.status === 'active'
        ? `<button class="btn btn-sm btn-danger" data-revoke="${b.id}">Revoke access</button>`
        : `<button class="btn btn-sm" data-restore="${b.id}">Restore</button>`) : ''}</td>
    </tr>`).join('')}</table>`;
    const patch = async (id, body) => { try { await api('/admin/brokers/' + id, { method: 'PATCH', body }); loadBrokers(); } catch (e) { toast(e.message); loadBrokers(); } };
    document.querySelectorAll('[data-role]').forEach(s => s.addEventListener('change', () => patch(s.dataset.role, { role: s.value })));
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
