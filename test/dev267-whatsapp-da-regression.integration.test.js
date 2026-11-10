import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

const enabled=process.env.NYSA_DEV267_DA_TEST==='local-synthetic';
const uuid=()=>crypto.randomUUID();

test('DEV267 D-A: STOP before later import remains suppressed at preview and commit',{skip:!enabled,timeout:120000},async()=>{
  assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
  assert.equal(process.env.PGUSER,'nysa_test_user');
  const db=await import('../src/db.js');
  const {createApp}=await import('../src/lib/http-kit.js');
  const {default:workspace}=await import('../src/routes/whatsapp-workspace.js');
  const {recordContactSuppression}=await import('../src/contact-suppression.js');
  const actor=uuid(),team=uuid(),token=crypto.randomBytes(32).toString('hex');
  const phone=`+97159${String(crypto.randomBytes(4).readUInt32BE()%9000000+1000000)}`;
  let server,batchId;
  try{
    await db.execute("INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES($1,'DEV267 D-A Agent',$2,'internal_broker','sales_agent','active','x')",[actor,`dev267-da-${actor}@example.invalid`]);
    await db.execute('INSERT INTO teams(id,name) VALUES($1,$2)',[team,`DEV267 D-A ${team}`]);
    await db.execute("INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'member',$3)",[uuid(),team,actor]);
    await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(token).digest('hex'),actor]);
    await db.transaction(client=>recordContactSuppression({phone,type:'opt_out',evidenceReference:'DEV267-DA-STOP-BEFORE-IMPORT',actorId:actor},client));

    const app=createApp();app.mount('/api',workspace);
    server=await new Promise((resolve,reject)=>{const listening=app.listen({host:'127.0.0.1',port:0},()=>resolve(listening));listening.once('error',reject);});
    const request=async(path,{method='POST',body,status=200}={})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)}),data=await response.json();assert.equal(response.status,status,JSON.stringify({path,status:response.status,data}));return data;};
    const body={teamId:team,originalFileName:'dev267-da.csv',sourceType:'event',rows:[{name:'Existing STOP recipient',phone,email:'dev267-da@example.invalid',consentStatus:'verified',consentEvidenceRef:'later-file-consent'}]};
    const preview=await request('/crm/whatsapp-workspace/recipient-imports/preview',{body});
    assert.deepEqual(preview.counts,{ready:0,review_required:0,invalid:0,suppressed:1});
    assert.equal(preview.rows[0].action,'suppressed');
    assert.equal(preview.rows[0].suppressionType,'opt_out');
    const committed=await request('/crm/whatsapp-workspace/recipient-imports/commit',{status:201,body:{...body,previewHash:preview.previewHash,reviewToken:preview.reviewToken}});
    batchId=committed.batch.id;
    assert.equal(committed.includedCount,0);
    assert.equal(committed.retainedSuppressedCount,1);
    const row=await db.one('SELECT suppression_status,suppression_reason,consent_status FROM wa_campaign_recipients WHERE batch_id=$1',[batchId]);
    assert.deepEqual(row,{suppressionStatus:'suppressed',suppressionReason:'opt_out',consentStatus:'withdrawn'});
  }finally{
    if(server){server.close();server.closeAllConnections?.();}
    if(batchId){await db.execute('DELETE FROM wa_campaign_recipients WHERE batch_id=$1',[batchId]).catch(()=>{});await db.execute('DELETE FROM wa_recipient_import_batches WHERE id=$1',[batchId]).catch(()=>{});}
    await db.execute('DELETE FROM wa_contact_suppressions WHERE normalized_phone=$1',[phone]).catch(()=>{});
    await db.execute('DELETE FROM audit_log WHERE performed_by=$1',[actor]).catch(()=>{});
    await db.execute('DELETE FROM sessions WHERE broker_id=$1',[actor]).catch(()=>{});
    await db.execute('DELETE FROM team_memberships WHERE team_id=$1',[team]).catch(()=>{});
    await db.execute('DELETE FROM teams WHERE id=$1',[team]).catch(()=>{});
    await db.execute('DELETE FROM brokers WHERE id=$1',[actor]).catch(()=>{});
  }
});
