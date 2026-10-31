import {reconcileWebIntake} from './web-intake-workflow.js';

export function startWebIntakeWorker({transaction,env=process.env,logger=console}={}){
  if(env.WEB_INTAKE_WORKER_ENABLED!=='true')return ()=>{};
  const actorId=env.WEB_INTAKE_ACTOR_ID||env.WEBSITE_INTAKE_ACTOR_ID;
  if(!actorId){
    logger.error('WEB intake worker was requested but no system actor is configured');
    return ()=>{};
  }
  const seconds=Math.max(15,Math.min(Number(env.WEB_INTAKE_WORKER_INTERVAL_SECONDS)||60,900));
  let busy=false;
  const tick=async()=>{
    if(busy)return;
    busy=true;
    try{await transaction(client=>reconcileWebIntake({actorId,limit:100},client));}
    catch(error){logger.error('WEB intake reconciliation failed',{name:error?.name||'Error',code:error?.code||null});}
    finally{busy=false;}
  };
  const timer=setInterval(tick,seconds*1000);timer.unref();void tick();
  return ()=>clearInterval(timer);
}
