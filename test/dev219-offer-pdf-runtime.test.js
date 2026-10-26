import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUPPETEER_REVISIONS} from 'puppeteer-core/internal/revisions.js';
import {chromiumLaunchOptions} from '../src/approved-document-renderer.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV219 server renderer uses the headless-shell mode required by packaged Chromium',async()=>{
  const runtimeDirectory='/application/tmp/pdf-renderer',executablePath=`${runtimeDirectory}/chromium`,calls=[];
  const previousTmpdir=process.env.TMPDIR;
  const chromium={
    args:['--no-sandbox'],
    defaultViewport:{width:1920,height:1080},
    headless:'shell',
    async executablePath(){assert.equal(process.env.TMPDIR,runtimeDirectory);return executablePath;}
  };
  try{
    assert.deepEqual(await chromiumLaunchOptions('linux',{
      chromium,runtimeDirectory,
      mkdir:(directory,options)=>calls.push(['mkdir',directory,options]),
      chmod:(file,mode)=>calls.push(['chmod',file,mode])
    }),{
      executablePath,headless:'shell',args:['--no-sandbox'],defaultViewport:{width:1920,height:1080}
    });
    assert.deepEqual(calls,[
      ['mkdir',runtimeDirectory,{recursive:true,mode:0o700}],
      ['chmod',executablePath,0o700]
    ]);
  }finally{
    if(previousTmpdir===undefined)delete process.env.TMPDIR;else process.env.TMPDIR=previousTmpdir;
  }
});

test('DEV219 packaged Chromium major matches Puppeteer required headless-shell major',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['@sparticuz/chromium'].split('.')[0],PUPPETEER_REVISIONS['chrome-headless-shell'].split('.')[0]);
});

test('DEV219 Offer creation returns an actionable renderer failure instead of a generic 500',()=>{
  const routes=read('src/routes/opportunities.js');
  assert.match(routes,/approved Offer PDF could not be generated/);
  assert.match(routes,/status:503/);
});

test('DEV219 Offer template reserves explicit NYSA signature and company stamp space',()=>{
  const template=read('src/approved-document-templates/offer-letter.html');
  assert.match(template,/Authorised signature/);
  assert.match(template,/Company<br>stamp/);
  assert.match(template,/NYSA Realty LLC <span>Authorisation<\/span>/);
});

test('DEV219 Offer direction checkbox remains selectable when the template includes a Sale or Rent caption',()=>{
  const template=read('src/approved-document-templates/offer-letter.html');
  const renderer=read('src/approved-document-renderer.js');
  assert.match(template,/data-checkbox-label="Offer to Purchase"/);
  assert.match(template,/data-checkbox-label="Offer to Lease"/);
  assert.match(renderer,/x\.dataset\.checkboxLabel\|\|x\.textContent/);
});
