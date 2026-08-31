(async()=>{
  const response=await fetch('/api/health?asset-manifest='+Date.now(),{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw new Error('Application version could not be confirmed');
  const health=await response.json(),build=health.version;
  if(!build)throw new Error('Application version is missing');
  window.NYSA_ASSET_BUILD=build;
  for(const file of ['offer-ui.js','deal-ui.js','inventory-workspace-ui.js','app.js','dashboard-ui.js']){
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/${file}?v=${encodeURIComponent(build)}`;script.onload=resolve;script.onerror=()=>reject(new Error(`${file} could not be loaded for ${build}`));document.body.appendChild(script);});
  }
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/official-document-ui.js?v=${encodeURIComponent(build)}`;script.onload=resolve;script.onerror=()=>reject(new Error(`official-document-ui.js could not be loaded for ${build}`));document.body.appendChild(script);});
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/market-intelligence-ui.js?v=${encodeURIComponent(build)}`;script.onload=resolve;script.onerror=()=>reject(new Error(`market-intelligence-ui.js could not be loaded for ${build}`));document.body.appendChild(script);});
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/commission-payout-ui.js?v=${encodeURIComponent(build)}`;script.onload=resolve;script.onerror=()=>reject(new Error(`commission-payout-ui.js could not be loaded for ${build}`));document.body.appendChild(script);});
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/agent-leave-ui.js?v=${encodeURIComponent(build)}`;script.onload=resolve;script.onerror=()=>reject(new Error(`agent-leave-ui.js could not be loaded for ${build}`));document.body.appendChild(script);});
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/document-compliance-ui.js?v=${encodeURIComponent(build)}`;script.onload=resolve;script.onerror=()=>reject(new Error(`document-compliance-ui.js could not be loaded for ${build}`));document.body.appendChild(script);});
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/marketing-material-compliance-ui.js?v=${encodeURIComponent(build)}`;script.onload=resolve;script.onerror=()=>reject(new Error(`marketing-material-compliance-ui.js could not be loaded for ${build}`));document.body.appendChild(script);});
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/matching-completion-ui.js?v=${encodeURIComponent(build)}`;script.onload=resolve;script.onerror=()=>reject(new Error(`matching-completion-ui.js could not be loaded for ${build}`));document.body.appendChild(script);});
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`/email-calendly-ui.js?v=${encodeURIComponent(build)}`;script.onload=resolve;script.onerror=()=>reject(new Error(`email-calendly-ui.js could not be loaded for ${build}`));document.body.appendChild(script);});
})().catch(error=>{document.body.innerHTML=`<main class="auth"><section class="auth-card"><h1>NYSA CORE update required</h1><p>${String(error.message||error)}</p><button class="btn btn-primary" onclick="location.reload()">Retry safely</button></section></main>`;});
