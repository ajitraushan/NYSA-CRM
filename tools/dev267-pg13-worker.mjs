import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=process.argv[2];
if(root!=='/home/nysareal/nysa-core-dashboard-dd6262a-stage')throw new Error('Unexpected rehearsal application root');
process.chdir(root);
process.title=`lsnode:${root}/`;
if(process.env.NYSA_REHEARSAL_IDLE_WORKER==='true'){
  // Phase A/B must observe the accepted DEV266 baseline worker.  Keep an
  // exact-marker, exact-CWD process alive without starting an ungoverned
  // second HTTP listener; Phase C exercises the normal verified stop and then
  // the selector stub starts the real DEV267 server below.
  setInterval(()=>{},60_000);
  await new Promise(()=>{});
}else{
  await import(pathToFileURL(path.join(root,'src','server.js')));
}
