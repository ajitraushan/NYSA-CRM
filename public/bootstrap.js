(async()=>{
  const response=await fetch('/api/health?asset-manifest='+Date.now(),{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw new Error('Application version could not be confirmed');
  const health=await response.json(),build=health.version;
  if(!build)throw new Error('Application version is missing');
  window.NYSA_ASSET_BUILD=build;
  const financeCss=document.createElement('link');financeCss.rel='stylesheet';financeCss.href=`/finance-workspace.css?v=${encodeURIComponent(build)}`;document.head.appendChild(financeCss);
  const loadScript=file=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/${file}?v=${encodeURIComponent(build)}`;if(['localhost','127.0.0.1'].includes(location.hostname))script.src+='&localBust='+Date.now();script.onload=resolve;script.onerror=()=>reject(new Error(`${file} could not be loaded for ${build}`));document.body.appendChild(script);});
  // Feature modules must exist before app.js restores the last workspace. Loading
  // app.js early made Administration sections appear/disappear across refreshes.
  // The independent feature modules can load in parallel; only app.js is gated.
  const featureFiles=['finance-workspace-ui.js','shared-review-panel.js','accountant-workspace-ui.js','purchased-data-import-ui.js','offer-ui.js','deal-ui.js','inventory-workspace-ui.js','dashboard-ui.js','official-document-ui.js','market-intelligence-ui.js','commission-payout-ui.js','receivables-ui.js','opportunity-finance-ui.js','agent-leave-ui.js','document-compliance-ui.js','marketing-material-compliance-ui.js','matching-completion-ui.js','email-calendly-ui.js'];
  const [moneyInput]=await Promise.all([import(`/money-input.js?v=${encodeURIComponent(build)}`),...featureFiles.map(loadScript)]);
  window.parseReceiptAmount=moneyInput.parseReceiptAmount;
  await loadScript('app.js');
})().catch(error=>{document.body.innerHTML=`<main class="auth"><section class="auth-card"><h1>NYSA CORE update required</h1><p>${String(error.message||error)}</p><button class="btn btn-primary" onclick="location.reload()">Retry safely</button></section></main>`;});
