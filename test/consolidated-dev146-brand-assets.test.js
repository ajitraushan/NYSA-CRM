import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const root=new URL('../public/brand/nysa/',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const vectorNames=['nysa-app-icon.svg','nysa-horizontal-dark.svg','nysa-horizontal-light.svg','nysa-mark-dark.svg','nysa-mark-light.svg','nysa-mono-positive.svg','nysa-mono-reversed.svg','nysa-stacked-dark.svg','nysa-stacked-light.svg'];
const rasterNames=['apple-touch-icon.png','favicon-16.png','favicon-32.png','favicon-48.png','nysa-app-icon-512.png','nysa-horizontal-dark@1x.png','nysa-horizontal-dark@2x.png','nysa-horizontal-dark@3x.png','nysa-horizontal-light@1x.png','nysa-horizontal-light@2x.png','nysa-horizontal-light@3x.png','nysa-social-share-1200x630.png','nysa-stacked-dark@1x.png','nysa-stacked-dark@2x.png','nysa-stacked-dark@3x.png','nysa-stacked-light@1x.png','nysa-stacked-light@2x.png','nysa-stacked-light@3x.png'];
const pngDimensions=buffer=>({width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)});

test('approved production vector and raster variant inventory is complete',()=>{
  for(const name of vectorNames)assert.ok(existsSync(new URL(`vector/${name}`,root)),name);
  for(const name of rasterNames)assert.ok(existsSync(new URL(`raster/${name}`,root)),name);
  assert.ok(existsSync(new URL('nysa-social-share.svg',root)));
});

test('production vectors remain outlined, dependency-free and effect-free',()=>{
  for(const name of [...vectorNames.map(name=>`vector/${name}`),'nysa-social-share.svg']){
    const svg=read(name).toString('utf8');
    assert.match(svg,/<path\b/);assert.doesNotMatch(svg,/<script\b|<text\b|<filter\b|feGaussianBlur|feDropShadow|font-family|(?:href|src)=["']https?:/i,name);
  }
});

test('favicon, application and social raster dimensions are exact',()=>{
  for(const [name,width,height] of [['favicon-16.png',16,16],['favicon-32.png',32,32],['favicon-48.png',48,48],['apple-touch-icon.png',180,180],['nysa-app-icon-512.png',512,512],['nysa-social-share-1200x630.png',1200,630]])assert.deepEqual(pngDimensions(read(`raster/${name}`)),{width,height},name);
});

test('governed context registry and CRM surfaces enforce approved variants and minimums',()=>{
  const registry=JSON.parse(read('brand-assets.json')),app=readFileSync(new URL('../../app.js',root),'utf8'),html=readFileSync(new URL('../../index.html',root),'utf8');
  assert.equal(registry.sourcePackageSha256,'d4c5b2112834d703f70a9f97b75ba66cc39509563414b4f424df9e8f08cab369');
  assert.deepEqual(registry.minimumRenderedWidths,{horizontal:140,stacked:90,mark:24});
  for(const context of ['applicationHeaderDark','applicationHeaderCompactDark','authenticationDark','applicationFooterDark','emailSignature2x','pdfAndLetterhead2x','monoPositive','monoReversed'])assert.ok(registry.contexts[context],context);
  for(const marker of ['nysa-stacked-dark.svg','nysa-horizontal-dark.svg','nysa-app-icon.svg','class="app-footer"'])assert.ok(app.includes(marker),marker);
  for(const marker of ['favicon-16.png','favicon-32.png','favicon-48.png','apple-touch-icon.png','nysa-social-share-1200x630.png','min-width:140px;height:44px','min-width:90px'])assert.ok(html.includes(marker),marker);
  assert.doesNotMatch(html,/\.brand-logo[^}]*filter:drop-shadow/);
});
