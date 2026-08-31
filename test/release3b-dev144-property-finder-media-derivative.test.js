import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { fitPropertyFinderDimensions,normalizePropertyFinderDerivativeTransform,propertyFinderDerivativeFileName } from '../src/property-finder-media-derivative.js';

const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('dev.144 fits real UAT images inside PF bounds without enlarging or distorting',()=>{
  assert.deepEqual(fitPropertyFinderDimensions(1536,1152),{width:1440,height:1080});
  assert.deepEqual(fitPropertyFinderDimensions(1536,1132),{width:1465,height:1080});
  assert.deepEqual(fitPropertyFinderDimensions(1440,1080),{width:1440,height:1080});
  assert.deepEqual(fitPropertyFinderDimensions(3840,2160),{width:1920,height:1080});
});

test('dev.144 accepts only code-governed watermark and quality settings',()=>{
  const transform=normalizePropertyFinderDerivativeTransform({sourceWidth:1536,sourceHeight:1152,outputWidth:1440,outputHeight:1080,watermarkStyle:'nysa_text_v1',watermarkPosition:'bottom_right',watermarkOpacity:.32,watermarkScale:.12,jpegQuality:.9});
  assert.equal(transform.version,'pf-media-derivative-v1');assert.equal(transform.originalPreserved,true);assert.equal(transform.approvalRequired,true);
  assert.match(normalizePropertyFinderDerivativeTransform({...transform,watermarkStyle:'free_text'}).error,/approved watermark/);
  assert.match(normalizePropertyFinderDerivativeTransform({...transform,outputWidth:1500}).error,/preserve the source ratio/);
  assert.match(normalizePropertyFinderDerivativeTransform({...transform,jpegQuality:.5}).error,/82% and 94%/);
  assert.equal(propertyFinderDerivativeFileName('../unsafe image.png'),'unsafe image-pf-ready.jpg');
});

test('dev.144 stores a separate pending derivative with provenance and no PF operation',()=>{
  const migration=read('src/migrations/082_release3b_property_finder_media_derivatives.sql'),route=read('src/routes/files-proposals.js'),domain=read('src/property-finder-media-derivative.js'),ui=read('public/app.js');
  for(const marker of ['derived_from_media_id','derivative_purpose','derivative_transform','ON DELETE RESTRICT'])assert.ok(migration.includes(marker),marker);
  assert.ok(domain.includes('CREATE_PROPERTY_FINDER_MEDIA_DERIVATIVE'));
  for(const marker of ['PROPERTY_FINDER_DERIVATIVE_CONFIRMATION',"'pending'",'sourceHash','derivedHash','originalPreserved:true','externalWritesPerformed:false','publicationPerformed:false'])assert.ok(route.includes(marker),marker);
  for(const marker of ['Create PF-ready copy','Generate governed preview','NYSA REALTY · governed text mark','Create unapproved PF-ready derivative','do not alter the original'])assert.ok(ui.includes(marker),marker);
  assert.doesNotMatch(route,/createListing|updateListing|deleteListing|publishListing|unpublishListing/);
});

test('historical migration 082 remains while the consolidated runtime version advances',()=>{
  const migrations=readdirSync(new URL('../src/migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
  assert.ok(migrations.includes('082_release3b_property_finder_media_derivatives.sql'));assert.ok(migrations.length>=82);
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.174');assert.equal(JSON.parse(read('package-lock.json')).version,'2.1.0-dev.174');
});
