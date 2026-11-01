import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

test('WhatsApp workspace feature bundle initializes before app.js defines legacy helpers',()=>{
  const source=fs.readFileSync(new URL('../public/whatsapp-workspace-ui.js',import.meta.url),'utf8');
  const window={};
  assert.doesNotThrow(()=>vm.runInNewContext(source,{window}));
  assert.equal(typeof window.renderWhatsAppWorkspace,'function');
  assert.doesNotMatch(source,/const safe\s*=\s*value\s*=>\s*esc\s*\(/);
});
