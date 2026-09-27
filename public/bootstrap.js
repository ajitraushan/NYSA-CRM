(async()=>{
  const response=await fetch('/api/health?asset-manifest='+Date.now(),{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw new Error('Application version could not be confirmed');
  const health=await response.json(),build=health.version;
  if(!build)throw new Error('Application version is missing');
  window.NYSA_ASSET_BUILD=build;
  const moneyInput=await import(`/money-input.js?v=${encodeURIComponent(build)}`);
  window.parseReceiptAmount=moneyInput.parseReceiptAmount;
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/accountant-workspace-ui.js?v=${encodeURIComponent(build)}`;script.onload=resolve;script.onerror=()=>reject(new Error('Accountant workspace could not be loaded'));document.body.appendChild(script);});
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/purchased-data-import-ui.js?v=${encodeURIComponent(build)}`;script.onload=resolve;script.onerror=()=>reject(new Error(`purchased-data-import-ui.js could not be loaded for ${build}`));document.body.appendChild(script);});
  // Feature modules must exist before app.js restores the last workspace. Loading
  // app.js early made Administration sections appear/disappear across refreshes.
  for(const file of ['offer-ui.js','deal-ui.js','inventory-workspace-ui.js','dashboard-ui.js','official-document-ui.js','market-intelligence-ui.js','commission-payout-ui.js','receivables-ui.js','opportunity-finance-ui.js','agent-leave-ui.js','document-compliance-ui.js','marketing-material-compliance-ui.js','matching-completion-ui.js','email-calendly-ui.js','app.js']){
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/${file}?v=${encodeURIComponent(build)}`;script.onload=resolve;script.onerror=()=>reject(new Error(`${file} could not be loaded for ${build}`));document.body.appendChild(script);});
  }
})().catch(error=>{document.body.innerHTML=`<main class="auth"><section class="auth-card"><h1>NYSA CORE update required</h1><p>${String(error.message||error)}</p><button class="btn btn-primary" onclick="location.reload()">Retry safely</button></section></main>`;});
