import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import test from 'node:test';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {parseProspectUpload,uploadTemplate,XLSX_TYPE} from '../src/prospect-upload.js';

const header = 'Name,Phone,Email,Notes,Source';
const csv = rows => Buffer.from([header,...rows].join('\n'));
function workbook(email = 'upload-workbook@example.invalid') {
  const files = unzipSync(uploadTemplate('xlsx'));
  const sheet = 'xl/worksheets/sheet1.xml';
  files[sheet] = strToU8(strFromU8(files[sheet]).replace('</sheetData>',`<row r="2">
    <c r="A2" t="inlineStr"><is><t>Workbook Prospect</t></is></c>
    <c r="C2" t="inlineStr"><is><t>${email}</t></is></c>
    <c r="E2" t="inlineStr"><is><t>rem</t></is></c></row></sheetData>`));
  return Buffer.from(zipSync(files));
}
test('Prospect upload templates, CSV quoting and 2,000-row boundary',async () => {
  assert.equal(uploadTemplate('csv').toString(),header+'\r\n');
  const parsed = await parseProspectUpload(csv(['Example,050 123 4567,,"a ""quote"", and\nnewline",diary']),'text/csv');
  assert.equal(parsed[0].phone,'+971501234567');
  assert.equal(parsed[0].notes,'a "quote", and\nnewline');
  const xlsx = await parseProspectUpload(workbook(),XLSX_TYPE);
  assert.equal(xlsx[0].email,'upload-workbook@example.invalid');
  assert.equal(xlsx[0].phone,null);
  const phones = await parseProspectUpload(csv(['Numeric,501234567,,,diary',',,,,','International,971501234567,,,diary','', 'IDD,00971501234567,,,diary']),'text/csv');
  assert.deepEqual(phones.map(x=>[x.rowNumber,x.phone]),[[2,'+971501234567'],[4,'+971501234567'],[6,'+971501234567']]);
  const files = unzipSync(workbook());
  const sheet = 'xl/worksheets/sheet1.xml';
  const xml = strFromU8(files[sheet]);
  assert.match(xml,/<col min="2" max="2" style="1"/);
  assert.match(strFromU8(files['xl/styles.xml']),/numFmtId="49"/);
  files[sheet] = strToU8(xml.replace('<c r="C2"', '<c r="B2" t="n"><v>501234567</v></c><c r="C2"').replace('</sheetData>', '<row r="4"><c r="A4" t="inlineStr"><is><t>Next</t></is></c><c r="B4"><v>971501234568</v></c></row></sheetData>'));
  const excelPhones = await parseProspectUpload(Buffer.from(zipSync(files)),XLSX_TYPE);
  assert.deepEqual(excelPhones.map(x=>[x.rowNumber,x.phone]),[[2,'+971501234567'],[4,'+971501234568']]);
  const rows = Array(2000).fill('Example,0501234567,,,diary');
  assert.equal((await parseProspectUpload(csv(rows),'text/csv')).length,2000);
  await assert.rejects(parseProspectUpload(csv([...rows,rows[0]]),'text/csv'),/2,000/);
});

test('a contactable upload row may omit the prospect name', async () => {
  const rows=await parseProspectUpload(Buffer.from('Name,Phone,Email,Notes,Source\n,501234567,,,'),'text/csv');
  assert.equal(rows[0].error,null);
  assert.equal(rows[0].phone,'+971501234567');
});

test('Prospect upload commits only reviewed rows and enforces role, suppression and audit', {
  skip:process.env.NYSA_PROSPECT_UPLOAD_TEST!=='local-synthetic',
}, async () => {
  assert.equal(process.env.PGHOST,'127.0.0.1');
  assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
  assert.equal(process.env.PGUSER,'nysa_test_user');
  const db = await import('../src/db.js');
  const {createApp} = await import('../src/lib/http-kit.js');
  const {default:prospects} = await import('../src/routes/prospects.js');
  const {createSession} = await import('../src/auth.js');
  const {recordContactSuppression} = await import('../src/contact-suppression.js');
  let server;
  try {
    assert.match((await db.one('SHOW server_version')).serverVersion,/^13\.23/);
    const [agent,outsider,manager,director] = Array.from({length:4},randomUUID);
    const team = randomUUID(), suffix = randomUUID().slice(0,8);
    const actors = [[agent,'sales_agent'],[outsider,'sales_agent'],[manager,'manager'],[director,'director']];
    for (const [id,role] of actors) {
      await db.execute(`INSERT INTO brokers(id,name,email,role,job_role,status,password_hash)
        VALUES($1,'Synthetic Upload Actor',$2,'internal_broker',$3,'active','x')`,[id,`${id}@example.invalid`,role]);
    }
    await db.execute('INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)',[team,`Synthetic upload ${suffix}`,manager]);
    await db.execute('UPDATE brokers SET team_id=$1 WHERE id=ANY($2::uuid[])',[team,[agent,manager]]);
    for(const [id,role] of [[agent,'member'],[manager,'manager']]) {
      await db.execute('INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,$4,$5)',[randomUUID(),team,id,role,manager]);
    }
    const tokens = new Map(await Promise.all(actors.map(async ([id])=>[id,await createSession(id)])));
    const app = createApp();
    app.mount('/api',prospects);
    server = await new Promise(resolve => {
      const instance = app.listen({host:'127.0.0.1',port:0},()=>resolve(instance));
    });
    async function request(route,{as=agent,body,status=200}={}) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`,{
        method:body?'POST':'GET', headers:{authorization:'Bearer '+tokens.get(as),'content-type':'application/json'},
        body:body?JSON.stringify(body):undefined
      });
      const value = await response.text();
      assert.equal(response.status,status,value);
      return response.headers.get('content-type').includes('json') ? JSON.parse(value) : value;
    }
    const upload = '/crm/prospect-diary/upload';
    const digits = String(Number.parseInt(suffix,16)).slice(-7).padStart(7,'0');
    const phone = prefix => '+971'+prefix+digits;
    await db.transaction(client=>recordContactSuppression({
      phone:phone('51'),type:'dncr',evidenceReference:'Synthetic DNCR',actorId:manager
    },client));
    for(const [prefix,actor] of [['52',agent],['53',outsider]]) {
      await request('/crm/prospects',{as:actor,body:{phone:phone(prefix),displayName:'Synthetic duplicate'},status:201});
    }
    await db.execute(`INSERT INTO contacts(id,full_name,phone,owner_id,created_by) VALUES($1,'Synthetic customer',$2,$3,$3)`,[randomUUID(),phone('54'),agent]);
    const buffer = csv([
      `Ready,050${digits},,A,diary`, `Repeat,${phone('50')},,,other`, ',,,invalid row,',
      `Visible prospect,${phone('52')},,,other`, `Hidden prospect,${phone('53')},,,other`,
      `Existing customer,${phone('54')},,,other`, `Suppressed,${phone('51')},,DNC,whatsapp`
    ]);
    const payload = {fileName:'synthetic.csv',base64:buffer.toString('base64'),ownerId:agent};
    await request(upload+'/preview',{body:{...payload,ownerId:outsider},status:403});
    await request(upload+'/preview',{as:manager,body:{...payload,ownerId:outsider},status:403});
    const directorDuplicates = await request(upload+'/preview',{as:director,body:payload});
    assert.deepEqual(directorDuplicates.rows.slice(3,6).map(row=>row.status),
      ['existing_prospect','existing_prospect','matches_customer_or_lead']);
    const review = await request(upload+'/preview',{body:payload});
    assert.deepEqual(review.rows.map(row=>row.status),
      ['ready','duplicate_in_file','error','existing_prospect','error','matches_customer_or_lead','do_not_contact']);
    assert.equal(review.rows[4].reason,'This row cannot be uploaded');
    assert.equal((await db.one('SELECT count(*)::int AS n FROM prospect_upload_batches WHERE id=$1',[review.batchId])).n,0);
    const commit = {...payload,batchId:review.batchId,reviewToken:review.reviewToken};
    const saved = await request(upload+'/commit',{body:commit,status:201});
    assert.equal(saved.skippedRows.length,5);
    assert.deepEqual(await request(upload+'/commit',{body:commit,status:201}),saved);
    const result = await request(upload+'/'+saved.batchId+'/result');
    assert.match(result,/duplicate_in_file/);
    assert.doesNotMatch(result,/Synthetic duplicate|\+971/);
    const records = await db.many('SELECT * FROM prospects WHERE upload_batch_id=$1 ORDER BY normalized_phone',[saved.batchId]);
    assert.deepEqual(records.map(row=>[row.normalizedPhone,row.status,row.ownerId,row.consentStatus]),
      [[phone('50'),'not_contacted',agent,'unknown'],[phone('51'),'do_not_contact',agent,'unknown']]);
    assert.deepEqual((await db.many(`SELECT a.notes FROM prospect_activities a JOIN prospects p ON p.id=a.prospect_id
      WHERE p.upload_batch_id=$1 ORDER BY p.normalized_phone`,[saved.batchId])).map(x=>x.notes),['A','DNC']);
    assert.equal((await db.one('SELECT count(*)::int AS n FROM tasks WHERE prospect_id=ANY($1::uuid[])',[records.map(x=>x.id)])).n,0);
    await request('/crm/prospects/'+records[1].id+'/follow-ups',{body:{subject:'Must block',dueAt:'2026-11-12T10:00:00+04:00'},status:409});
    const audit = await db.one("SELECT * FROM audit_log WHERE entity_id=$1 AND action='upload_committed'",[saved.batchId]);
    assert.equal(audit.performedBy,agent);
    assert.equal(JSON.parse(audit.details).fileSha256,createHash('sha256').update(buffer).digest('hex'));
    const xlsx = {fileName:'synthetic.xlsx',base64:workbook(`upload-${suffix}@example.invalid`).toString('base64'),ownerId:agent};
    const directorReview = await request(upload+'/preview',{as:director,body:xlsx});
    assert.equal(directorReview.counts.ready,1);
    const managerReview = await request(upload+'/preview',{as:manager,body:xlsx});
    await request(upload+'/commit',{as:manager,body:{...xlsx,batchId:managerReview.batchId,reviewToken:managerReview.reviewToken},status:201});
    assert.equal((await db.one('SELECT phone FROM prospects WHERE upload_batch_id=$1',[managerReview.batchId])).phone,null);
  } finally {
    if(server) { server.close(); server.closeAllConnections(); }
    await db.closeDatabase();
  }
});
