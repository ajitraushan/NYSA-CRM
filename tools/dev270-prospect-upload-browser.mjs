import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import pg from 'pg';
import puppeteer from 'puppeteer-core';

const [rootArg,outputArg] = process.argv.slice(2);
assert.ok(rootArg && outputArg,'Usage: node tools/dev270-prospect-upload-browser.mjs <release-root> <new-evidence-dir>');
const root = path.resolve(rootArg), output = path.resolve(outputArg);
assert.equal(process.env.PGHOST,'127.0.0.1');
assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
assert.equal(process.env.PGUSER,'nysa_test_user');
await fs.mkdir(output);
const port = await new Promise(resolve => {
  const socket=net.createServer();
  socket.listen(0,'127.0.0.1',()=>{const n=socket.address().port;socket.close(()=>resolve(n));});
});
const base='http://127.0.0.1:'+port;
const env={...process.env,NODE_ENV:'production',PORT:String(port),LEAD_RESPONSE_ENVIRONMENT:'production',
  WHATSAPP_SIMULATED_PROVIDER_ENABLED:'false',LEAD_WHATSAPP_ENABLED:'false',LEAD_WHATSAPP_INBOX_ENABLED:'false',
  WHATSAPP_SANDBOX_ENABLED:'false',PROSPECT_OUTSIDE_CALLING_HOURS_MODE:'warning'};
const client=new pg.Client();
await client.connect();
let child,browser;
try {
  assert.match((await client.query('SHOW server_version')).rows[0].server_version,/^13\.23/);
  const agent=randomUUID(), manager=randomUUID(), team=randomUUID();
  const tokens=Object.fromEntries(['agent','manager'].map(role=>[role,randomBytes(32).toString('hex')]));
  for(const [actor,id] of [['agent',agent],['manager',manager]]) {
    await client.query("INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES($1,$2,$3,'internal_broker',$4,'active','synthetic')",
      [id,'Synthetic Browser '+actor,id+'@example.invalid',actor==='agent'?'sales_agent':'manager']);
    await client.query("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",
      [createHash('sha256').update(tokens[actor]).digest('hex'),id]);
  }
  await client.query("INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)",[team,'Synthetic browser '+team,manager]);
  await client.query('UPDATE brokers SET team_id=$1 WHERE id=ANY($2::uuid[])',[team,[agent,manager]]);
  for(const [id,role] of [[agent,'member'],[manager,'manager']]) {
    await client.query('INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,$4,$5)',[randomUUID(),team,id,role,manager]);
  }
  child=spawn(process.execPath,['app.cjs'],{cwd:root,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  const errors=[];
  child.stdout.resume();
  child.stderr.on('data',chunk=>errors.push(String(chunk)));
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let ready;
  for(let n=0;n<60;n++){
    try {const response=await fetch(base+'/api/readiness');if(response.ok){ready=await response.json();break;}} catch {}
    if(child.exitCode!==null)break;
    await delay(250);
  }
  assert.ok(ready,'Local application did not become ready: '+errors.join('').slice(-600));
  const unavailable=[];
  for(const route of ['/crm/whatsapp-workspace','/crm/campaigns','/providers/whatsapp-simulated/status']){
    const response=await fetch(base+'/api'+route,{headers:{authorization:'Bearer '+tokens.manager}});
    assert.equal(response.status,404,route);
    unavailable.push({route,status:response.status});
  }
  const executablePath=process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser=await puppeteer.launch({executablePath,headless:true,args:['--no-first-run','--disable-background-networking']});
  const results=[];
  for(const role of ['agent','manager']){
    const context=await browser.createBrowserContext();
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(error.message));
    await page.setViewport({width:1365,height:900});
    await context.setCookie({name:'nysa_session',value:tokens[role],url:base,httpOnly:true});
    await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('[data-tab="prospectDiary"]',{visible:true});
    assert.equal(await page.$('[data-tab="whatsappWorkspace"]'),null);
    await page.click('[data-tab="prospectDiary"]');
    await page.waitForSelector('.prospect-upload summary',{visible:true});
    await page.click('.prospect-upload summary');
    if(role==='manager') await page.select('[data-upload-form] select[name=ownerId]',agent);
    else assert.equal(await page.$('[data-upload-form] select[name=ownerId]'),null);
    const csv=path.join(output,role+'-synthetic.csv');
    await fs.writeFile(csv,'Name,Phone,Email,Notes,Source\nBrowser '+role+',,'+randomUUID()+'@example.invalid,Verified through index.html,diary\n');
    await (await page.$('[data-upload-form] input[type=file]')).uploadFile(csv);
    await page.click('[data-upload-form] button[type=submit], [data-upload-form] button');
    await page.waitForSelector('[data-upload-commit]',{visible:true});
    assert.match(await page.$eval('[data-upload-preview]',x=>x.textContent),/Ready/);
    await page.click('[data-upload-commit]');
    await page.waitForSelector('[data-upload-results]',{visible:true});
    assert.match(await page.$eval('[data-upload-status]',x=>x.textContent),/Upload committed/);
    assert.deepEqual(pageErrors,[]);
    await page.screenshot({path:path.join(output,role+'-commit.png')});
    results.push({role,path:'/index.html',preview:'passed',commit:'passed',campaignNavigation:'absent',pageErrors});
    await context.close();
  }
  const receipt={version:JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,postgres:'13.23',ready,unavailable,results};
  await fs.writeFile(path.join(output,'browser-result.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt));
} finally {
  await browser?.close();
  child?.kill();
  await client.end();
}
