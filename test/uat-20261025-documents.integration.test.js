import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

test('DEF-137 query includes exact linked Offer issuances, preserves Opportunity issuances and excludes another Opportunity',{
  skip:process.env.NYSA_RUN_UAT_20261025_DB==='1'?false:'Requires restricted local synthetic fixture'
},async()=>{
  const {createFixturePool,assertDedicatedFixture}=await import('../tools/local-postgres-fixture/fixture-guard.mjs');
  const pool=createFixturePool();let client;
  try{
    await assertDedicatedFixture(pool);client=await pool.connect();await client.query('BEGIN');
    const rows=(await client.query(`SELECT DISTINCT ON(f.opportunity_id) f.id,f.opportunity_id,r.id AS revision_id,r.document_version_id,f.created_by
      FROM offers f JOIN offer_revisions r ON r.offer_id=f.id ORDER BY f.opportunity_id,r.revision_number DESC LIMIT 2`)).rows;
    assert.equal(rows.length,2,'Synthetic fixture needs Offers on two Opportunities');
    const spareVersion=(await client.query('SELECT id FROM document_versions WHERE id<>ALL($1::uuid[]) LIMIT 1',[rows.map(r=>r.document_version_id)])).rows[0];
    assert.ok(spareVersion,'Synthetic fixture needs an independent document version');
    const ids=[];
    for(const [offer,entityType,code] of [[rows[0],'Offer','offer_letter'],[rows[0],'Opportunity','viewing_confirmation'],[rows[1],'Offer','offer_letter']]){
      const id=crypto.randomUUID();ids.push(id);
      await client.query(`INSERT INTO approved_document_issuances(id,document_code,template_version,template_hash,data_snapshot,data_hash,document_version_id,pdf_hash,source_entity_type,source_entity_id,issued_by,idempotency_key)
        VALUES($1,$2,'SYNTHETIC-TEST',$3,'{}'::jsonb,$3,$4,$3,$5,$6,$7,$8)`,[id,code,'0'.repeat(64),entityType==='Opportunity'?spareVersion.id:offer.document_version_id,entityType,entityType==='Offer'?offer.id:offer.opportunity_id,offer.created_by,id]);
    }
    const source=fs.readFileSync(new URL('../src/routes/approved-documents.js',import.meta.url),'utf8'),start=source.indexOf('SELECT i.*,dv.file_name,f.offer_reference'),end=source.indexOf('`',start),sql=source.slice(start,end);
    const result=(await client.query(sql,[rows[0].opportunity_id])).rows;
    assert.ok(result.some(r=>r.id===ids[0]&&r.revision_number));assert.ok(result.some(r=>r.id===ids[1]));assert.ok(!result.some(r=>r.id===ids[2]));assert.equal(result.filter(r=>ids.includes(r.id)).length,2);
  }finally{if(client){await client.query('ROLLBACK');client.release();}await pool.end();}
});
