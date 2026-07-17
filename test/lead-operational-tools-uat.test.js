import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('lead tasks distinguish planned work from completed activities and expose ownership',()=>{
  const ui=read('public/app.js'),routes=read('src/routes/lead-operations.js'),styles=read('public/index.html');
  for(const contract of ['Lead action plan','future actions with an owner and deadline','Assigned to','Add a planned action','Instructions','Start','Cancellation reason'])assert.match(ui,new RegExp(contract));
  assert.match(routes,/Only a team lead or administrator can select another task owner/);
  assert.match(routes,/Completion outcome is required/);
  assert.match(routes,/Cancellation reason is required/);
  assert.match(styles,/\.task-card\{display:grid/);
});

test('financial scenarios use business forms and preserve immutable governed snapshots',()=>{
  const ui=read('public/app.js'),routes=read('src/routes/qualification-finance.js'),styles=read('public/index.html');
  assert.doesNotMatch(ui,/Inputs JSON/);
  for(const contract of ['Mortgage affordability','Investment return','Down payment (%)','Annual interest rate (%)','Expected annual rent','Expected vacancy (%)','Cash invested','indicative estimate','immutable snapshot'])assert.match(ui,new RegExp(contract.replace(/[()]/g,'\\$&')));
  assert.match(ui,/data-business-amount/);
  assert.match(routes,/input_snapshot,output_snapshot/);
  assert.match(routes,/assumption_version_id/);
  assert.match(styles,/\.financial-scenario-card\{display:grid/);
});

test('private lead documents have a scoped register, immutable versions and separate consent evidence',()=>{
  const ui=read('public/app.js'),routes=read('src/routes/files-proposals.js'),styles=read('public/index.html');
  for(const contract of ['Private lead document register','Document source / use','Access classification','Approved NYSA document template','Upload new version','Record executed marketing agreement','uploading a file alone never grants marketing consent'])assert.match(ui,new RegExp(contract));
  assert.doesNotMatch(ui,/executeAgreement/);
  assert.match(routes,/r\.get\('\/crm\/leads\/:id\/documents'/);
  assert.match(routes,/stable_code='document_type'/);
  assert.match(routes,/Restricted files|accessClassification==='restricted'/i);
  assert.match(routes,/file_hash,immutable,recipient/);
  assert.match(routes,/VALUES\(\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9,\$10,1,/);
  assert.match(routes,/Recipient is required when recording a sent document/);
  assert.match(styles,/\.document-card\{border:/);
});
