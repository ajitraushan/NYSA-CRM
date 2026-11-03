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

export function resolveScopedBackupPath(value,{preparationRoot='/home/nysareal/crm-release-preparation',appRoot}={}){
  if(typeof value!=='string'||!path.posix.isAbsolute(value))throw Error('Backup path must be absolute');
  const resolved=path.posix.resolve(value),boundary=path.posix.resolve(preparationRoot),application=path.posix.resolve(appRoot||'/home/nysareal/nysa-core-dashboard-dd6262a-stage');
  if(!resolved.startsWith(`${boundary}/`)||resolved===application||resolved.startsWith(`${application}/`))throw Error('Scoped backup path is outside the CRM Test preparation boundary');
  return resolved;
}
