import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV267 routes use the canonical contact-suppression reader and writer',()=>{
  const paths=[
    'src/routes/whatsapp-workspace.js',
    'src/routes/whatsapp-simulated-provider.js',
    'src/whatsapp-simulated-provider-store.js',
    'src/routes/prospects.js',
    'src/routes/crm.js',
    'src/routes/governance.js',
    'src/routes/purchased-data-import.js',
    'src/nonvoice-follow-up-store.js'
  ];
  const sources=Object.fromEntries(paths.map(file=>[file,read(file)]));
  for(const [file,source] of Object.entries(sources)){
    assert.match(source,/contact-suppression\.js/,`${file} must use the shared suppression module`);
    assert.doesNotMatch(source,/INSERT\s+INTO\s+wa_contact_suppressions/i,`${file} must not implement its own suppression write`);
  }
  assert.match(sources['src/routes/whatsapp-workspace.js'],/applySharedSuppressions/);
  assert.match(sources['src/routes/whatsapp-workspace.js'],/getContactSuppression\(phone,client\)/);
  assert.match(sources['src/routes/whatsapp-simulated-provider.js'],/getContactSuppression\(conversation\.normalizedPhone,client\)/);
  assert.match(sources['src/routes/prospects.js'],/blocksOutbound/);
  assert.match(sources['src/routes/crm.js'],/blocksOutbound/);
});

test('DEV267 suppression precedence and governed release rules have one implementation',()=>{
  const source=read('src/contact-suppression.js');
  assert.match(source,/\['wrong_number','dncr','do_not_contact','opt_out'\]/);
  assert.match(source,/Opt-out release requires new customer consent evidence recorded after the opt-out/);
  assert.match(source,/Manager or Director authority is required/);
  assert.match(source,/pg_advisory_xact_lock/);
});
