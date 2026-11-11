import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

const enabled=process.env.NYSA_PROSPECT_DIARY_TEST==='local-synthetic';
const uuid=()=>crypto.randomUUID();

test('DEV267 Prospect Diary uses Tasks, layered suppression, registered numbers and soft repeat-call warnings',{skip:!enabled,timeout:180000},async()=>{
  assert.equal(process.env.PGDATABASE,'nysa_test_fixture');assert.equal(process.env.PGUSER,'nysa_test_user');
  const db=await import('../src/db.js'),{createApp}=await import('../src/lib/http-kit.js'),{default:prospects}=await import('../src/routes/prospects.js');
  const ids={agent:uuid(),agent2:uuid(),manager:uuid(),director:uuid(),admin:uuid(),team:uuid()},tokens=Object.fromEntries(['agent','agent2','manager','director','admin'].map(x=>[x,crypto.randomBytes(32).toString('hex')]));
  const suffix=String(crypto.randomBytes(4).readUInt32BE()%9000000+1000000),phone=`+97150${suffix}`,blockedPhone=`+97155${suffix}`,wrongPhone=`+97156${suffix}`;let server;
  const request=async(path,{method='GET',body,as='agent',status=200}={})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{authorization:`Bearer ${tokens[as]}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),data=await response.json();assert.equal(response.status,status,JSON.stringify({path,method,as,expected:status,observed:response.status,data}));return data;};
  try{
    await db.migrate();assert.match((await db.one("SELECT current_setting('server_version') AS version")).version,/^13\.23/);
    const callingPolicy=await db.one("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='organization_settings_prospect_calling_policy_check'");assert.match(callingPolicy.definition,/540/);assert.match(callingPolicy.definition,/1080/);
    await db.execute(`INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES
      ($1,'DEV267 Agent',$2,'internal_broker','sales_agent','active','x'),($3,'DEV267 Agent2',$4,'internal_broker','sales_agent','active','x'),
      ($5,'DEV267 Manager',$6,'internal_broker','manager','active','x'),($7,'DEV267 Director',$8,'internal_broker','director','active','x'),
      ($9,'DEV267 Admin',$10,'admin','admin','active','x')`,[ids.agent,`a-${suffix}@example.invalid`,ids.agent2,`b-${suffix}@example.invalid`,ids.manager,`m-${suffix}@example.invalid`,ids.director,`d-${suffix}@example.invalid`,ids.admin,`admin-${suffix}@example.invalid`]);
    await db.execute('INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)',[ids.team,`DEV267 ${suffix}`,ids.manager]);
    await db.execute('UPDATE brokers SET team_id=$1 WHERE id=ANY($2::uuid[])',[ids.team,[ids.agent,ids.agent2,ids.manager]]);
    await db.execute("INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'member',$7),($4,$2,$5,'member',$7),($6,$2,$7,'manager',$7)",[uuid(),ids.team,ids.agent,uuid(),ids.agent2,uuid(),ids.manager]);
    for(const role of Object.keys(tokens))await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(tokens[role]).digest('hex'),ids[role]]);
    const app=createApp();app.mount('/api',prospects);server=await new Promise((resolve,reject)=>{const listening=app.listen({host:'127.0.0.1',port:0},()=>resolve(listening));listening.once('error',reject);});

    const calling=await request('/crm/prospect-diary/calling-numbers',{method:'POST',as:'director',status:201,body:{label:'DEV267 office',phone:'+971561234567',tdraRegistrationReference:`TDRA-${suffix}`,tdraRegisteredLegalName:'Nysa Realty',tdraRegisteredAt:'2026-11-01',tdraVerifiedAt:'2026-11-10T08:00:00Z',tdraEvidenceReference:`EVID-${suffix}`}});
    const adminCalling=await request('/crm/prospect-diary/calling-numbers',{method:'POST',as:'admin',status:201,body:{label:'DEV267 admin office',phone:`+97158${suffix}`,tdraRegistrationReference:`TDRA-ADMIN-${suffix}`,tdraRegisteredLegalName:'Nysa Realty',tdraRegisteredAt:'2026-11-01',tdraVerifiedAt:'2026-11-10T08:00:00Z',tdraEvidenceReference:`EVID-ADMIN-${suffix}`}});
    await request(`/crm/prospect-diary/calling-numbers/${adminCalling.id}/retire`,{method:'POST',as:'admin',body:{reason:'Number retired after test verification'}});
    const created=await request('/crm/prospects',{method:'POST',status:201,body:{displayName:'DEV267 Prospect',phone,email:`p-${suffix}@example.invalid`,source:'cold_call'}}),prospect=created.prospect;
    assert.equal(prospect.timezone,'Asia/Dubai');assert.equal(prospect.timezoneSource,'phone_inferred');
    await request(`/crm/prospects/${prospect.id}/dncr`,{method:'POST',as:'agent',status:403,body:{action:'record',evidenceReference:`DNCR-AGENT-${suffix}`}});
    const dncrRecorded=await request(`/crm/prospects/${prospect.id}/dncr`,{method:'POST',as:'manager',body:{action:'record',evidenceReference:`DNCR-MANUAL-${suffix}`}});assert.equal(dncrRecorded.suppression.strongest,'dncr');
    await request(`/crm/prospects/${prospect.id}/activities`,{method:'POST',status:409,body:{activityType:'call',direction:'outbound',outcome:'answered',companyCallingNumberId:calling.id,occurredAt:'2026-11-10T09:00:00+04:00',notes:'DNCR must block outbound calls'}});
    await request(`/crm/prospects/${prospect.id}/follow-ups`,{method:'POST',status:409,body:{subject:'DNCR must block follow-up',channel:'whatsapp',dueAt:'2026-11-12T10:00:00+04:00'}});
    const dncrReleased=await request(`/crm/prospects/${prospect.id}/dncr`,{method:'POST',as:'manager',body:{action:'release',reason:'Customer DNCR evidence was recorded in error'}});assert.equal(dncrReleased.suppression.strongest,null);
    const dncrAudits=await db.many("SELECT action FROM audit_log WHERE entity_type='Prospect' AND entity_id=$1 AND action IN('manual_dncr_recorded','manual_dncr_released') ORDER BY timestamp",[prospect.id]);assert.deepEqual(dncrAudits.map(row=>row.action),['manual_dncr_recorded','manual_dncr_released']);
    const managerTimezone=await request(`/crm/prospects/${prospect.id}/timezone`,{method:'PATCH',as:'manager',body:{timezone:'Asia/Kolkata',reason:'Confirmed customer location'}});assert.equal(managerTimezone.timezoneSource,'manager_override');
    const agentTimezone=await request(`/crm/prospects/${prospect.id}/timezone`,{method:'PATCH',body:{timezone:'Asia/Dubai'}});assert.equal(agentTimezone.timezoneSource,'agent_confirmed');
    await request(`/crm/prospects/${prospect.id}`,{as:'agent2',status:404});assert.equal((await request(`/crm/prospects/${prospect.id}`,{as:'manager'})).prospect.id,prospect.id);
    await request(`/crm/prospects/${prospect.id}/activities`,{method:'POST',status:400,body:{activityType:'call',direction:'outbound',outcome:'no_answer',occurredAt:'2026-11-10T08:45:00+04:00',notes:'Missing company calling number must be rejected'}});
    await request(`/crm/prospects/${prospect.id}/activities`,{method:'POST',status:400,body:{activityType:'call',direction:'outbound',outcome:'no_answer',companyCallingNumberId:'not-a-uuid',occurredAt:'2026-11-10T09:00:00+04:00',notes:'Malformed identifier must be rejected before PostgreSQL'}});
    await request(`/crm/prospects/${prospect.id}/activities`,{method:'POST',status:409,body:{activityType:'call',direction:'outbound',outcome:'no_answer',companyCallingNumberId:uuid(),occurredAt:'2026-11-10T09:30:00+04:00',notes:'Unknown valid identifier must remain a conflict'}});
    await request(`/crm/prospects/${prospect.id}/activities`,{method:'POST',status:201,body:{activityType:'call',direction:'outbound',outcome:'no_answer',companyCallingNumberId:calling.id,occurredAt:'2026-11-10T10:00:00+04:00',notes:'First attempt'}});
    const warning=await request(`/crm/prospects/${prospect.id}/activities`,{method:'POST',status:409,body:{activityType:'call',direction:'outbound',outcome:'voicemail',companyCallingNumberId:calling.id,occurredAt:'2026-11-10T10:30:00+04:00',notes:'Second unanswered attempt'}});assert.equal(warning.warning,true);assert.ok(warning.warnings.includes('unanswered_daily_threshold'));
    await request(`/crm/prospects/${prospect.id}/activities`,{method:'POST',status:201,body:{activityType:'call',direction:'outbound',outcome:'not_interested',companyCallingNumberId:calling.id,occurredAt:'2026-11-10T11:00:00+04:00',notes:'Second attempt with warning',warningAcknowledged:true,warningReason:'Agent reviewed prior attempts'}});
    const afterDecline=await request(`/crm/prospects/${prospect.id}/activities`,{method:'POST',status:201,body:{activityType:'call',direction:'outbound',outcome:'answered',companyCallingNumberId:calling.id,occurredAt:'2026-11-10T12:00:00+04:00',notes:'Recorded after decline',warningAcknowledged:true,warningReason:'Customer requested another call'}});assert.ok(afterDecline.warnings.includes('repeat_after_decline'));
    const outside=await request(`/crm/prospects/${prospect.id}/activities`,{method:'POST',status:409,body:{activityType:'call',direction:'outbound',outcome:'answered',companyCallingNumberId:calling.id,occurredAt:'2026-11-10T20:00:00+04:00',notes:'Late evidence'}});assert.ok(outside.warnings.includes('outside_calling_window'));
    const retained=await request(`/crm/prospects/${prospect.id}/activities`,{method:'POST',status:201,body:{activityType:'call',direction:'outbound',outcome:'answered',companyCallingNumberId:calling.id,occurredAt:'2026-11-10T20:00:00+04:00',notes:'Late evidence retained',warningAcknowledged:true,warningReason:'Record completed call accurately'}});assert.ok(retained.warnings.includes('outside_calling_window'));
    const original=(await db.one('SELECT id FROM prospect_activities WHERE prospect_id=$1 ORDER BY created_at LIMIT 1',[prospect.id]));
    const correction=await request(`/crm/prospects/${prospect.id}/activities`,{method:'POST',status:201,body:{activityType:'note',notes:'Corrected prior note',correctsActivityId:original.id,correctionReason:'Prior evidence wording was inaccurate'}});assert.equal(correction.activity.correctsActivityId,original.id);
    const follow=await request(`/crm/prospects/${prospect.id}/follow-ups`,{method:'POST',status:201,body:{subject:'WhatsApp follow-up',channel:'whatsapp',dueAt:'2026-11-12T20:00:00+04:00',warningAcknowledged:true,warningReason:'Customer asked for follow-up'}});const task=await db.one("SELECT task_type,prospect_channel FROM tasks WHERE id=$1",[follow.followUp.id]);assert.deepEqual({taskType:task.taskType,prospectChannel:task.prospectChannel},{taskType:'prospect_follow_up',prospectChannel:'whatsapp'});
    await request(`/crm/prospects/${prospect.id}/follow-ups`,{method:'POST',status:409,body:{subject:'Call outside window',channel:'call',dueAt:'2026-11-12T20:00:00+04:00',warningAcknowledged:true,warningReason:'Should still be blocked'}});
    await request(`/crm/prospects/${prospect.id}/follow-ups/${follow.followUp.id}`,{method:'PATCH',body:{status:'completed',outcome:'Customer reached'}});
    await assert.rejects(db.execute("UPDATE prospect_activities SET notes='changed' WHERE id=$1",[original.id]),/append-only/);

    const {recordContactSuppression,releaseContactSuppression,getContactSuppression}=await import('../src/contact-suppression.js');
    await db.transaction(async client=>{await recordContactSuppression({phone:blockedPhone,type:'opt_out',evidenceReference:'OPT-1',actorId:ids.agent},client);await recordContactSuppression({phone:blockedPhone,type:'do_not_contact',evidenceReference:'DNC-1',actorId:ids.manager},client);const released=await releaseContactSuppression({phone:blockedPhone,type:'do_not_contact',reason:'Manager corrected local DNC',actorId:ids.manager,actorRole:'manager'},client);assert.equal(released.strongest,'opt_out');});
    assert.equal((await getContactSuppression(blockedPhone)).strongest,'opt_out');
    const autoDnc=await request('/crm/prospects',{method:'POST',status:201,body:{displayName:'Suppressed prospect',phone:blockedPhone,email:`s-${suffix}@example.invalid`,source:'referral'}});assert.equal(autoDnc.prospect.status,'do_not_contact');
    await request(`/crm/prospects/${autoDnc.prospect.id}/activities`,{method:'POST',status:409,body:{activityType:'call',direction:'outbound',outcome:'answered',companyCallingNumberId:calling.id,notes:'Must not send'}});
    await request(`/crm/prospects/${autoDnc.prospect.id}/follow-ups`,{method:'POST',status:409,body:{subject:'Must not schedule',channel:'whatsapp',dueAt:'2026-11-12T10:00:00+04:00'}});
    await db.transaction(client=>recordContactSuppression({phone:wrongPhone,type:'wrong_number',evidenceReference:'WRONG-1',actorId:ids.manager},client));
    await request('/crm/prospects',{method:'POST',status:409,body:{phone:wrongPhone,source:'cold_call'}});
    const purchased=await request('/crm/prospects',{method:'POST',status:400,body:{phone:`+97157${suffix}`,source:'purchased_data'}});assert.match(purchased.error,/supplier/);
    const invalidPhone=`+97159${suffix}`,invalid=await request('/crm/prospects',{method:'POST',status:201,body:{displayName:'Invalid number prospect',phone:invalidPhone,email:`invalid-${suffix}@example.invalid`,source:'cold_call'}});
    await request(`/crm/prospects/${invalid.prospect.id}/activities`,{method:'POST',status:201,body:{activityType:'call',direction:'outbound',outcome:'invalid_number',companyCallingNumberId:calling.id,occurredAt:'2026-11-10T13:00:00+04:00',notes:'Confirmed invalid number'}});
    assert.equal((await getContactSuppression(invalidPhone)).strongest,'wrong_number');
  }finally{
    if(server){server.close();server.closeAllConnections?.();}
    await db.execute("DELETE FROM audit_log WHERE performed_by=ANY($1::uuid[])",[Object.values(ids).filter(x=>String(x).includes('-'))]).catch(()=>{});
    await db.execute("DELETE FROM tasks WHERE prospect_id IN(SELECT id FROM prospects WHERE normalized_phone IN($1,$2))",[phone,blockedPhone]).catch(()=>{});
    await db.execute("DELETE FROM prospects WHERE normalized_phone IN($1,$2)",[phone,blockedPhone]).catch(()=>{});
    await db.execute('DELETE FROM wa_contact_suppressions WHERE normalized_phone=ANY($1::text[])',[[phone,blockedPhone,wrongPhone]]).catch(()=>{});
    await db.execute("DELETE FROM company_calling_numbers WHERE tdra_registration_reference=$1",[`TDRA-${suffix}`]).catch(()=>{});
    await db.execute('DELETE FROM sessions WHERE broker_id=ANY($1::uuid[])',[[ids.agent,ids.agent2,ids.manager,ids.director]]).catch(()=>{});
    await db.execute('DELETE FROM team_memberships WHERE team_id=$1',[ids.team]).catch(()=>{});await db.execute('DELETE FROM teams WHERE id=$1',[ids.team]).catch(()=>{});await db.execute('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[[ids.agent,ids.agent2,ids.manager,ids.director]]).catch(()=>{});await db.closeDatabase();
  }
});
