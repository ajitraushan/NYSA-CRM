import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV267a exposes governed manual DNCR controls in Prospect Diary and WhatsApp',()=>{
  const prospects=read('src/routes/prospects.js');
  const whatsapp=read('src/routes/whatsapp-workspace.js');
  const prospectUi=read('public/prospect-diary-ui.js');
  const whatsappUi=read('public/whatsapp-workspace-ui.js');
  for(const source of [prospects,whatsapp,prospectUi,whatsappUi])assert.match(source,/Manual DNCR evidence \(not a registry check\)/);
  assert.match(prospects,/\/crm\/prospects\/:id\/dncr/);
  assert.match(whatsapp,/\/crm\/whatsapp-workspace\/recipient-suppressions\/dncr/);
  assert.match(prospects,/if\(!canManage\(req\.broker\)\)return res\.status\(403\)/);
  assert.match(whatsapp,/if\(!requireReviewer\(req,res\)\)return/);
  assert.match(prospectUi,/data-dncr-form/);
  assert.match(whatsappUi,/id="wa-dncr-form"/);
  assert.match(prospects,/type:'dncr'/);
  assert.match(whatsapp,/type:'dncr'/);
});

test('DEV267a manual DNCR uses the shared cross-channel block and audited governed release',()=>{
  const suppression=read('src/contact-suppression.js');
  const prospects=read('src/routes/prospects.js');
  const whatsapp=read('src/routes/whatsapp-workspace.js');
  assert.match(suppression,/const PRECEDENCE=\['wrong_number','dncr','do_not_contact','opt_out'\]/);
  assert.match(prospects,/Outbound calling is blocked by \$\{suppression\.strongest\}/);
  assert.match(prospects,/Follow-up outreach is blocked by \$\{suppression\.strongest\}/);
  assert.match(whatsapp,/campaignPreview/);
  assert.match(whatsapp,/manual_dncr_recorded/);
  assert.match(whatsapp,/manual_dncr_released/);
  assert.match(prospects,/manual_dncr_recorded/);
  assert.match(prospects,/manual_dncr_released/);
  assert.match(suppression,/Manager or Director authority is required/);
  assert.match(suppression,/A meaningful release reason is required/);
});
