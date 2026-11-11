import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

process.env.PGDATABASE||='dev266_source_only';
process.env.PGUSER||='dev266_source_only';
process.env.PGPASSWORD||='dev266_source_only';
const {
  DEFAULT_WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES,
  parseWhatsAppReplyLockConfig,
  replyLockState
}=await import('../src/whatsapp-reply-lock.js');

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV266 reply-lock timeout is strict, bounded and defaults to 30 minutes',()=>{
  assert.equal(parseWhatsAppReplyLockConfig({}).timeoutMinutes,DEFAULT_WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES);
  assert.deepEqual([5,240].map(value=>parseWhatsAppReplyLockConfig({WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES:String(value)}).timeoutMinutes),[5,240]);
  for(const value of ['',4,241,'abc','10.5','+10','10 minutes']){
    assert.throws(()=>parseWhatsAppReplyLockConfig({WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES:String(value)}),/whole number from 5 to 240/);
  }
});

test('DEV266 invalid timeout fails process startup before database work',()=>{
  for(const value of ['4','241','abc','10.5']){
    const child=spawnSync(process.execPath,['src/server.js'],{
      cwd:new URL('..',import.meta.url),
      encoding:'utf8',
      timeout:30000,
      env:{...process.env,PGDATABASE:'dev266_startup_guard',PGUSER:'dev266_startup_guard',PGPASSWORD:'dev266_startup_guard',WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES:value}
    });
    assert.notEqual(child.status,0,`startup unexpectedly accepted ${value}`);
    assert.match(`${child.stdout}\n${child.stderr}`,/WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES must be a whole number from 5 to 240/);
  }
});

test('DEV266 shared state blocks every non-holder, including management',()=>{
  const conversation={
    replyLockOwnerId:'00000000-0000-4000-8000-000000000001',
    replyLockOwnerName:'Synthetic Holder',
    replyLockAcquiredAt:'2026-11-10T00:00:00.000Z',
    replyLockExpiresAt:'2026-11-10T00:30:00.000Z',
    replyLockDatabaseNow:'2026-11-10T00:05:00.000Z',
    replyLockActive:true
  };
  const holder=replyLockState(conversation,{id:conversation.replyLockOwnerId,jobRole:'sales_agent'});
  const manager=replyLockState(conversation,{id:'00000000-0000-4000-8000-000000000002',jobRole:'manager'});
  assert.equal(holder.canSend,true);
  assert.equal(holder.canRelease,true);
  assert.equal(manager.canSend,false);
  assert.equal(manager.canRelease,true);
});

test('DEV266 release source uses typed UUIDs and all reply sends use the shared gate',()=>{
  const domain=read('src/whatsapp-reply-lock.js');
  const workspace=read('src/routes/whatsapp-workspace.js');
  const simulator=read('src/routes/whatsapp-simulated-provider.js');
  const ui=read('public/whatsapp-workspace-ui.js');
  assert.match(domain,/reply_lock_owner_id=\$1::uuid/);
  assert.match(domain,/CASE WHEN \$1::uuid IS NULL/);
  assert.match(domain,/NOW\(\)<c\.reply_lock_acquired_at\+make_interval\(mins=>\$2::integer\)/);
  assert.doesNotMatch(workspace,/CASE WHEN \$1 IS NULL/);
  assert.match(simulator,/assertReplySendAllowed\(conversation,req\.broker\)/);
  assert.match(simulator,/refreshReplyLockAfterSend\(client,conversation,req\.broker\)/);
  assert.match(ui,/Reply lock held by/);
  assert.match(ui,/item\.replyLock\?\.canRelease/);
  assert.match(workspace,/x-client-time-zone/);
  assert.match(workspace,/your local time/);
  assert.match(read('public/app.js'),/X-Client-Time-Zone/);
  assert.match(workspace,/Conversation not found or outside your inbox scope/);
  assert.match(simulator,/Conversation not found or outside your inbox scope/);
});

test('DEV267a retains the accepted DEV267 schema as the deployment baseline',()=>{
  const migrations=fs.readdirSync(new URL('../src/migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
  assert.equal(migrations.length,170);
  assert.equal(migrations.at(-1),'170_prospect_diary.sql');
  const baseline=JSON.parse(read('src/database-schema-baseline/manifest.json'));
  const current=JSON.parse(read('src/database-schema-contract/manifest.json'));
  assert.equal(baseline.contracts.constraints.count,2748);
  assert.equal(current.generatedFrom.migrationCount,170);
  assert.equal(current.contracts.constraints.count,2748);
  assert.deepEqual(baseline,current);
});
