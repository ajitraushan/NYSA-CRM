import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

const enabled=process.env.NYSA_DEV267_SHARED_SUPPRESSION_TEST==='local-synthetic';
const uuid=()=>crypto.randomUUID();

test('DEV267 layered restrictions serialize, preserve weaker restrictions and require governed release evidence',{skip:!enabled,timeout:120000},async()=>{
  assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
  assert.equal(process.env.PGUSER,'nysa_test_user');
  const db=await import('../src/db.js');
  const suppression=await import('../src/contact-suppression.js');
  const actors={agent:uuid(),manager:uuid(),director:uuid()};
  const phone=`+97158${String(crypto.randomBytes(4).readUInt32BE()%9000000+1000000)}`;
  try{
    await db.execute(`INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES
      ($1,'DEV267 suppression agent',$2,'internal_broker','sales_agent','active','x'),
      ($3,'DEV267 suppression manager',$4,'internal_broker','manager','active','x'),
      ($5,'DEV267 suppression director',$6,'internal_broker','director','active','x')`,[
      actors.agent,`dev267-suppression-agent-${actors.agent}@example.invalid`,
      actors.manager,`dev267-suppression-manager-${actors.manager}@example.invalid`,
      actors.director,`dev267-suppression-director-${actors.director}@example.invalid`
    ]);

    await Promise.all([
      db.transaction(client=>suppression.recordContactSuppression({phone,type:'opt_out',evidenceReference:'DEV267-OPT',actorId:actors.agent},client)),
      db.transaction(client=>suppression.recordContactSuppression({phone,type:'wrong_number',evidenceReference:'DEV267-WRONG',actorId:actors.manager},client))
    ]);
    let state=await suppression.getContactSuppression(phone);
    assert.equal(state.strongest,'wrong_number');
    assert.deepEqual(Object.keys(state.restrictions).sort(),['opt_out','wrong_number']);
    assert.equal(suppression.blocksOutbound(state),true);

    await assert.rejects(
      db.transaction(client=>suppression.releaseContactSuppression({phone,type:'wrong_number',reason:'Agent cannot release',actorId:actors.agent,actorRole:'sales_agent'},client)),
      /Manager or Director/
    );
    const released=await db.transaction(client=>suppression.releaseContactSuppression({phone,type:'wrong_number',reason:'Manager verified corrected number evidence',actorId:actors.manager,actorRole:'manager'},client));
    assert.equal(released.strongest,'opt_out');
    state=await suppression.getContactSuppression(phone);
    assert.equal(state.strongest,'opt_out');
    assert.equal(state.restrictions.opt_out.active,true);

    await assert.rejects(
      db.transaction(client=>suppression.releaseContactSuppression({phone,type:'opt_out',reason:'Customer changed mind',actorId:actors.director,actorRole:'director'},client)),
      /new customer consent evidence/
    );
    const consentRecordedAt=new Date(Date.parse(state.restrictions.opt_out.recordedAt)+1000).toISOString();
    const consentRelease=await db.transaction(client=>suppression.releaseContactSuppression({phone,type:'opt_out',reason:'Customer provided new written consent',actorId:actors.director,actorRole:'director',consentEvidenceReference:'DEV267-CONSENT-NEW',consentRecordedAt},client));
    assert.equal(consentRelease.strongest,null);
    assert.equal((await suppression.getContactSuppression(phone)).blocked,false);
  }finally{
    await db.execute('DELETE FROM wa_contact_suppressions WHERE normalized_phone=$1',[phone]).catch(()=>{});
    await db.execute('DELETE FROM audit_log WHERE performed_by=ANY($1::uuid[])',[Object.values(actors)]).catch(()=>{});
    await db.execute('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[Object.values(actors)]).catch(()=>{});
  }
});
