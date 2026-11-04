import pg from 'pg';
import {runTriggerDriftDataChecks,triggerDriftChecks} from '../src/trigger-drift-data-checks.js';

const {Pool}=pg;
export {runTriggerDriftDataChecks,triggerDriftChecks};

if(process.argv[1]&&new URL(import.meta.url).pathname.replace(/^\/(.:)/,'$1')===process.argv[1].replaceAll('\\','/')){
  const pool=new Pool();
  try{console.log(JSON.stringify({checkedAt:new Date().toISOString(),results:await runTriggerDriftDataChecks(pool)},null,2));}
  finally{await pool.end();}
}
