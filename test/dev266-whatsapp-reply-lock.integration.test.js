import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

const enabled=process.env.NYSA_WA_REPLY_LOCK_TEST==='local-synthetic';
const uuid=()=>crypto.randomUUID();

test('DEV266 reply lock is enforced by the PostgreSQL 13 route transaction',{skip:!enabled,timeout:180000},async()=>{
  assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
  assert.equal(process.env.PGUSER,'nysa_test_user');
  process.env.LEAD_RESPONSE_ENVIRONMENT='crm-test';
  process.env.WHATSAPP_SIMULATED_PROVIDER_ENABLED='true';
  process.env.WHATSAPP_SIMULATED_PROVIDER_TOKEN='local-synthetic-dev266-token-at-least-32';
  process.env.WHATSAPP_SIMULATED_PROVIDER_URL='http://127.0.0.1:9/api/providers/whatsapp-simulated';
  const expectedTimeout=process.env.WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES?Number(process.env.WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES):30;

  const db=await import('../src/db.js');
  const {createApp}=await import('../src/lib/http-kit.js');
  const {default:workspace}=await import('../src/routes/whatsapp-workspace.js');
  const {createWhatsAppSimulatedProviderRoutes,createWhatsAppSimulationControlRoutes}=await import('../src/routes/whatsapp-simulated-provider.js');
  const {cleanupAllSimulatedRecords}=await import('../src/whatsapp-simulated-provider-store.js');
  const {replyLockState,selectConversationWithReplyLock}=await import('../src/whatsapp-reply-lock.js');
  const people={admin:uuid(),agent:uuid(),agent2:uuid(),manager:uuid()};
  const team=uuid(),tokens=Object.fromEntries(Object.keys(people).map(role=>[role,crypto.randomBytes(32).toString('hex')]));
  const phone=`+971509${String(100000+(Number.parseInt(crypto.randomBytes(3).toString('hex'),16)%800000)).padStart(6,'0')}`;
  let server,conversationId;

  const request=async(path,{method='GET',body,as='admin',status=200}={})=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{authorization:`Bearer ${tokens[as]}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await response.json();
    assert.equal(response.status,status,JSON.stringify({path,method,as,expected:status,observed:response.status,data}));
    return data;
  };
  const rawRequest=async(path,{method='GET',body,as='admin'}={})=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{authorization:`Bearer ${tokens[as]}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    return{status:response.status,data:await response.json()};
  };
  const lock=(action,as='agent',status=200)=>request(`/crm/whatsapp-workspace/conversations/${conversationId}/reply-lock`,{method:'POST',as,status,body:{action}});
  const send=(as,text,status=202,key=crypto.randomBytes(8).toString('hex'))=>request(`/crm/whatsapp-workspace/conversations/${conversationId}/simulated-send`,{method:'POST',as,status,body:{text,idempotencyKey:`dev266-${key}`}});
  const outboundCount=async()=>Number((await db.one("SELECT COUNT(*)::int AS count FROM wa_conversation_messages WHERE conversation_id=$1 AND direction='outbound'",[conversationId])).count);

  try{
    await db.migrate();
    const version=await db.one('SELECT current_setting(\'server_version\') AS version');
    assert.match(version.version,/^13\.23(?:\b|$)/);
    await db.execute(`INSERT INTO brokers(id,name,email,role,job_role,status,password_hash)
      VALUES($1,'DEV266 Admin',$2,'admin','admin','active','synthetic-only'),
      ($3,'DEV266 Agent Holder',$4,'internal_broker','sales_agent','active','synthetic-only'),
      ($5,'DEV266 Other Agent',$6,'internal_broker','sales_agent','active','synthetic-only'),
      ($7,'DEV266 Manager',$8,'internal_broker','manager','active','synthetic-only')`,[
        people.admin,`dev266-admin-${people.admin}@example.invalid`,people.agent,`dev266-agent-${people.agent}@example.invalid`,people.agent2,`dev266-agent2-${people.agent2}@example.invalid`,people.manager,`dev266-manager-${people.manager}@example.invalid`
      ]);
    await db.execute('INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)',[team,`DEV266 Synthetic ${team}`,people.manager]);
    await db.execute('UPDATE brokers SET team_id=$1 WHERE id=ANY($2::uuid[])',[team,[people.agent,people.agent2,people.manager]]);
    await db.execute("INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'member',$7),($4,$2,$5,'member',$7),($6,$2,$7,'manager',$7)",[uuid(),team,people.agent,uuid(),people.agent2,uuid(),people.manager]);
    for(const [role,id] of Object.entries(people))await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(tokens[role]).digest('hex'),id]);

    const app=createApp();
    app.mount('/api',workspace);
    app.mount('/api',createWhatsAppSimulatedProviderRoutes());
    app.mount('/api',createWhatsAppSimulationControlRoutes());
    server=await new Promise((resolve,reject)=>{const listening=app.listen({port:0,host:'127.0.0.1'},()=>resolve(listening));listening.once('error',reject);});
    process.env.PORT=String(server.address().port);
    await request('/admin/whatsapp-simulation/control',{method:'POST',body:{paused:false,faultMode:'none'}});
    const status=await request('/admin/whatsapp-simulation');
    assert.equal(status.replyLockTimeoutMinutes,expectedTimeout);
    const inbound=await request('/admin/whatsapp-simulation/inbound',{method:'POST',status:202,body:{from:phone,name:'DEV266 Synthetic Prospect',teamId:team,agentId:people.agent,text:'DEV266 lock verification',eventId:`dev266-${uuid()}`}});
    conversationId=inbound.conversationId;

    // Two simultaneous acquisitions are serialized by the row lock: exactly one wins.
    const concurrent=await Promise.all(['agent','manager'].map(as=>rawRequest(`/crm/whatsapp-workspace/conversations/${conversationId}/reply-lock`,{method:'POST',as,body:{action:'acquire'}})));
    assert.deepEqual(concurrent.map(result=>result.status).sort(),[200,409]);
    assert.equal(concurrent.find(result=>result.status===409).data.code,'WHATSAPP_REPLY_LOCK_HELD');
    await lock('release','manager');

    // Owner acquisition succeeds with PostgreSQL 13, persists the holder and writes audit.
    const acquired=await lock('acquire');
    assert.equal(acquired.replyLock.ownerId,people.agent);
    assert.equal(acquired.replyLock.active,true);
    assert.equal(acquired.replyLock.timeoutMinutes,expectedTimeout);
    assert.equal((await db.one("SELECT COUNT(*)::int AS count FROM audit_log WHERE entity_type='WhatsAppConversation' AND entity_id=$1 AND action='reply_lock_acquired'",[conversationId])).count,2);

    // A second in-scope user cannot acquire or send while the Agent holds it.
    const managerAcquire=await lock('acquire','manager',409);
    assert.equal(managerAcquire.code,'WHATSAPP_REPLY_LOCK_HELD');
    const beforeManagerBlocked=await outboundCount();
    const managerBlocked=await send('manager','Manager must not bypass an Agent lock',409);
    assert.equal(managerBlocked.code,'WHATSAPP_REPLY_LOCK_HELD');
    assert.equal(await outboundCount(),beforeManagerBlocked);

    // An otherwise in-scope Agent cannot bypass a lock retained by a prior owner.
    // The direct owner change is test setup for a stale concurrent state; the real
    // reassignment route is tested below and always clears both lock fields.
    await db.execute('UPDATE wa_conversations SET owner_agent_id=$1 WHERE id=$2',[people.agent2,conversationId]);
    const beforeOtherAgentBlocked=await outboundCount();
    const otherAgentBlocked=await send('agent2','Another Agent must not bypass the retained lock',409);
    assert.equal(otherAgentBlocked.code,'WHATSAPP_REPLY_LOCK_HELD');
    await lock('release','agent2',403);
    assert.equal(await outboundCount(),beforeOtherAgentBlocked);
    await db.execute('UPDATE wa_conversations SET owner_agent_id=$1 WHERE id=$2',[people.agent,conversationId]);

    // A successful holder send refreshes database time and failed duplicates do not create messages.
    await db.execute("UPDATE wa_conversations SET reply_lock_acquired_at=NOW()-INTERVAL '5 minutes' WHERE id=$1",[conversationId]);
    const beforeRefresh=(await db.one('SELECT reply_lock_acquired_at FROM wa_conversations WHERE id=$1',[conversationId])).replyLockAcquiredAt;
    const sent=await send('agent','Holder refreshes the lock');
    assert.equal(sent.replyLockRefreshed,true);
    assert.ok(new Date(sent.replyLock.acquiredAt)>new Date(beforeRefresh));
    const duplicateBefore=await outboundCount();
    const duplicateKey=`duplicate-${crypto.randomBytes(8).toString('hex')}`;
    const duplicate=await send('agent','Holder refreshes the lock',202,duplicateKey);
    const duplicateAgain=await send('agent','Holder refreshes the lock',202,duplicateKey);
    assert.equal(duplicate.message.duplicate,false);
    assert.equal(duplicateAgain.message.duplicate,true);
    assert.equal(duplicateAgain.replyLockRefreshed,false);
    assert.equal(await outboundCount(),duplicateBefore+1);

    // A provider rejection is visible and changes neither messages nor lock time.
    const beforeFault=(await db.one('SELECT reply_lock_acquired_at FROM wa_conversations WHERE id=$1',[conversationId])).replyLockAcquiredAt;
    const beforeFaultCount=await outboundCount();
    await request('/admin/whatsapp-simulation/control',{method:'POST',body:{paused:false,faultMode:'server_error'}});
    const fault=await send('agent','Rejected provider attempt',503,'provider-fault');
    assert.match(fault.error,/server error/i);
    assert.equal(await outboundCount(),beforeFaultCount);
    assert.equal(new Date((await db.one('SELECT reply_lock_acquired_at FROM wa_conversations WHERE id=$1',[conversationId])).replyLockAcquiredAt).toISOString(),new Date(beforeFault).toISOString());
    await request('/admin/whatsapp-simulation/control',{method:'POST',body:{paused:false,faultMode:'none'}});

    // Manager releases, then may send. The release is explicitly audited as an override.
    const managerRelease=await lock('release','manager');
    assert.equal(managerRelease.replyLock.ownerId,null);
    assert.equal((await db.one("SELECT details::jsonb->>'releaseMode' AS mode FROM audit_log WHERE entity_id=$1 AND action='reply_lock_released' ORDER BY timestamp DESC LIMIT 1",[conversationId])).mode,'manager_override');
    await send('manager','Manager sends only after releasing');

    // A Sales Agent is blocked when the Manager is the active holder.
    await lock('acquire','manager');
    const beforeAgentBlocked=await outboundCount();
    const agentBlocked=await send('agent','Agent must not bypass a Manager lock',409);
    assert.equal(agentBlocked.code,'WHATSAPP_REPLY_LOCK_HELD');
    assert.equal(await outboundCount(),beforeAgentBlocked);
    await lock('release','manager');
    await send('agent','Agent sends after holder release');

    // Exact database-clock boundary: one second before is active; equality and one second after are free.
    await lock('acquire','agent');
    await db.transaction(async client=>{
      await client.query("UPDATE wa_conversations SET reply_lock_acquired_at=NOW()-make_interval(secs=>$2::double precision) WHERE id=$1",[conversationId,(expectedTimeout*60)-1]);
      const row=await selectConversationWithReplyLock(client,conversationId,{forUpdate:true});
      assert.equal(replyLockState(row,{id:people.manager,jobRole:'manager'}).active,true);
    });
    await send('manager','One second before expiry is blocked',409);
    await db.transaction(async client=>{
      await client.query("UPDATE wa_conversations SET reply_lock_acquired_at=NOW()-make_interval(secs=>$2::double precision) WHERE id=$1",[conversationId,expectedTimeout*60]);
      const row=await selectConversationWithReplyLock(client,conversationId,{forUpdate:true});
      assert.equal(replyLockState(row,{id:people.manager,jobRole:'manager'}).active,false);
    });
    await send('manager','Exact expiry boundary is free');
    await db.transaction(async client=>{
      await client.query("UPDATE wa_conversations SET reply_lock_acquired_at=NOW()-make_interval(secs=>$2::double precision) WHERE id=$1",[conversationId,(expectedTimeout*60)+1]);
      const row=await selectConversationWithReplyLock(client,conversationId,{forUpdate:true});
      assert.equal(replyLockState(row,{id:people.manager,jobRole:'manager'}).active,false);
    });
    const replaced=await lock('acquire','manager');
    assert.equal(replaced.replyLock.ownerId,people.manager);
    assert.equal((await db.one("SELECT COUNT(*)::int AS count FROM audit_log WHERE entity_id=$1 AND action='reply_lock_expired_replaced'",[conversationId])).count,1);

    // Reassignment clears both fields in the same transaction.
    const reassigned=await request(`/crm/whatsapp-workspace/conversations/${conversationId}/assignment`,{method:'POST',as:'manager',body:{agentId:people.agent2,reason:'DEV266 verified reassignment'}});
    assert.equal(reassigned.conversation.ownerAgentId,people.agent2);
    const cleared=await db.one('SELECT reply_lock_owner_id,reply_lock_acquired_at FROM wa_conversations WHERE id=$1',[conversationId]);
    assert.equal(cleared.replyLockOwnerId,null);
    assert.equal(cleared.replyLockAcquiredAt,null);
    await lock('acquire','agent2');
    const takenOver=await request(`/crm/whatsapp-workspace/conversations/${conversationId}/assignment`,{method:'POST',as:'manager',body:{takeover:true,reason:'DEV266 verified takeover'}});
    assert.equal(takenOver.conversation.ownerAgentId,people.manager);
    const takeoverCleared=await db.one('SELECT reply_lock_owner_id,reply_lock_acquired_at FROM wa_conversations WHERE id=$1',[conversationId]);
    assert.equal(takeoverCleared.replyLockOwnerId,null);
    assert.equal(takeoverCleared.replyLockAcquiredAt,null);
    await new Promise(resolve=>setTimeout(resolve,1800));
  }finally{
    if(server){server.close();server.closeAllConnections?.();}
    await db.execute("UPDATE wa_simulated_provider_control SET paused=TRUE,fault_mode='none',updated_by=NULL,updated_at=NOW() WHERE singleton=TRUE").catch(()=>{});
    await cleanupAllSimulatedRecords(people.admin).catch(()=>{});
    await db.execute('DELETE FROM audit_log WHERE performed_by=ANY($1::uuid[])',[Object.values(people)]).catch(()=>{});
    await db.execute('DELETE FROM sessions WHERE broker_id=ANY($1::uuid[])',[Object.values(people)]).catch(()=>{});
    await db.execute('DELETE FROM team_memberships WHERE team_id=$1',[team]).catch(()=>{});
    await db.execute('UPDATE brokers SET team_id=NULL WHERE id=ANY($1::uuid[])',[Object.values(people)]).catch(()=>{});
    await db.execute('DELETE FROM teams WHERE id=$1',[team]).catch(()=>{});
    await db.execute('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[Object.values(people)]).catch(()=>{});
    await db.closeDatabase();
  }
});
