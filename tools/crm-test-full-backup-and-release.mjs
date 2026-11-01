import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

function argumentsOf(values){
  const result={};
  for(let index=0;index<values.length;index+=2){
    const key=values[index],value=values[index+1];
    if(!key?.startsWith('--')||value===undefined)throw Error('Named backup/deploy arguments are required');
    result[key.slice(2)]=value;
  }
  return result;
}
function findBackupRecords(value,records=[]){
  if(Array.isArray(value)){for(const item of value)findBackupRecords(item,records);return records;}
  if(!value||typeof value!=='object')return records;
  const file=typeof value.file==='string'?value.file:typeof value.filename==='string'?value.filename:null;
  const status=typeof value.status==='string'?value.status:null;
  if(file&&status)records.push({file,status,time:Number(value.time||0)});
  for(const item of Object.values(value))findBackupRecords(item,records);
  return records;
}

const args=argumentsOf(process.argv.slice(2));
const required=['operator','config','approved','backup-directory','backup-timeout-minutes','operator-timeout-minutes','cpanel-user'];
for(const key of required)if(!args[key])throw Error(`Missing backup/deploy argument: ${key}`);
if(process.platform!=='linux')throw Error('Hosted Linux backup/deploy wrapper required');
if(args['cpanel-user']!=='nysareal'||path.resolve(args['backup-directory'])!=='/home/nysareal')throw Error('cPanel account boundary mismatch');
if(!/^[a-f0-9]{40}$/.test(args.approved))throw Error('Full approved Git commit is required');

const uapi='/usr/local/cpanel/bin/uapi';
const startedAt=Date.now();
const backupDeadline=startedAt+Number(args['backup-timeout-minutes'])*60_000;
const run=(command,values,timeout)=>execFileSync(command,values,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout,killSignal:'SIGTERM',maxBuffer:16*1024*1024});
const list=()=>{
  const response=JSON.parse(run(uapi,[`--user=${args['cpanel-user']}`,'--output=json','Backup','list_backups'],120_000));
  if(response?.result?.status!==1)throw Error('cPanel backup inventory failed');
  return findBackupRecords(response);
};
const before=new Set(list().map(item=>item.file));
const launch=JSON.parse(run(uapi,[`--user=${args['cpanel-user']}`,'--output=json','Backup','fullbackup_to_homedir','homedir=include'],120_000));
if(launch?.result?.status!==1)throw Error('cPanel full backup did not start');

let backupRecord=null;
while(Date.now()<backupDeadline){
  await new Promise(resolve=>setTimeout(resolve,15_000));
  const candidates=list().filter(item=>!before.has(item.file)&&/^backup-[^/]+_nysareal\.tar\.gz$/.test(item.file));
  const failed=candidates.find(item=>/fail|error/i.test(item.status));
  if(failed)throw Error('cPanel full backup failed');
  backupRecord=candidates.find(item=>/^complete$/i.test(item.status))||null;
  if(backupRecord)break;
}
if(!backupRecord)throw Error('cPanel full backup time limit exceeded');
const backupPath=path.join(path.resolve(args['backup-directory']),path.basename(backupRecord.file));
if(!fs.statSync(backupPath).isFile())throw Error('Completed cPanel backup file is unavailable');

const operatorOutput=run(process.execPath,[path.resolve(args.operator),'--config',path.resolve(args.config),'--backup-path',backupPath,'--approved',args.approved],Number(args['operator-timeout-minutes'])*60_000);
process.stdout.write(`${JSON.stringify({backupPath,backupStatus:backupRecord.status,backupCompletedAt:new Date().toISOString()})}\n${operatorOutput}`);

export{argumentsOf,findBackupRecords};
