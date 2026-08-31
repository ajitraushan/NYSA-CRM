import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('dev.173 puts the compact operations overview before the Agent attention queue',()=>{
  const dashboard=read('public/dashboard-ui.js');
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'2.1.0-dev.174');
  assert.match(dashboard,/OPERATIONS OVERVIEW/);
  assert.match(dashboard,/Your business at a glance/);
  assert.match(dashboard,/View full operating sequence · Customer to Deal/);
  assert.match(dashboard,/Pipeline at a glance/);
  assert.match(dashboard,/dashboard-lifecycle[\s\S]*dashboard-guided-flow/);
});

test('dev.173 removes the duplicate visible Agent page identity but retains an accessible heading',()=>{
  const dashboard=read('public/dashboard-ui.js');
  assert.match(dashboard,/likelyType==='agent'\?'<h1 class="visually-hidden">My dashboard<\/h1>/);
  assert.match(dashboard,/NYSA CORE \/ \$\{roleName\(likelyType\)\.toUpperCase\(\)\} WORKSPACE/);
});

test('dev.173 keeps non-production environment warning in the shell and moves version to Admin About',()=>{
  const app=read('public/app.js');
  assert.match(app,/if\(host==='crm\.nysarealty\.com'\)return ''/);
  assert.match(app,/if\(host==='crm-test\.nysarealty\.com'\)return 'CRM Test'/);
  assert.doesNotMatch(app,/NYSA CORE \$\{esc\(APP_VERSION\)\}<\/span>/);
  assert.match(app,/\['about','About'\]/);
  assert.match(app,/About NYSA CORE/);
  assert.match(app,/Application version<\/span><b>\$\{esc\(APP_VERSION\)\}/);
});
