const args=Object.fromEntries(process.argv.slice(2).reduce((items,item,index,list)=>{
  if(item.startsWith('--'))items.push([item.slice(2),list[index+1]&&!list[index+1].startsWith('--')?list[index+1]:true]);
  return items;
},[]));
const baseUrl=String(args.url||process.env.NYSA_SIMULATION_BASE_URL||'').replace(/\/$/,''),token=String(process.env.NYSA_SIMULATION_SESSION_TOKEN||'');
if(!baseUrl||token.length<32)throw new Error('Use --url (or NYSA_SIMULATION_BASE_URL) and the private NYSA_SIMULATION_SESSION_TOKEN environment variable');
if(args.confirm!=='DELETE-SIMULATED-ONLY')throw new Error('Cleanup requires --confirm DELETE-SIMULATED-ONLY');
const response=await fetch(`${baseUrl}/api/admin/whatsapp-simulation/cleanup`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(120000)});
const data=await response.json().catch(()=>({}));
if(!response.ok)throw new Error(`Cleanup returned HTTP ${response.status}: ${data.error||'Unknown error'}`);
process.stdout.write(`${JSON.stringify(data.cleanup,null,2)}\n`);
