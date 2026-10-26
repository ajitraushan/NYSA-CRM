import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {assertDedicatedFixture} from '../tools/local-postgres-fixture/fixture-guard.mjs';

const enabled=process.env.NYSA_RUN_CUSTOMER_REQUIREMENT_DB_INTEGRATION==='1';
test('customer requirement HTTP saves persist and audit both identity kinds', {skip:!enabled,timeout:30000}, async t=>{
  assert.ok(['localhost','127.0.0.1','::1'].includes(process.env.PGHOST));
  const database=await import('../src/db.js');
  await assertDedicatedFixture(database.db);
  const {createApp}=await import('../src/lib/http-kit.js');
  const {default:routes}=await import('../src/routes/document-compliance.js');
  const broker=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex'),codes=[];
  let server;
  try {
    await database.execute("INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES($1,'Synthetic requirement admin',$2,'admin','active','fixture-only','admin')",[broker,`${broker}@example.invalid`]);
    await database.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(token).digest('hex'),broker]);
    const app=createApp();app.mount('/api',routes);
    server=await new Promise(resolve=>{const s=app.listen(0,()=>resolve(s));});
    const request=async(body,auth=true,path='/admin/customer-document-requirements')=>{
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
      return {status:response.status,body:await response.json()};
    };
    for(const kind of ['individual','organization'])await t.test(kind,async()=>{
      const code=`fixture_${kind}_${broker.replaceAll('-','')}`;codes.push(code);
      const groups=kind==='individual'?[['passport','emirates_id']]:[['trade_license','certificate_of_incorporation'],['memorandum_of_association'],['power_of_attorney']];
      const body={requirementCode:code,label:'Synthetic identity requirement',businessReason:'Synthetic route database regression only',customerKind:kind,acceptedDocumentTypes:[...new Set([...groups.flat(),'power_of_attorney'])],requiredDocumentGroups:groups,minimumValidDocuments:groups.length,reviewRequired:true,expiryRequired:true,reminderOffsetsDays:[0,7,14,30],effectiveFrom:'2026-10-08T00:00:00Z'};
      assert.equal((await request(body,false)).status,401);
      await database.execute("UPDATE brokers SET role='internal_broker',job_role='sales_agent' WHERE id=$1",[broker]);
      assert.equal((await request(body)).status,403);
      await database.execute("UPDATE brokers SET role='admin',job_role='admin' WHERE id=$1",[broker]);
      assert.equal((await request({...body,requiredDocumentGroups:[]})).status,400);
      const saved=await request(body);assert.equal(saved.status,201,JSON.stringify(saved.body));
      const row=await database.one('SELECT * FROM customer_document_requirement_versions WHERE id=$1',[saved.body.version.id]);
      assert.equal(row.customerKind,kind);assert.equal(row.status,'draft');assert.equal(row.versionNumber,1);
      assert.deepEqual(row.requiredDocumentGroups,groups);assert.deepEqual(row.acceptedDocumentTypes,body.acceptedDocumentTypes);
      assert.equal(row.minimumValidDocuments,groups.length);assert.equal(row.createdBy,broker);
      assert.equal((await database.one("SELECT COUNT(*)::int AS count FROM audit_log WHERE entity_id=$1 AND action='draft_created'",[row.id])).count,1);
      assert.equal((await request(body)).status,409);
      assert.equal((await database.one('SELECT COUNT(*)::int AS count FROM customer_document_requirement_versions WHERE requirement_code=$1',[code])).count,1);
      assert.equal((await request({},true,`/admin/customer-document-requirement-versions/${row.id}/activate`)).status,200);
      const revision=await request(body);assert.equal(revision.status,201);assert.equal(revision.body.version.versionNumber,2);assert.equal(revision.body.version.supersedesVersionId,row.id);
      assert.equal((await request({},true,`/admin/customer-document-requirement-versions/${revision.body.version.id}/activate`)).status,200);
      assert.equal((await database.one('SELECT status FROM customer_document_requirement_versions WHERE id=$1',[row.id])).status,'superseded');
      assert.equal((await request({reason:'Synthetic retirement regression'},true,`/admin/customer-document-requirement-versions/${revision.body.version.id}/retire`)).status,200);
    });
    await t.test('audit allow-list retains restrictions and supports identity entities',async()=>{
      const client=await database.db.connect();
      try {
        const constraintSql="SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check'";
        const before=(await client.query(constraintSql)).rows[0].definition;
        await client.query('BEGIN');
        await client.query(await fs.readFile(new URL('../src/migrations/134_customer_identity_audit_types.sql',import.meta.url),'utf8'));
        for(const type of ['CustomerIdentityDocument','CompanyIdentityDocument','Contact'])await database.audit(type,crypto.randomUUID(),'fixture_check',broker,null,client);
        await client.query('SAVEPOINT unsupported');
        await assert.rejects(database.audit('UnsupportedSyntheticEntity',crypto.randomUUID(),'fixture_check',broker,null,client),error=>error.code==='23514'&&error.constraint==='audit_log_entity_type_check');
        await client.query('ROLLBACK TO SAVEPOINT unsupported');
        await client.query('ROLLBACK');
        assert.equal((await client.query(constraintSql)).rows[0].definition,before,'Transactional rollback restores the constraint');
      } finally {await client.query('ROLLBACK');client.release();}
    });
  } finally {
    if(server){await new Promise(resolve=>server.close(resolve));server.closeAllConnections?.();}
    await database.execute('DELETE FROM audit_log WHERE performed_by=$1',[broker]);
    await database.execute('UPDATE customer_document_requirement_versions SET supersedes_version_id=NULL WHERE requirement_code=ANY($1::text[])',[codes]);
    await database.execute('DELETE FROM customer_document_requirement_versions WHERE requirement_code=ANY($1::text[])',[codes]);
    await database.execute('DELETE FROM sessions WHERE broker_id=$1',[broker]);
    await database.execute('DELETE FROM brokers WHERE id=$1',[broker]);
    await database.closeDatabase();
  }
});
