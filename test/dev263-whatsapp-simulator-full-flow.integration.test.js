import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_WA_SIM_FULL_FLOW_TEST==='local-synthetic';
const uuid=()=>crypto.randomUUID();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('DEV263 full in-process simulator flow works while loopback is unreachable',{skip:!enabled,timeout:180000},async()=>{
  assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
  assert.equal(process.env.PGUSER,'nysa_test_user');
  assert.ok(['127.0.0.1','localhost'].includes(process.env.PGHOST));
  process.env.LEAD_RESPONSE_ENVIRONMENT='crm-test';
  process.env.WHATSAPP_SIMULATED_PROVIDER_ENABLED='true';
  process.env.WHATSAPP_SIMULATED_PROVIDER_TOKEN='local-synthetic-dev263-token-at-least-32';
  process.env.WHATSAPP_SIMULATED_PROVIDER_URL='http://127.0.0.1:9/api/providers/whatsapp-simulated';

  const db=await import('../src/db.js');
  const {createApp}=await import('../src/lib/http-kit.js');
  const {default:workspace}=await import('../src/routes/whatsapp-workspace.js');
  const {createWhatsAppSimulatedProviderRoutes,createWhatsAppSimulationControlRoutes}=await import('../src/routes/whatsapp-simulated-provider.js');
  const people={admin:uuid(),agent:uuid(),manager:uuid()};
  const team=uuid();
  const runKey=crypto.randomBytes(8).toString('hex');
  const phoneBase=100000+(Number.parseInt(runKey.slice(0,6),16)%800000);
  const syntheticPhone=offset=>`+971509${String(phoneBase+offset).padStart(6,'0')}`;
  const tokens=Object.fromEntries(Object.keys(people).map(role=>[role,crypto.randomBytes(32).toString('hex')]));
  const created={templates:[],campaigns:[],segments:[],batches:[],runs:[]};
  let server;

  const request=async(path,{method='GET',body,as='admin',status=200,auth=true}={})=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{
      method,
      headers:{...(auth?{authorization:`Bearer ${tokens[as]}`}:{'x-nysa-simulation-token':process.env.WHATSAPP_SIMULATED_PROVIDER_TOKEN}),'content-type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body)
    });
    const data=await response.json();
    assert.equal(response.status,status,JSON.stringify({path,method,as,status:response.status,data}));
    return data;
  };
  const setFault=faultMode=>request('/admin/whatsapp-simulation/control',{method:'POST',body:{paused:false,faultMode}});

  try{
    await db.migrate();
    await db.execute(`INSERT INTO brokers(id,name,email,role,job_role,status,password_hash)
      VALUES($1,'Synthetic DEV263 Admin',$2,'admin','admin','active','synthetic-only'),
      ($3,'Synthetic DEV263 Agent',$4,'internal_broker','sales_agent','active','synthetic-only'),
      ($5,'Synthetic DEV263 Manager',$6,'internal_broker','manager','active','synthetic-only')`,[
        people.admin,`dev263-admin-${people.admin}@example.invalid`,people.agent,`dev263-agent-${people.agent}@example.invalid`,people.manager,`dev263-manager-${people.manager}@example.invalid`
      ]);
    await db.execute('INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)',[team,`Synthetic DEV263 ${team}`,people.manager]);
    await db.execute('UPDATE brokers SET team_id=$1 WHERE id=ANY($2::uuid[])',[team,[people.agent,people.manager]]);
    await db.execute("INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'member',$4),($5,$2,$4,'manager',$4)",[uuid(),team,people.agent,people.manager,uuid()]);
    for(const [role,id] of Object.entries(people))await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(tokens[role]).digest('hex'),id]);

    const app=createApp();
    app.mount('/api',workspace);
    app.mount('/api',createWhatsAppSimulatedProviderRoutes());
    app.mount('/api',createWhatsAppSimulationControlRoutes());
    server=await new Promise((resolve,reject)=>{const listening=app.listen({port:0,host:'127.0.0.1'},()=>resolve(listening));listening.once('error',reject);});
    process.env.PORT=String(server.address().port);
    assert.equal(new URL(process.env.WHATSAPP_SIMULATED_PROVIDER_URL).port,'9');
    await assert.rejects(fetch(process.env.WHATSAPP_SIMULATED_PROVIDER_URL,{signal:AbortSignal.timeout(300)}));
    await setFault('none');

    const makeTemplate=async(label)=>{
      const createdTemplate=await request('/crm/whatsapp-workspace/templates',{method:'POST',as:'manager',status:201,body:{
        teamId:team,name:`dev263_${label}_${crypto.randomBytes(4).toString('hex')}`,languageCode:'en',category:'utility',headerType:'none',bodyText:`Synthetic ${label} update`,footerText:'Reply STOP to opt out'
      }});
      created.templates.push(createdTemplate.template.id);
      return createdTemplate;
    };

    // 1. Template outcomes: approved, rejected and pending.
    const templates={};
    for(const outcome of ['approved','rejected','pending']){
      templates[outcome]=await makeTemplate(outcome);
      await request(`/crm/whatsapp-workspace/template-versions/${templates[outcome].version.id}/simulated-submit`,{method:'POST',as:'manager',status:202,body:{outcome}});
    }
    await wait(1400);
    for(const outcome of ['approved','rejected','pending']){
      const row=await db.one('SELECT simulated_provider_status,simulated_provider_reason FROM wa_message_template_versions WHERE id=$1',[templates[outcome].version.id]);
      assert.equal(row.simulatedProviderStatus,outcome);
      if(outcome==='rejected')assert.match(row.simulatedProviderReason,/Rejected by configured simulator rule/);
    }

    // 2. A brand-new plain inbound with agentId must create its Lead before any
    // CTWA conversation exists. This is the exact hosted UAT path that exposed
    // a missing leads_assign_reference trigger.
    const plainPhone=syntheticPhone(0);
    const plain=await request('/admin/whatsapp-simulation/inbound',{method:'POST',status:202,body:{from:plainPhone,name:'Synthetic Plain Prospect',teamId:team,agentId:people.agent,text:'Plain inbound before CTWA',eventId:`${runKey}-inbound-plain`}});
    const plainLead=await db.one('SELECT lead_reference,assigned_team_id,assigned_to FROM leads WHERE id=$1',[plain.leadId]);
    assert.match(plainLead.leadReference,/^NYSA-LD-[0-9]{6}-[0-9]{6}$/);
    assert.equal(plainLead.assignedTeamId,team);
    assert.equal(plainLead.assignedTo,people.agent);
    const plainSource=await db.one('SELECT source_type,ctwa_entry_at FROM wa_conversations WHERE id=$1',[plain.conversationId]);
    assert.equal(plainSource.sourceType,'other');
    assert.equal(plainSource.ctwaEntryAt,null);

    // 3. Inbound CTWA, button and media shapes.
    const phone=syntheticPhone(1);
    const ctwa=await request('/admin/whatsapp-simulation/inbound',{method:'POST',status:202,body:{from:phone,name:'Synthetic CTWA Prospect',teamId:team,agentId:people.agent,text:'CTWA enquiry',ctwa:true,eventId:`${runKey}-inbound-ctwa`}});
    await request('/admin/whatsapp-simulation/inbound',{method:'POST',status:202,body:{from:phone,name:'Synthetic CTWA Prospect',teamId:team,agentId:people.agent,text:'',button:{id:'send_brochure',text:'Send brochure'},eventId:`${runKey}-inbound-button`}});
    await request('/admin/whatsapp-simulation/inbound',{method:'POST',status:202,body:{from:phone,name:'Synthetic CTWA Prospect',teamId:team,agentId:people.agent,text:'',media:{type:'image',id:'synthetic-image-1',caption:'Synthetic floor plan'},eventId:`${runKey}-inbound-media`}});
    const inboundRows=await db.many('SELECT message_type,body FROM wa_conversation_messages WHERE conversation_id=$1 AND direction=\'inbound\' ORDER BY occurred_at,id',[ctwa.conversationId]);
    assert.deepEqual(inboundRows.map(row=>[row.messageType,row.body]),[['text','CTWA enquiry'],['text','Send brochure'],['image','Synthetic floor plan']]);
    const source=await db.one('SELECT source_type,ctwa_entry_at FROM wa_conversations WHERE id=$1',[ctwa.conversationId]);
    assert.equal(source.sourceType,'ctwa');assert.ok(source.ctwaEntryAt);

    // 4. Successful and failed conversation status callbacks.
    const success=await request(`/crm/whatsapp-workspace/conversations/${ctwa.conversationId}/simulated-send`,{method:'POST',as:'agent',status:202,body:{text:'Synthetic successful reply',idempotencyKey:`${runKey}-success-reply`}});
    const successStatuses=[];
    for(let i=0;i<15;i++){
      const row=await db.one('SELECT provider_status FROM wa_conversation_messages WHERE provider_message_id=$1',[success.provider.messages[0].id]);
      if(row&&!successStatuses.includes(row.providerStatus))successStatuses.push(row.providerStatus);
      if(row?.providerStatus==='read')break;
      await wait(100);
    }
    assert.deepEqual(successStatuses,['accepted','sent','delivered','read']);
    const failed=await request(`/crm/whatsapp-workspace/conversations/${ctwa.conversationId}/simulated-send`,{method:'POST',as:'agent',status:202,body:{text:'Synthetic failed reply',idempotencyKey:`${runKey}-failed-reply`,simulateFailure:true}});
    const failedStatuses=[];
    for(let i=0;i<15;i++){
      const row=await db.one('SELECT provider_status FROM wa_conversation_messages WHERE provider_message_id=$1',[failed.provider.messages[0].id]);
      if(row&&!failedStatuses.includes(row.providerStatus))failedStatuses.push(row.providerStatus);
      if(row?.providerStatus==='failed')break;
      await wait(100);
    }
    assert.deepEqual(failedStatuses,['accepted','sent','failed']);

    // 5. Frozen campaign recipients receive independent statuses and a repeat launch does not duplicate sends.
    const rows=[
      {name:'Synthetic Campaign One',phone:syntheticPhone(2),email:'one@example.invalid',source:'synthetic_test',consentStatus:'verified',consentEvidenceRef:'dev263-consent-1',tags:['dev263']},
      {name:'Synthetic Campaign Two',phone:syntheticPhone(3),email:'two@example.invalid',source:'synthetic_test',consentStatus:'verified',consentEvidenceRef:'dev263-consent-2',tags:['dev263']}
    ];
    const sourceMeta={sourceType:'event'};
    const preview=await request('/crm/whatsapp-workspace/recipient-imports/preview',{method:'POST',as:'agent',body:{teamId:team,originalFileName:'dev263-recipients.csv',rows,...sourceMeta}});
    const committed=await request('/crm/whatsapp-workspace/recipient-imports/commit',{method:'POST',as:'agent',status:201,body:{teamId:team,originalFileName:'dev263-recipients.csv',rows,...sourceMeta,previewHash:preview.previewHash,reviewToken:preview.reviewToken}});
    created.batches.push(committed.batch.id);
    const segment=await request('/crm/whatsapp-workspace/segments',{method:'POST',as:'agent',status:201,body:{teamId:team,name:`DEV263 segment ${crypto.randomBytes(4).toString('hex')}`,description:'Full simulator flow',definition:{batchIds:[committed.batch.id],consentStatus:'verified',tagsAny:['dev263']}}});
    created.segments.push(segment.segment.id);
    const campaign=await request('/crm/whatsapp-workspace/campaigns',{method:'POST',as:'agent',status:201,body:{teamId:team,name:`DEV263 campaign ${crypto.randomBytes(4).toString('hex')}`,purpose:'Synthetic full simulator verification',segmentId:segment.segment.id,templateVersionId:templates.approved.version.id,materialIds:[],scheduledAt:'2026-11-24T10:00:00+04:00',budgetAed:100}});
    created.campaigns.push(campaign.campaign.id);
    await request(`/crm/whatsapp-workspace/campaigns/${campaign.campaign.id}/submit`,{method:'POST',as:'agent',body:{}});
    const approval=await request(`/crm/whatsapp-workspace/campaigns/${campaign.campaign.id}/decision`,{method:'POST',as:'manager',body:{decision:'approve'}});
    assert.equal(approval.approval.recipientCount,2);
    const campaignLock=await request(`/crm/whatsapp-workspace/conversations/${ctwa.conversationId}/reply-lock`,{method:'POST',as:'agent',body:{action:'acquire'}});
    assert.equal(campaignLock.replyLock.heldByCurrentUser,true);
    const launch=await request(`/crm/whatsapp-workspace/campaigns/${campaign.campaign.id}/simulated-send`,{method:'POST',as:'manager',status:202,body:{}});
    assert.deepEqual({frozen:launch.frozenRecipientCount,accepted:launch.accepted,unchanged:launch.unchanged,failed:launch.failed},{frozen:2,accepted:2,unchanged:0,failed:0});
    const lockAfterCampaign=await db.one('SELECT reply_lock_owner_id FROM wa_conversations WHERE id=$1',[ctwa.conversationId]);
    assert.equal(lockAfterCampaign.replyLockOwnerId,people.agent,'Campaign launch must not consult or clear a conversation reply lock');
    await request(`/crm/whatsapp-workspace/conversations/${ctwa.conversationId}/reply-lock`,{method:'POST',as:'agent',body:{action:'release'}});
    await wait(1400);
    const recipientStatuses=await db.many('SELECT normalized_phone,simulated_status,simulated_provider_message_id FROM wa_campaign_approval_recipients WHERE campaign_id=$1 ORDER BY normalized_phone',[campaign.campaign.id]);
    assert.deepEqual(recipientStatuses.map(row=>[row.normalizedPhone,row.simulatedStatus,Boolean(row.simulatedProviderMessageId)]),[[syntheticPhone(2),'read',true],[syntheticPhone(3),'read',true]]);
    const repeatLaunch=await request(`/crm/whatsapp-workspace/campaigns/${campaign.campaign.id}/simulated-send`,{method:'POST',as:'manager',status:202,body:{}});
    assert.deepEqual({accepted:repeatLaunch.accepted,unchanged:repeatLaunch.unchanged,failed:repeatLaunch.failed},{accepted:0,unchanged:2,failed:0});

    // 6. Every fault returns a visible-safe API error and creates no outbound message.
    const faultExpectations=[['timeout',504,/timeout/i],['rate_limited',429,/rate limit/i],['server_error',503,/server error/i],['invalid_number',400,/recipient number/i],['invalid_payload',502,/message id/i]];
    for(const [fault,status,errorPattern] of faultExpectations){
      await setFault(fault);
      const before=await db.one("SELECT COUNT(*)::int AS count FROM wa_conversation_messages WHERE conversation_id=$1 AND direction='outbound'",[ctwa.conversationId]);
      const error=await request(`/crm/whatsapp-workspace/conversations/${ctwa.conversationId}/simulated-send`,{method:'POST',as:'agent',status,body:{text:`Fault ${fault}`,idempotencyKey:`${runKey}-fault-${fault}`}});
      assert.match(error.error,errorPattern);
      const repeat=await request(`/crm/whatsapp-workspace/conversations/${ctwa.conversationId}/simulated-send`,{method:'POST',as:'agent',status,body:{text:`Fault ${fault}`,idempotencyKey:`${runKey}-fault-${fault}`}});
      assert.match(repeat.error,errorPattern);
      const after=await db.one("SELECT COUNT(*)::int AS count FROM wa_conversation_messages WHERE conversation_id=$1 AND direction='outbound'",[ctwa.conversationId]);
      assert.equal(after.count,before.count,`${fault} created a duplicate/partial outbound message`);
    }
    const pausedTemplate=await makeTemplate('paused_fault');
    await setFault('template_paused');
    const beforeTemplateEvents=await db.one("SELECT COUNT(*)::int AS count FROM wa_simulated_provider_events WHERE event_type='template_status'");
    const pausedError=await request(`/crm/whatsapp-workspace/template-versions/${pausedTemplate.version.id}/simulated-submit`,{method:'POST',as:'manager',status:409,body:{outcome:'approved'}});
    assert.match(pausedError.error,/template is paused/i);
    const afterTemplateEvents=await db.one("SELECT COUNT(*)::int AS count FROM wa_simulated_provider_events WHERE event_type='template_status'");
    assert.equal(afterTemplateEvents.count,beforeTemplateEvents.count);
    await setFault('none');

    // 7. Reply and CTWA pricing windows at all maintained boundaries.
    const windows=new Map([[23,[true,true]],[25,[false,true]],[71,[false,true]],[73,[false,false]]]);
    for(const [hours,[replyWindowOpen,ctwaFreeWindowOpen]] of windows){
      await request(`/admin/whatsapp-simulation/conversations/${ctwa.conversationId}/backdate`,{method:'POST',body:{hours}});
      const detail=await request(`/crm/whatsapp-workspace/conversations/${ctwa.conversationId}`,{as:'agent'});
      assert.equal(detail.conversation.replyWindowOpen,replyWindowOpen,`${hours}h reply window`);
      assert.equal(detail.conversation.ctwaFreeWindowOpen,ctwaFreeWindowOpen,`${hours}h CTWA window`);
    }

    // 8. Run cleanup and global cleanup leave no simulated runtime records.
    const run=await request('/admin/whatsapp-simulation/runs',{method:'POST',status:201,body:{seed:`dev263-cleanup-${runKey}`,conversations:1,messages:0,optOuts:0,rate:5,configuration:{}}});
    created.runs.push(run.run.id);
    const runInbound=await request('/admin/whatsapp-simulation/inbound',{method:'POST',status:202,body:{from:syntheticPhone(4),name:'Synthetic Cleanup',teamId:team,agentId:people.agent,text:'cleanup me',eventId:`${runKey}-run-cleanup`,simulationRunId:run.run.id}});
    assert.ok(runInbound.conversationId);
    const runCleanup=await request(`/admin/whatsapp-simulation/runs/${run.run.id}/cleanup`,{method:'POST',body:{}});
    assert.equal(runCleanup.cleanup.conversations,1);
    assert.equal((await db.one('SELECT status FROM wa_simulation_runs WHERE id=$1',[run.run.id])).status,'cleaned');
    const cleanup=await request('/admin/whatsapp-simulation/cleanup',{method:'POST',body:{}});
    assert.ok(cleanup.cleanup.conversations>=4);
    assert.equal((await db.one('SELECT COUNT(*)::int AS count FROM wa_conversations WHERE simulated=TRUE')).count,0);
    assert.equal((await db.one('SELECT COUNT(*)::int AS count FROM wa_conversation_messages WHERE simulated=TRUE')).count,0);
    assert.equal((await db.one("SELECT COUNT(*)::int AS count FROM wa_message_template_versions WHERE simulated_provider_status<>'not_submitted'")).count,0);
  }finally{
    if(server){server.close();server.closeAllConnections?.();}
    await db.execute("UPDATE wa_simulated_provider_control SET paused=TRUE,fault_mode='none',updated_by=NULL,updated_at=NOW() WHERE singleton=TRUE").catch(()=>{});
    await db.execute("DELETE FROM wa_contact_suppressions WHERE normalized_phone LIKE '+971509%'").catch(()=>{});
    for(const campaignId of created.campaigns){
      await db.execute('DELETE FROM wa_campaign_approval_recipients WHERE campaign_id=$1',[campaignId]).catch(()=>{});
      await db.execute('DELETE FROM wa_campaign_materials WHERE campaign_id=$1',[campaignId]).catch(()=>{});
      await db.execute('DELETE FROM wa_campaign_revisions WHERE campaign_id=$1',[campaignId]).catch(()=>{});
      await db.execute('DELETE FROM wa_campaign_drafts WHERE id=$1',[campaignId]).catch(()=>{});
    }
    for(const segmentId of created.segments)await db.execute('DELETE FROM wa_audience_segments WHERE id=$1',[segmentId]).catch(()=>{});
    for(const batchId of created.batches){await db.execute('DELETE FROM wa_campaign_recipients WHERE batch_id=$1',[batchId]).catch(()=>{});await db.execute('DELETE FROM wa_recipient_import_batches WHERE id=$1',[batchId]).catch(()=>{});}
    for(const templateId of created.templates){await db.execute('DELETE FROM wa_message_template_versions WHERE template_id=$1',[templateId]).catch(()=>{});await db.execute('DELETE FROM wa_message_templates WHERE id=$1',[templateId]).catch(()=>{});}
    for(const runId of created.runs)await db.execute('DELETE FROM wa_simulation_runs WHERE id=$1',[runId]).catch(()=>{});
    await db.execute('DELETE FROM wa_campaign_audit WHERE actor_id=ANY($1::uuid[])',[Object.values(people)]).catch(()=>{});
    await db.execute('DELETE FROM audit_log WHERE performed_by=ANY($1::uuid[])',[Object.values(people)]).catch(()=>{});
    await db.execute('DELETE FROM sessions WHERE broker_id=ANY($1::uuid[])',[Object.values(people)]).catch(()=>{});
    await db.execute('DELETE FROM team_memberships WHERE team_id=$1',[team]).catch(()=>{});
    await db.execute('UPDATE brokers SET team_id=NULL WHERE id=ANY($1::uuid[])',[Object.values(people)]).catch(()=>{});
    await db.execute('DELETE FROM teams WHERE id=$1',[team]).catch(()=>{});
    await db.execute('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[Object.values(people)]).catch(()=>{});
    // The governed release runner executes integration files in one process.
    // Leave the shared singleton pool open for the remaining files; the
    // process closes its idle clients after the configured test timeout.
  }
});
