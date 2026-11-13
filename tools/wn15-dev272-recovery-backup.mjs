import fs from 'node:fs';
import path from 'node:path';
import {backupDir,command,context,quota,requireCondition,verifyRange,verifyTeams,workspace} from './wn15-dev272-common.mjs';

process.umask(0o077);
const {db,query}=await context();
verifyTeams(query,0);
verifyRange(db);
console.log(JSON.stringify({quotaBefore:quota()}));
for(const tool of ['pg_dump','pg_restore','psql']){
  requireCondition(/\(PostgreSQL\) 13\.23(?:\s|$)/.test(command(tool,['--version'])),tool+' must be PostgreSQL 13.23');
}
requireCondition(fs.realpathSync(workspace)===workspace,'Unexpected WN-15 workspace');
const parent=path.dirname(backupDir);
if(!fs.existsSync(parent))fs.mkdirSync(parent);
requireCondition(fs.realpathSync(parent)===parent,'Unexpected recovery parent');
fs.mkdirSync(backupDir);
const dump=backupDir+'/crm-test.dump',listing=backupDir+'/crm-test.list';
command('pg_dump',['-w','-Fc','--file',dump],db,600000);
console.log(JSON.stringify({quotaAfterDump:quota()}));
const toc=command('pg_restore',['--list',dump],db,60000);
requireCondition(toc.split('\n').filter(row=>/^\d+; \d+ \d+ TABLE public /.test(row)).length===313,'Dump public table count mismatch');
requireCondition(toc.split('\n').filter(row=>/^\d+; \d+ \d+ TRIGGER public /.test(row)).length>=113,'Dump public trigger count is below the enabled baseline');
command('pg_restore',['--file','/dev/null',dump],db,600000);
fs.writeFileSync(listing,toc,{flag:'wx'});
const bytes=fs.statSync(dump).size;
requireCondition(bytes>0,'Empty database dump');
const sha256=command('sha256sum',['--',dump],process.env,120000).split(' ')[0];
const record={database:db.PGDATABASE,commit:'54421912fc1496a1066814cd8b665c19c7e8fd45',time:Date.now(),dump,listing,bytes,sha256,
  listingSha256:command('sha256sum',['--',listing]).split(' ')[0],quotaAfter:quota()};
fs.writeFileSync(backupDir+'/verified.json',JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(record));
process.stdout.write(toc);
