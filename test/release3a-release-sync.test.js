import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('UI-RELEASE-SYNC-48 loads every browser asset using the served application version',()=>{
  const page=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const bootstrap=fs.readFileSync(new URL('../public/bootstrap.js',import.meta.url),'utf8');
  assert.match(page,/<script src="\/bootstrap\.js"><\/script>/);
  assert.doesNotMatch(page,/<script>\s*\(async/);
  assert.match(bootstrap,/fetch\('\/api\/health\?asset-manifest='/);
  assert.match(bootstrap,/cache:'no-store'/);
  assert.match(bootstrap,/window\.NYSA_ASSET_BUILD=build/);
  assert.match(bootstrap,/\['offer-ui\.js','deal-ui\.js','inventory-workspace-ui\.js','app\.js','dashboard-ui\.js'\]/);
  assert.match(bootstrap,/script\.src=`\/\$\{file\}\?v=\$\{encodeURIComponent\(build\)\}`/);
  assert.match(fs.readFileSync(new URL('../src/lib/http-kit.js',import.meta.url),'utf8'),/script-src 'self';/);
  assert.doesNotMatch(fs.readFileSync(new URL('../src/lib/http-kit.js',import.meta.url),'utf8'),/script-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(page,/r2\.6-dev87/);
});

test('UI-RELEASE-SYNC-48 detects later releases and reloads automatically only at a safe point',()=>{
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/CLIENT_ASSET_BUILD=window\.NYSA_ASSET_BUILD/);
  assert.match(app,/release-sync/);
  assert.match(app,/current!==CLIENT_ASSET_BUILD/);
  assert.match(app,/document\.querySelector\('\.overlay'\)/);
  assert.match(app,/form\[data-client-dirty="1"\]/);
  assert.match(app,/will load automatically after you finish the open form/);
  assert.match(app,/window\.location\.replace\(target\)/);
});
