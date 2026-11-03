import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_WA_SIM_DB_TEST==='local-synthetic';
const uuid=()=>crypto.randomUUID();

test('DEV263 simulated provider uses in-process actions when the configured loopback port is unreachable',{skip:!enabled,timeout:120000},async()=>{
  assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
  assert.equal(process.env.PGUSER,'nysa_test_user');
  assert.ok(['127.0.0.1','localhost'].includes(process.env.PGHOST));
  process.env.LEAD_RESPONSE_ENVIRONMENT='crm-test';
  process.env.WHATSAPP_SIMULATED_PROVIDER_ENABLED='true';
  process.env.WHATSAPP_SIMULATED_PROVIDER_TOKEN='local-synthetic-dev262-token-at-least-32';
  const db=await import('../src/db.js'),{createApp}=await import('../src/lib/http-kit.js');
  const {default:workspace}=await import('../src/routes/whatsapp-workspace.js');
  const {createWhatsAppSimulatedProviderRoutes,createWhatsAppSimulationControlRoutes}=await import('../src/routes/whatsapp-simulated-provider.js');
  const people={admin:uuid(),agent:uuid(),manager:uuid()},team=uuid(),tokens=Object.fromEntries(Object.keys(people).map(role=>[role,crypto.randomBytes(32).toString('hex')]));
  const created={templates:[],conversations:[],runs:[]};
  let server;
  const request=async(path,{method='GET',body,as='admin',status=200,auth=true}={})=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{...(auth?{authorization:`Bearer ${tokens[as]}`}:{'x-nysa-simulation-token':process.env.WHATSAPP_SIMULATED_PROVIDER_TOKEN}),'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await response.json();assert.equal(response.status,status,JSON.stringify({path,method,as,data}));return data;
  };
  try{
    await db.migrate();
    await db.execute(`INSERT INTO brokers(id,name,email,role,job_role,status,password_hash)
      VALUES($1,'Synthetic DEV262 Admin',$2,'admin','admin','active','synthetic-only'),
      ($3,'Synthetic DEV262 Agent',$4,'internal_broker','sales_agent','active','synthetic-only'),
      ($5,'Synthetic DEV262 Manager',$6,'internal_broker','manager','active','synthetic-only')`,[people.admin,`dev262-admin-${people.admin}@example.invalid`,people.agent,`dev262-agent-${people.agent}@example.invalid`,people.manager,`dev262-manager-${people.manager}@example.invalid`]);
    await db.execute('INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)',[team,`Synthetic DEV262 ${team}`,people.manager]);
    await db.execute('UPDATE brokers SET team_id=$1 WHERE id=ANY($2::uuid[])',[team,[people.agent,people.manager]]);
    await db.execute("INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'member',$4),($5,$2,$4,'manager',$4)",[uuid(),team,people.agent,people.manager,uuid()]);
    for(const [role,id] of Object.entries(people))await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(tokens[role]).digest('hex'),id]);
    const app=createApp();app.mount('/api',workspace);app.mount('/api',createWhatsAppSimulatedProviderRoutes());app.mount('/api',createWhatsAppSimulationControlRoutes());
    server=await new Promise((resolve,reject)=>{const listening=app.listen({port:0,host:'127.0.0.1'},()=>resolve(listening));listening.once('error',reject);});
    process.env.PORT=String(server.address().port);process.env.WHATSAPP_SIMULATED_PROVIDER_URL='http://127.0.0.1:9/api/providers/whatsapp-simulated';
    await request('/admin/whatsapp-simulation/control',{method:'POST',body:{paused:false,faultMode:'none'}});
    const inbound=await request('/admin/whatsapp-simulation/inbound',{method:'POST',status:202,body:{from:'+971509000001',name:'Synthetic DEV262 Prospect',teamId:team,agentId:people.agent,text:'Please send details',ctwa:true,eventId:'dev262-inbound-1'}});
    assert.equal(inbound.simulation,true);assert.ok(inbound.conversationId);created.conversations.push(inbound.conversationId);
    const agentWorkspace=await request('/crm/whatsapp-workspace',{as:'agent'});assert.equal(agentWorkspace.provider.simulated,true);assert.equal(agentWorkspace.conversations[0].simulated,true);
    await request(`/crm/whatsapp-workspace/conversations/${inbound.conversationId}/simulated-send`,{method:'POST',as:'agent',status:202,body:{text:'Synthetic reply from CORE'}});
    await new Promise(resolve=>setTimeout(resolve,1500));
    const detail=await request(`/crm/whatsapp-workspace/conversations/${inbound.conversationId}`,{as:'agent'});
    assert.equal(detail.messages.at(-1).providerStatus,'read');assert.equal(detail.messages.at(-1).simulated,true);

    const template=await request('/crm/whatsapp-workspace/templates',{method:'POST',as:'manager',status:201,body:{teamId:team,name:`synthetic_dev262_${crypto.randomBytes(4).toString('hex')}`,languageCode:'en',category:'utility',headerType:'none',bodyText:'Synthetic appointment update'}});created.templates.push(template.template.id);
    await request(`/crm/whatsapp-workspace/template-versions/${template.version.id}/simulated-submit`,{method:'POST',as:'manager',status:202,body:{outcome:'approved'}});
    await new Promise(resolve=>setTimeout(resolve,1000));
    const templateRow=await db.one('SELECT simulated_provider_status FROM wa_message_template_versions WHERE id=$1',[template.version.id]);assert.equal(templateRow.simulatedProviderStatus,'approved');

    const duplicate={id:'dev262-duplicate',type:'inbound_message',simulation:true,from:'+971509000002',name:'Duplicate Synthetic',team_id:team,agent_id:people.agent,actor_id:people.admin,source_type:'other',text:'hello',occurred_at:new Date().toISOString()};
    const first=await request(`/providers/whatsapp-simulated/events/${process.env.WHATSAPP_SIMULATED_PROVIDER_TOKEN}`,{method:'POST',auth:false,status:202,body:duplicate});
    const replay=await request(`/providers/whatsapp-simulated/events/${process.env.WHATSAPP_SIMULATED_PROVIDER_TOKEN}`,{method:'POST',auth:false,status:200,body:duplicate});
    assert.equal(first.duplicate,false);assert.equal(replay.duplicate,true);created.conversations.push(first.conversationId);

    const stop=await request('/admin/whatsapp-simulation/inbound',{method:'POST',status:202,body:{from:'+971509000001',name:'Synthetic DEV262 Prospect',teamId:team,agentId:people.agent,text:'STOP',eventId:'dev262-stop-1'}});assert.equal(stop.suppressionType,'opt_out');
    const suppression=await db.one("SELECT suppression_type FROM wa_contact_suppressions WHERE normalized_phone='+971509000001'");assert.equal(suppression.suppressionType,'opt_out');
    await request(`/admin/whatsapp-simulation/conversations/${inbound.conversationId}/backdate`,{method:'POST',body:{hours:25}});
    const closed=await request(`/crm/whatsapp-workspace/conversations/${inbound.conversationId}`,{as:'agent'});assert.equal(closed.conversation.replyWindowOpen,false);

    await request('/admin/whatsapp-simulation/control',{method:'POST',body:{paused:false,faultMode:'rate_limited'}});
    await request(`/crm/whatsapp-workspace/conversations/${inbound.conversationId}/simulated-send`,{method:'POST',as:'agent',status:429,body:{templateVersionId:template.version.id}});
    await request('/admin/whatsapp-simulation/control',{method:'POST',body:{paused:false,faultMode:'none'}});
    const run=await request('/admin/whatsapp-simulation/runs',{method:'POST',status:201,body:{seed:'repeatable-dev262',conversations:1,messages:0,optOuts:0,rate:5,configuration:{teams:[{teamId:team,agentIds:[people.agent]},{teamId:team,agentIds:[people.agent]},{teamId:team,agentIds:[people.agent,people.agent,people.agent,people.agent,people.agent,people.agent,people.agent,people.agent]}]}}});created.runs.push(run.run.id);
    const runInbound=await request('/admin/whatsapp-simulation/inbound',{method:'POST',status:202,body:{from:'+971509000003',name:'Synthetic Cleanup',teamId:team,agentId:people.agent,text:'cleanup me',eventId:'dev262-run-1',simulationRunId:run.run.id}});created.conversations.push(runInbound.conversationId);
    const cleanup=await request(`/admin/whatsapp-simulation/runs/${run.run.id}/cleanup`,{method:'POST',body:{}});assert.equal(cleanup.cleanup.conversations,1);
  }finally{
    if(server){server.close();server.closeAllConnections?.();}
    await db.execute('UPDATE wa_simulated_provider_control SET paused=TRUE,fault_mode=\'none\',updated_by=NULL,updated_at=NOW() WHERE singleton=TRUE');
    await db.execute("DELETE FROM wa_contact_suppressions WHERE normalized_phone LIKE '+971509%'");
    await db.execute('DELETE FROM wa_simulated_provider_events WHERE actor_id=ANY($1::uuid[]) OR simulation_run_id=ANY($2::uuid[])',[Object.values(people),created.runs]);
    if(created.conversations.length){const linked=await db.many('SELECT lead_id,contact_id FROM wa_conversations WHERE id=ANY($1::uuid[])',[created.conversations]);await db.execute('DELETE FROM wa_conversations WHERE id=ANY($1::uuid[])',[created.conversations]);const leadIds=linked.map(item=>item.leadId).filter(Boolean),contactIds=linked.map(item=>item.contactId).filter(Boolean);if(leadIds.length)await db.execute('DELETE FROM leads WHERE id=ANY($1::uuid[])',[leadIds]);if(contactIds.length)await db.execute('DELETE FROM contacts WHERE id=ANY($1::uuid[])',[contactIds]);}
    const remainingContacts=await db.many("SELECT id FROM contacts WHERE created_by=ANY($1::uuid[]) AND notes LIKE 'DEV262 synthetic WhatsApp simulation record%'",[Object.values(people)]);
    if(remainingContacts.length){const contactIds=remainingContacts.map(item=>item.id);await db.execute('DELETE FROM wa_conversations WHERE contact_id=ANY($1::uuid[])',[contactIds]);await db.execute('DELETE FROM leads WHERE contact_id=ANY($1::uuid[])',[contactIds]);await db.execute('DELETE FROM contacts WHERE id=ANY($1::uuid[])',[contactIds]);}
    if(created.templates.length){await db.execute('DELETE FROM wa_message_template_versions WHERE template_id=ANY($1::uuid[])',[created.templates]);await db.execute('DELETE FROM wa_message_templates WHERE id=ANY($1::uuid[])',[created.templates]);}
    if(created.runs.length)await db.execute('DELETE FROM wa_simulation_runs WHERE id=ANY($1::uuid[])',[created.runs]);
    await db.execute('DELETE FROM wa_campaign_audit WHERE actor_id=ANY($1::uuid[])',[Object.values(people)]);
    await db.execute('DELETE FROM audit_log WHERE performed_by=ANY($1::uuid[])',[Object.values(people)]);
    await db.execute('DELETE FROM sessions WHERE broker_id=ANY($1::uuid[])',[Object.values(people)]);
    await db.execute('DELETE FROM team_memberships WHERE team_id=$1',[team]);await db.execute('UPDATE brokers SET team_id=NULL WHERE id=ANY($1::uuid[])',[Object.values(people)]);
    await db.execute('DELETE FROM teams WHERE id=$1',[team]);await db.execute('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[Object.values(people)]);
    await db.closeDatabase();
  }
});
