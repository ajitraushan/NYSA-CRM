import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('dev.210 shell remains superseded by the approved light workspace',()=>{
  const html=read('public/index.html');
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.220');
  for(const marker of [
    'DEV218 approved NYSA light workspace',
    '--workspace:#f4f1eb',
    '--surface:#ffffff',
    '--surface-muted:#f4f1eb',
    '--surface-raised:#eef0f2',
    '--ink:#14232c',
    '--ink-muted:#5b6770',
    '--line:#b9c0c6',
    '--gold:#8f6a30',
    '#app.shell-layout>header,#app.shell-layout>nav.tabs{background:#14232c;color:#fff}',
    '#app.shell-layout table th{background:#14232c;color:#fff}',
    '#app.shell-layout input,#app.shell-layout select,#app.shell-layout textarea{background:#fff'
  ]) assert.ok(html.includes(marker),`missing login-anchored theme marker: ${marker}`);
  assert.ok(html.includes('body:has(#app.shell-layout){'), 'detached operational workspaces must inherit the authenticated palette');
});

test('dev.210 keeps the login anchor unchanged and excludes its photograph from operational screens',()=>{
  const html=read('public/index.html');
  const shell=html.slice(html.indexOf('/* DEV218 approved NYSA light workspace'));
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
