import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('dev.210 aligns the authenticated shell to the login visual language',()=>{
  const html=read('public/index.html');
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.212');
  for(const marker of [
    'DEV210 login-anchored warm charcoal refinement',
    '--workspace:#0c1014',
    '--surface:#15191b',
    '--surface-muted:#1b2023',
    '--surface-raised:#24292c',
    '--ink:#f7f4ed',
    '--ink-muted:#bdb9b0',
    '--line:#3e3b35',
    '--gold:#d4ab60',
    'background:#0d1114',
    'background:radial-gradient(circle at 88% 0,rgba(212,171,96,.07),transparent 34%),#0c1014',
    'background:linear-gradient(110deg,#080b0f,#11171c 62%,#211c14)',
    '#app.shell-layout table th{background:#242724;color:#e6c17b}',
    '#app.shell-layout input,#app.shell-layout select,#app.shell-layout textarea{background:#101416'
  ]) assert.ok(html.includes(marker),`missing login-anchored theme marker: ${marker}`);
  assert.ok(html.includes('body:has(#app.shell-layout){'), 'detached operational workspaces must inherit the authenticated palette');
});

test('dev.210 keeps the login anchor unchanged and excludes its photograph from operational screens',()=>{
  const html=read('public/index.html');
  const shell=html.slice(html.indexOf('/* DEV210 login-anchored'));
  assert.ok(!shell.includes('dubai-skyline-auth'), 'operational shell must not use the login photograph');
  for(const unchangedLoginMarker of [
    '--workspace:#171d26',
    '--radius:2px',
    '.btn{border:1px solid var(--border);background:var(--surface-raised);color:var(--text);padding:8px 16px;border-radius:2px',
    '.auth-card{position:relative;width:100%;padding:clamp(24px,3vw,36px);border:1px solid transparent;border-radius:22px',
    '.auth-submit{width:100%;min-height:50px;margin-top:4px;border:1px solid #e0b660'
  ]) assert.ok(html.includes(unchangedLoginMarker),`login anchor changed: ${unchangedLoginMarker}`);
  assert.match(html,/@media print\{body\{background:#fff\}/);
  assert.match(html,/\.proposal-preview\{display:block!important;background:#fff;color:#111\}/);
});
