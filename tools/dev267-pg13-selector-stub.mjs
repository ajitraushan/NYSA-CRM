import fs from 'node:fs';
import {spawn} from 'node:child_process';

const stateFile=process.env.NYSA_REHEARSAL_SELECTOR_STATE;
const workerFile=process.env.NYSA_REHEARSAL_WORKER;
if(!stateFile||!workerFile)throw new Error('Rehearsal selector state and worker are required');
const values=process.argv.slice(2),action=values[0],value=name=>values[values.indexOf(name)+1];
const read=()=>JSON.parse(fs.readFileSync(stateFile,'utf8'));
const write=state=>fs.writeFileSync(stateFile,`${JSON.stringify(state,null,2)}\n`);
if(action==='get'){
  const state=read();
  process.stdout.write(`${JSON.stringify({nodejs:{[state.root.split('/').at(-1)]:state}})}\n`);
}else if(action==='set'){
  const state=read(),environment=JSON.parse(value('--env-vars'));
  write({...state,env_vars:environment});
  process.stdout.write('{}\n');
}else if(action==='stop'){
  write({...read(),app_status:'stopped'});
  process.stdout.write('{}\n');
}else if(action==='start'){
  const state={...read(),app_status:'started'};
  write(state);
  const environment=Object.entries(state.env_vars).flatMap(([name,item])=>[`${name}=${item}`]);
  const log=fs.openSync('/tmp/dev267-rehearsal-worker.log','a');
  const child=spawn('sudo',['-u','nysareal','-H','env',...environment,process.execPath,workerFile,state.root],{detached:true,stdio:['ignore',log,log]});
  child.unref();
  fs.closeSync(log);
  process.stdout.write('{}\n');
}else throw new Error(`Unsupported rehearsal selector action: ${action}`);
