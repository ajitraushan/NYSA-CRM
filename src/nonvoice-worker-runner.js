// Run once from an approved CRM Test scheduler. No automatic production worker activation.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export async function runConfiguredNonvoiceWorker(){
 if(!['local','crm-test'].includes(process.env.LEAD_RESPONSE_ENVIRONMENT))throw new Error('Nonvoice worker is restricted to local/CRM Test');
 const {transaction,closeDatabase}=await import('./db.js');
 const {runNonvoiceCycle}=await import('./nonvoice-worker.js');
 const {pollLeadEmailInbox}=await import('./cpanel-lead-email.js');
 const {dispatchNonvoiceCycle}=await import('./nonvoice-dispatch-worker.js');
 const {dispatchAiReplies}=await import('./nonvoice-chat-dispatch.js');
 const {leadConnectionEnvironment}=await import('./lead-integration-connections.js');
 try{
  const env={...process.env,...(process.env.LEAD_CONNECTION_KEY?await transaction(c=>leadConnectionEnvironment(c,process.env.LEAD_CONNECTION_KEY)):{})};
  const control=await transaction(async c=>(await c.query('SELECT paused FROM lead_integration_setup WHERE singleton=TRUE')).rows[0]);
  if(control?.paused!==false){env.LEAD_RESPONSE_LIVE_ENABLED='false';env.LEAD_AI_CHAT_ENABLED='false';}
  let email;try{email=await pollLeadEmailInbox({transaction,env});}catch{email={status:'requires_review'};}
  await transaction(c=>c.query("INSERT INTO lead_integration_runtime_health(provider,status,safe_error_code) VALUES('email',$1,$2) ON CONFLICT(provider) DO UPDATE SET status=EXCLUDED.status,safe_error_code=EXCLUDED.safe_error_code,last_checked_at=NOW()",[email.status,email.status==='requires_review'?'EMAIL_POLL_REQUIRES_REVIEW':null]));
  const intake=await runNonvoiceCycle({transaction,env});
  const dispatch=await dispatchNonvoiceCycle({transaction,env});
  const chat=await dispatchAiReplies({transaction,env});
  return {email,intake,dispatch,chat};
 }finally{await closeDatabase();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runConfiguredNonvoiceWorker()
 .then(result=>console.log(JSON.stringify({component:'nonvoice-worker',...result})))
 .catch(()=>{console.error(JSON.stringify({component:'nonvoice-worker',status:'requires_review'}));process.exitCode=1;});
