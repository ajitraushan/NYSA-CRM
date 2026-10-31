// Read-only hosting backup/export. No application, database or registration writes.
// Ciphertext alone may be downloaded to the explicitly approved recovery folder.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pipeline} from 'node:stream/promises';
process.umask(0o077);
if(process.platform!=='linux')throw Error('Hosting only');
const target=process.argv[2];
const targets={production:{root:'/home/nysareal/nysa-crm',domain:'crm.nysarealty.com',db:'nysareal_nysacrm',user:'nysareal_nysacrmapp',version:'2.1.0-rc.1',migrations:140},test:{root:'/home/nysareal/nysa-core-dashboard-dd6262a-stage',domain:'crm-test.nysarealty.com',db:'nysareal_nysa_dev247_smoke',user:'nysareal_nysar2app',version:'2.1.0-dev.248',migrations:159}};
const t=targets[target];if(!t)throw Error('Explicit production or test target required');
const base='/home/nysareal/crm-release-preparation/20261031-ui001';fs.mkdirSync(base,{recursive:true,mode:0o700});
const out=base+'/'+target+'-'+new Date().toISOString().replace(/[-:.]/g,'');fs.mkdirSync(out,{mode:0o700});
const run=(cmd,args,env=process.env)=>execFileSync(cmd,args,{env,stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024});
const hash=async file=>{const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');};
function registration(){const json=JSON.parse(run('cloudlinux-selector',['get','--json','--interpreter','nodejs','--domain',t.domain])),found=[];function find(v){if(!v||typeof v!=='object')return;for(const[k,a]of Object.entries(v)){if(k===t.root||k===path.basename(t.root))found.push(a);else if(k!=='env_vars')find(a);}}find(json);if(found.length!==1||found[0].domain!==t.domain)throw Error('Registration identity mismatch');return found[0];}
let pool;
try{
 const cfg=registration(),env=cfg.env_vars||{};
 if(env.PGDATABASE!==t.db||env.PGUSER!==t.user||JSON.parse(fs.readFileSync(t.root+'/package.json')).version!==t.version)throw Error('Baseline identity mismatch');
 const dependencies=fs.realpathSync(t.root+'/node_modules');
 if(dependencies!==`/home/nysareal/nodevenv/${path.basename(t.root)}/24/lib/node_modules`)throw Error('Dependency root mismatch');
 const storage=path.resolve(env.PRIVATE_STORAGE_DIR||t.root+'/storage/private');
 if(!storage.startsWith('/home/nysareal/')||storage.includes('/../')||!fs.existsSync(storage))throw Error('Private storage path rejected');
 const {Pool}=createRequire(t.root+'/package.json')('pg');pool=new Pool({host:env.PGHOST||'localhost',port:Number(env.PGPORT||5432),database:t.db,user:t.user,password:env.PGPASSWORD,max:1});
 const client=await pool.connect();let baseline;
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  baseline=(await client.query('SELECT current_database() AS db,current_user AS role,COUNT(*)::int AS migrations,MAX(version) AS latest FROM schema_migrations')).rows[0];
  if(baseline.db!==t.db||baseline.role!==t.user||baseline.migrations!==t.migrations)throw Error('Database baseline mismatch');
  const snapshot=(await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
  const pgEnv={...process.env,PGHOST:env.PGHOST||'localhost',PGPORT:String(env.PGPORT||5432),PGDATABASE:t.db,PGUSER:t.user,PGPASSWORD:env.PGPASSWORD};
  run('pg_dump',['--format=custom','--snapshot',snapshot,'--file',out+'/database.dump'],pgEnv);
  fs.writeFileSync(out+'/restore-list.txt',run('pg_restore',['--list',out+'/database.dump']));
  const ownership=(await client.query("SELECT relname,relkind,pg_get_userbyid(relowner) AS owner,relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind IN ('r','v','m','S') ORDER BY relname,relkind")).rows;
  fs.writeFileSync(out+'/database-ownership.json',JSON.stringify(ownership));
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 const manifestBefore=await hash(t.root+'/RUNTIME_MANIFEST.sha256');
 fs.writeFileSync(out+'/registered-config.json',JSON.stringify(cfg));
 run('tar',['-czf',out+'/application.tar.gz','--exclude=./node_modules','--exclude=./.git','--exclude=./tmp','--exclude=./storage','--exclude=./logs','-C',t.root,'.']);
 run('tar',['-czf',out+'/dependencies.tar.gz','-C',dependencies,'.']);
 run('tar',['-czf',out+'/private-storage.tar.gz','-C',storage,'.']);
 for(const file of ['application.tar.gz','dependencies.tar.gz','private-storage.tar.gz'])run('tar',['-tzf',out+'/'+file]);
 if(manifestBefore!==await hash(t.root+'/RUNTIME_MANIFEST.sha256')||JSON.stringify(cfg)!==JSON.stringify(registration()))throw Error('Application/configuration drift during backup');
 const files=['database.dump','restore-list.txt','database-ownership.json','registered-config.json','application.tar.gz','dependencies.tar.gz','private-storage.tar.gz'];
 const components=[];for(const name of files)components.push({name,bytes:fs.statSync(out+'/'+name).size,sha256:await hash(out+'/'+name)});
 const receipt={schema:'nysa.preparation-recovery.v2',createdAt:new Date().toISOString(),target,version:t.version,migrations:t.migrations,root:t.root,domain:t.domain,baseline,dependencies,storage,components,runtimeManifestSha256:manifestBefore,databaseSnapshotConsistent:true,ownersAndGrantsIncluded:true,quiesced:false,freshMaintenanceWindowBackupRequired:true,applicationDatabaseConfigurationMutation:false};
 fs.writeFileSync(out+'/BACKUP_RECEIPT.json',JSON.stringify(receipt,null,2));
 run('tar',['-czf',out+'/recovery.tar.gz','-C',out,...files,'BACKUP_RECEIPT.json']);
 const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const aad=JSON.stringify({schema:'nysa.encrypted-recovery.v2',target,version:t.version,migrations:t.migrations,components});cipher.setAAD(Buffer.from(aad));
 await pipeline(fs.createReadStream(out+'/recovery.tar.gz'),cipher,fs.createWriteStream(out+'/recovery.encrypted.bin',{mode:0o600}));
 const wrappedKey=crypto.publicEncrypt({key:fs.readFileSync('/home/nysareal/recovery-public.pem'),padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64');key.fill(0);
 const header={schema:'nysa.encrypted-recovery.v2',cipher:'AES-256-GCM',keyWrap:'RSA-OAEP-SHA256',aad,wrappedKey,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertextBytes:fs.statSync(out+'/recovery.encrypted.bin').size,ciphertextSha256:await hash(out+'/recovery.encrypted.bin'),plaintextArchiveSha256:await hash(out+'/recovery.tar.gz')};
 fs.writeFileSync(out+'/recovery.encrypted.header.json',JSON.stringify(header,null,2));
 const safe={result:'PREPARATION_BACKUP_ENCRYPTED',directory:out,target,version:t.version,migrations:t.migrations,ciphertextSha256:header.ciphertextSha256,headerSha256:await hash(out+'/recovery.encrypted.header.json'),ciphertextBytes:header.ciphertextBytes,componentCount:components.length,quiesced:false,freshMaintenanceWindowBackupRequired:true,productionMutation:false};
 fs.writeFileSync(base+'/'+target+'-LATEST.json',JSON.stringify(safe,null,2));console.log(JSON.stringify(safe));
}catch(error){fs.writeFileSync(out+'/PRIVATE_DIAGNOSTIC.txt',error.stack||String(error));console.error('Private recovery preparation failed; diagnostic retained on hosting');process.exitCode=1;}
finally{if(pool)await pool.end();}
