import crypto from 'node:crypto';
import path from 'node:path';

function canonical(names){
  return `${names.join('\n')}\n`;
}

export function verifyScopedBackupTableNames(liveTableNames,dumpTableNames){
  if(!Array.isArray(liveTableNames)||!Array.isArray(dumpTableNames))throw Error('Live and dump table names must be arrays');
  const live=[...liveTableNames].sort(),dump=[...dumpTableNames].sort();
  if(live.some((name,index)=>!/^[a-z0-9_]+$/.test(name)||(index>0&&live[index-1]===name)))throw Error('Live table-name evidence is invalid');
  if(dump.some((name,index)=>!/^[a-z0-9_]+$/.test(name)||(index>0&&dump[index-1]===name)))throw Error('Dump table-name evidence is invalid');
  const liveCanonical=canonical(live),dumpCanonical=canonical(dump);
  const extra=dump.filter(name=>!live.includes(name)),missing=live.filter(name=>!dump.includes(name));
  return {
    matches:live.length===dump.length&&extra.length===0&&missing.length===0&&liveCanonical===dumpCanonical,
    liveCount:live.length,
    dumpCount:dump.length,
    liveNamesSha256:crypto.createHash('sha256').update(liveCanonical).digest('hex'),
    dumpNamesSha256:crypto.createHash('sha256').update(dumpCanonical).digest('hex'),
    extra,
    missing
  };
}

export function parsePgRestoreListContracts(value){
  if(typeof value!=='string')throw Error('pg_restore list output must be text');
  const tables=new Set(),triggers=new Set();
  for(const line of value.split(/\r?\n/)){
    const tableMatch=line.match(/;\s+\d+\s+\d+\s+TABLE\s+public\s+(\S+)\s+/);
    if(tableMatch)tables.add(tableMatch[1]);
    const triggerMatch=line.match(/;\s+\d+\s+\d+\s+TRIGGER\s+public\s+(\S+)\s+(\S+)\s+/);
    if(triggerMatch)triggers.add(`${triggerMatch[1]}\0${triggerMatch[2]}`);
  }
  return {tableNames:[...tables].sort(),triggerKeys:[...triggers].sort()};
}

export function resolveScopedBackupPath(value,{preparationRoot='/home/nysareal/crm-release-preparation',appRoot}={}){
  if(typeof value!=='string'||!path.posix.isAbsolute(value))throw Error('Backup path must be absolute');
  const resolved=path.posix.resolve(value),boundary=path.posix.resolve(preparationRoot),application=path.posix.resolve(appRoot||'/home/nysareal/nysa-core-dashboard-dd6262a-stage');
  if(!resolved.startsWith(`${boundary}/`)||resolved===application||resolved.startsWith(`${application}/`))throw Error('Scoped backup path is outside the CRM Test preparation boundary');
  return resolved;
}
