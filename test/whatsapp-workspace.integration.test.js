import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_WA_STAGE_B_DB_TEST==='local-synthetic';
const uuid=()=>crypto.randomUUID();

test('WA-001 Stage B number-independent workspaces on guarded PostgreSQL fixture',{skip:!enabled,timeout:120000},async()=>{
  assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
  assert.equal(process.env.PGUSER,'nysa_test_user');
  assert.ok(['127.0.0.1','localhost'].includes(process.env.PGHOST));
  const db=await import('../src/db.js');
  const {createApp}=await import('../src/lib/http-kit.js');
  const {default:routes}=await import('../src/routes/whatsapp-workspace.js');
  const people={agent:uuid(),manager:uuid(),director:uuid(),outside:uuid()};
  const teams={main:uuid(),outside:uuid()};
  const tokens=Object.fromEntries(Object.keys(people).map(role=>[role,crypto.randomBytes(32).toString('hex')]));
  const ids={template:null,version:null,batch:null,segment:null,material:null,campaign:null};
  const prefix=`Synthetic WA ${crypto.randomBytes(5).toString('hex')}`;
  const suppressedPhone='+971500000742',dncrPhone='+971500000743';
  let server;
  try{
    for(const [role,id] of Object.entries(people)){
      const jobRole=role==='agent'||role==='outside'?'sales_agent':role;
      await db.execute(`INSERT INTO brokers(id,name,email,role,job_role,status,password_hash)
        VALUES($1,$2,$3,'internal_broker',$4,'active','synthetic-only')`,[id,`${prefix} ${role}`,`${prefix.replaceAll(' ','-').toLowerCase()}-${role}@example.invalid`,jobRole]);
      await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(tokens[role]).digest('hex'),id]);
    }
    await db.execute('INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3),($4,$5,NULL)',[teams.main,`${prefix} main`,people.manager,teams.outside,`${prefix} outside`]);
    await db.execute('UPDATE brokers SET team_id=$1 WHERE id=$2',[teams.main,people.manager]);
    await db.execute('UPDATE brokers SET team_id=$1 WHERE id=$2',[teams.outside,people.outside]);
    await db.execute("INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'member',$4)",[uuid(),teams.main,people.agent,people.manager]);
    await db.execute("INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'manager',$3)",[uuid(),teams.main,people.manager]);

    const app=createApp();app.mount('/api',routes);
    server=await new Promise((resolve,reject)=>{const listening=app.listen({port:0,host:'127.0.0.1'},()=>resolve(listening));listening.once('error',reject);});
    const request=async(path,{method='GET',body,as='agent',status=200}={})=>{
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{authorization:`Bearer ${tokens[as]}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
      const data=await response.json();
      assert.equal(response.status,status,JSON.stringify({path,method,as,data}));
      return data;
    };

    const initial=await request('/crm/whatsapp-workspace');
    assert.equal(initial.provider.status,'Not submitted');
    assert.equal(initial.provider.submissionEnabled,false);
    assert.equal(initial.provider.sendingEnabled,false);
    assert.deepEqual(initial.teams.map(item=>item.id),[teams.main]);

    const templateBody={teamId:teams.main,name:`synthetic_${crypto.randomBytes(6).toString('hex')}_launch`,languageCode:'en',category:'marketing',headerType:'text',headerText:'NYSA update',bodyText:'Hello {{first_name}}, view our latest properties.',footerText:'Reply STOP to opt out',variableNames:['first_name'],variableSamples:{first_name:'Amal'},buttons:[{type:'quick_reply',text:'Talk to an agent'},{type:'url',text:'View project',url:'https://nysarealty.com/go/{{1}}',sampleValue:'synthetic_project'}]};
    const created=await request('/crm/whatsapp-workspace/templates',{method:'POST',body:templateBody,status:201});
    ids.template=created.template.id;ids.version=created.version.id;
    assert.equal(created.version.metaStatus,'not_submitted');
    await request(`/crm/whatsapp-workspace/template-versions/${ids.version}/submit`,{method:'POST',body:{}});
    const managerQueue=await request('/crm/whatsapp-workspace',{as:'manager'});
    assert.equal(managerQueue.reviewQueue.templates.length,1);
    assert.equal(managerQueue.reviewQueue.templates[0].metaStatusLabel,'Not submitted');
    const approved=await request(`/crm/whatsapp-workspace/template-versions/${ids.version}/decision`,{method:'POST',as:'manager',body:{decision:'approve'}});
    assert.equal(approved.version.internalStatus,'approved');
    assert.equal(approved.version.metaStatus,'not_submitted');

    const {recordContactSuppression}=await import('../src/contact-suppression.js');
    await db.transaction(client=>recordContactSuppression({phone:suppressedPhone,type:'opt_out',evidenceReference:'dev267-existing-stop',actorId:people.agent},client));
    await request('/crm/whatsapp-workspace/recipient-suppressions/dncr',{method:'POST',as:'agent',status:403,body:{phone:dncrPhone,action:'record',evidenceReference:'DEV267A-AGENT-DNCR'}});
    const dncrRecord=await request('/crm/whatsapp-workspace/recipient-suppressions/dncr',{method:'POST',as:'manager',status:201,body:{phone:dncrPhone,action:'record',evidenceReference:'DEV267A-MANUAL-DNCR'}});assert.equal(dncrRecord.strongest,'dncr');
    const rows=[
      {name:'Synthetic Prospect One',phone:'+971500000741',email:'prospect-one@example.invalid',source:'synthetic_test',consentStatus:'verified',consentEvidenceRef:'synthetic-consent-1',tags:['investor'],requirements:{areas:['Dubai Marina'],businessType:'Sale',budgetMax:2500000}},
      {name:'Synthetic Prospect Duplicate',phone:'+971500000741',email:'prospect-two@example.invalid',source:'synthetic_test',consentStatus:'evidence_pending',tags:['investor']},
      {name:'Synthetic Existing Stop',phone:suppressedPhone,email:'prospect-stop@example.invalid',source:'synthetic_test',consentStatus:'verified',consentEvidenceRef:'later-import-evidence',tags:['investor']},
      {name:'Synthetic Manual DNCR',phone:dncrPhone,email:'prospect-dncr@example.invalid',source:'synthetic_test',consentStatus:'verified',consentEvidenceRef:'dncr-import-evidence',tags:['investor']}
    ];
    const source={sourceType:'event'};
    const preview=await request('/crm/whatsapp-workspace/recipient-imports/preview',{method:'POST',body:{teamId:teams.main,originalFileName:'synthetic-recipients.csv',rows,...source}});
    assert.deepEqual(preview.counts,{ready:1,review_required:1,invalid:0,suppressed:2});
    assert.equal(preview.rows.find(row=>row.phone===suppressedPhone).suppressionType,'opt_out');
    assert.equal(preview.rows.find(row=>row.phone===dncrPhone).suppressionType,'dncr');
    const committed=await request('/crm/whatsapp-workspace/recipient-imports/commit',{method:'POST',status:201,body:{teamId:teams.main,originalFileName:'synthetic-recipients.csv',rows,...source,previewHash:preview.previewHash,reviewToken:preview.reviewToken,decisions:[{rowNumber:2,disposition:'excluded'}]}});
    ids.batch=committed.batch.id;assert.equal(committed.includedCount,1);assert.equal(committed.retainedSuppressedCount,2);
    const retained=await db.one('SELECT suppression_status,suppression_reason FROM wa_campaign_recipients WHERE batch_id=$1 AND normalized_phone=$2',[ids.batch,suppressedPhone]);
    assert.deepEqual(retained,{suppressionStatus:'suppressed',suppressionReason:'opt_out'});

    const segment=await request('/crm/whatsapp-workspace/segments',{method:'POST',status:201,body:{teamId:teams.main,name:`${prefix} consented`,description:'Synthetic verified recipients',definition:{batchIds:[ids.batch],consentStatus:'verified',tagsAny:['investor']}}});
    ids.segment=segment.segment.id;
    const material=await request('/crm/whatsapp-workspace/materials',{method:'POST',status:201,body:{teamId:teams.main,title:`${prefix} brochure`,materialType:'brochure',description:'Synthetic metadata-only catalogue item'}});
    ids.material=material.material.id;assert.equal(Object.hasOwn(material.material,'storageKey'),false);assert.equal(material.material.hasFile,false);

    const campaign=await request('/crm/whatsapp-workspace/campaigns',{method:'POST',status:201,body:{teamId:teams.main,name:`${prefix} campaign`,purpose:'Synthetic approval-flow verification only',segmentId:ids.segment,templateVersionId:ids.version,materialIds:[ids.material],scheduledAt:'2026-11-24T10:00:00+04:00',budgetAed:500}});
    ids.campaign=campaign.campaign.id;
    const campaignPreview=await request(`/crm/whatsapp-workspace/campaigns/${ids.campaign}/preview`);
    assert.equal(campaignPreview.preview.totalUniquePhones,1);
    assert.equal(campaignPreview.preview.eligibleCount,1);
    await request(`/crm/whatsapp-workspace/campaigns/${ids.campaign}/submit`,{method:'POST',body:{}});
    const review=await request('/crm/whatsapp-workspace',{as:'manager'});
    assert.equal(review.reviewQueue.campaigns.length,1);
    assert.equal(review.reviewQueue.campaigns[0].metaStatusLabel,'Not submitted');
    const campaignApproval=await request(`/crm/whatsapp-workspace/campaigns/${ids.campaign}/decision`,{method:'POST',as:'manager',body:{decision:'approve'}});
    assert.equal(campaignApproval.campaign.status,'approved');
    assert.equal(campaignApproval.approval.recipientCount,1);
    const dncrRelease=await request('/crm/whatsapp-workspace/recipient-suppressions/dncr',{method:'POST',as:'director',body:{phone:dncrPhone,action:'release',reason:'Director verified that the manual DNCR evidence was recorded in error'}});assert.equal(dncrRelease.strongest,null);
    const postReleasePreview=await request('/crm/whatsapp-workspace/recipient-imports/preview',{method:'POST',body:{teamId:teams.main,originalFileName:'synthetic-dncr-release.csv',rows:[{name:'Synthetic Manual DNCR',phone:dncrPhone,source:'synthetic_test',consentStatus:'verified',consentEvidenceRef:'post-release-evidence'}],...source}});assert.notEqual(postReleasePreview.rows[0].action,'suppressed');
    const dncrAudits=await db.many("SELECT action FROM audit_log WHERE performed_by=ANY($1::uuid[]) AND action IN('manual_dncr_recorded','manual_dncr_released') ORDER BY timestamp",[[people.manager,people.director]]);assert.deepEqual(dncrAudits.map(row=>row.action),['manual_dncr_recorded','manual_dncr_released']);

    const finalAgent=await request('/crm/whatsapp-workspace');
    assert.equal(finalAgent.templates.length,1);
    assert.equal(finalAgent.templates[0].metaStatusLabel,'Not submitted');
    assert.equal(finalAgent.segments[0].recipientCount,1);
    assert.equal(finalAgent.campaigns[0].status,'approved');
    assert.equal(finalAgent.campaigns[0].materialCount,1);
    assert.equal(Object.hasOwn(finalAgent.materials[0],'storageKey'),false);
    const retired=await request(`/crm/whatsapp-workspace/campaigns/${ids.campaign}/retire`,{method:'POST',as:'manager',body:{reason:'Campaign approval is no longer required'}});assert.equal(retired.campaign.status,'retired');
    await request(`/crm/whatsapp-workspace/campaigns/${ids.campaign}/submit`,{method:'POST',status:409,body:{}});
    await request(`/crm/whatsapp-workspace/campaigns/${ids.campaign}`,{method:'PATCH',status:409,body:{teamId:teams.main,name:`${prefix} retired edit`,purpose:'Retired campaign must remain immutable',segmentId:ids.segment,templateVersionId:ids.version,materialIds:[ids.material],scheduledAt:'2026-11-25T10:00:00+04:00',budgetAed:600}});
    const retirementAudit=await db.one("SELECT details FROM audit_log WHERE entity_type='WhatsAppCampaign' AND entity_id=$1 AND action='retired' ORDER BY timestamp DESC LIMIT 1",[ids.campaign]);assert.equal(JSON.parse(retirementAudit.details).priorStatus,'approved');
    const retiredMaterial=await request(`/crm/whatsapp-workspace/materials/${ids.material}/retire`,{method:'POST',body:{}});assert.equal(Object.hasOwn(retiredMaterial.material,'storageKey'),false);assert.equal(retiredMaterial.material.hasFile,false);
    const director=await request('/crm/whatsapp-workspace',{as:'director'});
    assert.ok(director.templates.some(item=>item.id===ids.template));
    const outside=await request('/crm/whatsapp-workspace',{as:'outside'});
    assert.equal(outside.templates.length,0);
    await request('/crm/whatsapp-workspace/templates',{method:'POST',as:'outside',status:403,body:{...templateBody,teamId:teams.main,name:`synthetic_forbidden_${crypto.randomBytes(4).toString('hex')}`}});
    await request(`/crm/whatsapp-workspace/campaigns/${ids.campaign}/send`,{method:'POST',body:{},status:404});
  }finally{
    if(server){server.close();server.closeAllConnections?.();}
    const entityIds=Object.values(ids).filter(Boolean);
    if(entityIds.length)await db.execute('DELETE FROM wa_campaign_audit WHERE entity_id=ANY($1::uuid[])',[entityIds]);
    if(ids.campaign){await db.execute('DELETE FROM wa_campaign_approval_recipients WHERE campaign_id=$1',[ids.campaign]);await db.execute('DELETE FROM wa_campaign_materials WHERE campaign_id=$1',[ids.campaign]);await db.execute('DELETE FROM wa_campaign_revisions WHERE campaign_id=$1',[ids.campaign]);await db.execute('DELETE FROM wa_campaign_drafts WHERE id=$1',[ids.campaign]);}
    if(ids.segment)await db.execute('DELETE FROM wa_audience_segments WHERE id=$1',[ids.segment]);
    if(ids.batch){await db.execute('DELETE FROM wa_campaign_recipients WHERE batch_id=$1',[ids.batch]);await db.execute('DELETE FROM wa_recipient_import_batches WHERE id=$1',[ids.batch]);}
    if(ids.material)await db.execute('DELETE FROM wa_material_catalogue WHERE id=$1',[ids.material]);
    if(ids.template){await db.execute('DELETE FROM wa_message_template_versions WHERE template_id=$1',[ids.template]);await db.execute('DELETE FROM wa_message_templates WHERE id=$1',[ids.template]);}
    await db.execute("DELETE FROM wa_contact_suppressions WHERE normalized_phone=ANY($1::text[])",[[suppressedPhone,dncrPhone]]);
    await db.execute('DELETE FROM audit_log WHERE performed_by=ANY($1::uuid[])',[Object.values(people)]);
    await db.execute('DELETE FROM sessions WHERE broker_id=ANY($1::uuid[])',[Object.values(people)]);
    await db.execute('DELETE FROM team_memberships WHERE team_id=ANY($1::uuid[])',[Object.values(teams)]);
    await db.execute('UPDATE brokers SET team_id=NULL WHERE id=ANY($1::uuid[])',[Object.values(people)]);
    await db.execute('DELETE FROM teams WHERE id=ANY($1::uuid[])',[Object.values(teams)]);
    await db.execute('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[Object.values(people)]);
    await db.closeDatabase();
  }
});
