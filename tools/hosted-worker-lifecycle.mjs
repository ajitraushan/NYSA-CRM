import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
export const hostedApps=Object.freeze({
 '/home/nysareal/nysa-crm':'https://crm.nysarealty.com',
 '/home/nysareal/nysa-core-dashboard-dd6262a-stage':'https://crm-test.nysarealty.com',
 '/home/nysareal/nysa-r2-prod-clone':'https://crm-r2-clone.nysarealty.com'
});
export function assertHostedRoot(root){if(!Object.hasOwn(hostedApps,root))throw Error('Application root is not an approved exact root');return root;}
export function verifiedWorker(root,pid,{readFile=file=>fs.readFileSync(file,'utf8'),realpath=file=>fs.realpathSync(file)}={}){
 assertHostedRoot(root);if(!Number.isInteger(Number(pid))||Number(pid)<=1)throw Error('Invalid worker PID');
 try{const command=readFile(`/proc/${pid}/cmdline`).split('\0').filter(Boolean).join(' ').trim(),cwd=realpath(`/proc/${pid}/cwd`);return command===`lsnode:${root}/`&&cwd===root?{pid:Number(pid),command,cwd}:null;}catch(error){if(error.code==='ENOENT'||error.code==='ESRCH')return null;throw error;}
}
export function inspectWorkers(root,{ps=()=>execFileSync('ps',['-u','nysareal','-o','pid=,args='],{encoding:'utf8'}),verify=pid=>verifiedWorker(root,pid)}={}){
 assertHostedRoot(root);const marker=`lsnode:${root}/`,workers=[];
 for(const line of ps().split('\n')){const match=line.match(/^\s*(\d+)\s+(.+?)\s*$/);if(!match||match[2]!==marker)continue;const worker=verify(Number(match[1]));if(!worker)throw Error('Worker marker and working directory disagree');workers.push(worker);}
 return workers;
}
export async function verifyReadinessWorker({root,expectedVersion,request=url=>fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)}),inspect=()=>inspectWorkers(root)}){
 assertHostedRoot(root);if(!/^2\.1\.0-(?:dev|rc)\.\d+$/.test(expectedVersion))throw Error('An exact version is required');
 const response=await request(hostedApps[root]+'/api/readiness'),readiness=await response.json();
 if(response.status!==200||readiness.ok!==true||readiness.database!=='ready'||readiness.version!==expectedVersion)throw Error('Expected application/database readiness was not established');
 const workers=inspect();if(workers.length!==1)throw Error('Exactly one verified worker is required after readiness');
 return {root,version:readiness.version,database:readiness.database,workerCount:1,workers};
}
// For the separately approved deployment operator, after CloudLinux reports this exact app stopped.
// There is deliberately no mutating CLI mode. Every signal rechecks cmdline AND cwd.
export async function stopVerifiedWorkers(root,{assertStopped,inspect=()=>inspectWorkers(root),verify=pid=>verifiedWorker(root,pid),signal=(pid,name)=>process.kill(pid,name),wait=()=>new Promise(resolve=>setTimeout(resolve,100))}={}){
 assertHostedRoot(root);if(typeof assertStopped!=='function'||await assertStopped(root)!==true)throw Error('Registered application must be stopped before worker reconciliation');
 const original=inspect();
 for(const worker of original){if(await assertStopped(root)!==true)throw Error('Application registration changed');if(verify(worker.pid))signal(worker.pid,'SIGTERM');}
 for(let attempt=0;attempt<30;attempt++){if(!inspect().length)return {stopped:original.length};await wait();}
 for(const worker of inspect()){if(await assertStopped(root)!==true)throw Error('Application registration changed');if(verify(worker.pid))signal(worker.pid,'SIGKILL');}
 for(let attempt=0;attempt<20;attempt++){if(!inspect().length)return {stopped:original.length};await wait();}
 throw Error('Verified application workers remain; do not replace data or start the candidate');
}
async function main(){if(process.platform!=='linux')throw Error('Hosting Linux is required');const args=process.argv.slice(2),get=key=>args[args.indexOf(key)+1],root=get('--root');assertHostedRoot(root);if(args.includes('--verify'))console.log(JSON.stringify(await verifyReadinessWorker({root,expectedVersion:get('--expected-version')})));else if(args.includes('--inspect'))console.log(JSON.stringify({root,workers:inspectWorkers(root)}));else throw Error('Only read-only inspect or verify is available');}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
