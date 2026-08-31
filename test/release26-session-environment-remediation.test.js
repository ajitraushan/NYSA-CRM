import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('sign-out and every successful authentication establish a clean client session',()=>{
  const app=read('public/app.js');
  assert.match(app,/function resetClientSessionState\(\)/);
  assert.match(app,/document\.querySelectorAll\('\.overlay,\.toast'\)\.forEach\(element=>element\.remove\(\)\)/);
  for(const marker of [
    'listingAreas=null',
    'lastListings=[]',
    "currentTab='dashboard'",
    "opportunityRegisterFilters={q:'',stage:'',assignedTo:'',sort:'due',page:1}",
    'clearTimeout(workspaceRefreshTimer)',
    'delete window.refreshActiveCrmDashboard'
  ])assert.ok(app.includes(marker),`missing client reset marker: ${marker}`);
  assert.match(app,/async function logout[\s\S]*ME = null;[\s\S]*resetClientSessionState\(\);[\s\S]*sessionReload[\s\S]*window\.location\.replace/);
  assert.equal((app.match(/resetClientSessionState\(\);\s*\n\s*ME = broker/g)||[]).length,3);
});

test('NYSA CORE authentication redesign preserves every governed access path',()=>{
  const app=read('public/app.js'),page=read('public/index.html'),auth=read('src/routes/auth.js');
  for(const marker of ['NYSA CORE','From Vision to Value','Email address','Keep me signed in for 7 days','Forgot password?','Sign in','Redeem it','auth-feature-grid','Secure','AI Powered','Lead Intelligence','Performance','auth-profile-notice','auth-password-toggle','Please wait…','© 2026 Nysa Realty LLC. All Rights Reserved.'])assert.ok(app.includes(marker),`missing authentication UI marker: ${marker}`);
  assert.doesNotMatch(app,/PRIVATE REAL ESTATE OPERATIONS|<h1>NYSA CRM<\/h1>/);
  assert.doesNotMatch(app,/class="auth-product"|Access NYSA CORE/);
  assert.match(app,/class="auth-logo" src="\/brand\/nysa\/vector\/nysa-stacked-dark\.svg\?v=20260815-dev146"/);
  assert.doesNotMatch(app,/class="auth-logo" src="\/brand\/nysa-uae-/);
  assert.match(app,/authGreetingForHour=hour=>hour<12\?'Good Morning':hour<18\?'Good Afternoon':'Good Evening'/);
  assert.match(app,/timeZone:'Asia\/Dubai'/);
  assert.match(app,/login:\{eyebrow:authGreeting\(\),greeting:true,title:'Welcome to NYSA CORE'/);
  assert.match(page,/<title>NYSA CORE<\/title>/);
  assert.match(page,/dubai-skyline-auth-golden-hour-palms\.png/);
  assert.match(page,/@font-face\{font-family:Montserrat;src:url\('\/fonts\/Montserrat-Variable\.woff2/);
  assert.match(page,/backdrop-filter:blur\(24px\) saturate\(128%\)/);
  assert.match(page,/linear-gradient\(105deg,#96631b 0%,#e6b85e 34%,#f4d083 52%,#bd842d 100%\)/);
  assert.match(page,/@media\(max-width:560px\)/);
  assert.match(page,/auth-card input:-webkit-autofill/);
  assert.match(page,/\.auth-feature-grid\{display:grid;grid-template-columns:repeat\(4,1fr\)/);
  assert.doesNotMatch(app,/class="info-msg session-profile-note"/);
  for(const caption of ['Enterprise Grade<br>Security','Smarter Insights<br>Better Decisions','Qualify. Nurture.<br>Convert.','Track. Analyze.<br>Grow.'])assert.ok(app.includes(caption),`missing authentication feature caption: ${caption}`);
  for(const endpoint of ['/auth/login','/auth/redeem-invite','/auth/register','/auth/password-reset-requests','/auth/password-resets/redeem'])assert.ok(app.includes(endpoint),`missing authentication request: ${endpoint}`);
  assert.match(auth,/HttpOnly; SameSite=Strict; Path=\/; Max-Age=/);
});

test('UI-LOGIN-REDESIGN-19 preserves the login contract through the dev.108 cumulative candidate',()=>{
  const page=read('public/index.html')+read('public/bootstrap.js');
  const packageJson=JSON.parse(read('package.json'));
  const skyline=fs.statSync(new URL('../public/brand/dubai-skyline-auth-golden-hour-palms.png',import.meta.url));
  const montserrat=fs.statSync(new URL('../public/fonts/Montserrat-Variable.woff2',import.meta.url));
  assert.equal(packageJson.version,'2.1.0-dev.174');
  for(const asset of ['offer-ui.js','deal-ui.js','app.js','dashboard-ui.js'])assert.match(page,new RegExp(`'${asset.replace('.','\\.')}'`));
  assert.ok(skyline.size>1_000_000,'golden-hour palm skyline asset is unexpectedly small');
  assert.ok(montserrat.size>30_000,'bundled Montserrat font is unexpectedly small');
  assert.match(page,/\.auth-heading h1\{[^}]*font-weight:400/);
  assert.match(page,/\.auth-heading h1\{[^}]*font-size:34px/);
  assert.match(page,/golden-hour-palms/);
});

test('environment badge derives from the current application hostname',()=>{
  const app=read('public/app.js');
  assert.match(app,/function environmentLabel\(hostname=window\.location\.hostname\)/);
  assert.match(app,/host==='crm\.nysarealty\.com'\)return ''/);
  for(const [host,label] of [
    ['crm-test.nysarealty.com','CRM Test'],
    ['crm-r2-clone.nysarealty.com','R2 Clone']
  ])assert.match(app,new RegExp(`host==='${host.replaceAll('.','\\.')}[^\\n]+return '${label}'`));
  assert.match(app,/environmentLabel\(\)\?`<span class="environment-badge"><b>\$\{esc\(environmentLabel\(\)\)\}/);
  assert.doesNotMatch(app,/environment-badge"><b>CRM Test<\/b>/);
});

test('Inventory always reloads governed Areas and Area changes invalidate cached choices',()=>{
  const app=read('public/app.js');
  assert.match(app,/loadListingAreas\(\{force:true\}\)/);
  assert.match(app,/async function loadListingAreas\(\{force=false\}=\{\}\)/);
  assert.ok((app.match(/listingAreas=null/g)||[]).length>=4);
});

test('Inventory owner enrichment does not force a duplicate Customer workflow',()=>{
  const app=read('public/app.js'),routes=read('src/routes/listings.js');
  assert.match(routes,/validateInventoryPartyInput/);
  assert.match(routes,/inventory_counterparties/);
  assert.match(app,/Saving here maintains the party on Internal Inventory; it does not create a Customer or publish an external Listing/);
  assert.doesNotMatch(app,/Select that Customer to retain this Inventory draft without rekeying it/);
});

test('named invitations default to seven days and reject past expiry at both boundaries',()=>{
  const app=read('public/app.js'),routes=read('src/routes/admin.js');
  assert.match(app,/id="inv-exp" type="date" min="\$\{diaryDateKey\(new Date\(\)\)\}"/);
  assert.match(app,/value="\$\{diaryAddDays\(diaryDateKey\(new Date\(\)\),7\)\}" required/);
  assert.match(app,/past Dubai dates are not allowed/);
  assert.match(routes,/validateInvitationExpiry\(expiresAt\)/);
  assert.match(routes,/if\(checkedExpiry\.error\)return res\.status\(400\)/);
  assert.match(routes,/checkedExpiry\.value/);
});
