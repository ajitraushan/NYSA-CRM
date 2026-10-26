import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPropertyFinderMediaDelivery, inspectPropertyFinderImage, verifyPropertyFinderMediaDeliveryToken } from '../src/property-finder-media-delivery.js';
import { createPropertyFinderSandboxClient, PROPERTY_FINDER_SANDBOX_ORIGIN } from '../src/property-finder-sandbox.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const now = new Date('2026-08-06T08:00:00.000Z');
const env = { NYSA_DEPLOYMENT_ENV:'crm_test',NYSA_R3B_UAT_BASE_URL:'https://crm-test.nysarealty.com',PROPERTY_FINDER_MEDIA_DELIVERY_SECRET:'m'.repeat(48) };

function png(width, height, colourType = 2) {
  const data = Buffer.alloc(40);Buffer.from([137,80,78,71,13,10,26,10]).copy(data);data.write('IHDR',12,'ascii');data.writeUInt32BE(width,16);data.writeUInt32BE(height,20);data[25]=colourType;return data;
}

test('dev.142 verifies PF dimensions and creates an expiring CRM-Test-only delivery token',()=>{
  assert.deepEqual(inspectPropertyFinderImage(png(1440,1080),'image/png'),{eligible:true,width:1440,height:1080,colourSpace:'sRGB',blocker:null});
  assert.match(inspectPropertyFinderImage(png(800,1080),'image/png').blocker,/ratio/);
  assert.match(inspectPropertyFinderImage(png(1440,1080,0),'image/png').blocker,/RGB/);
  const delivery=createPropertyFinderMediaDelivery({media:{id:'00000000-0000-4000-8000-000000000001',fileHash:'a'.repeat(64)},now,env});
  assert.match(delivery.deliveryUrl,/^https:\/\/crm-test\.nysarealty\.com\/api\/integrations\/property-finder\/sandbox\/media\//);
  const token=delivery.deliveryUrl.split('/').at(-1),verified=verifyPropertyFinderMediaDeliveryToken(token,{env,now});
  assert.equal(verified.mediaId,'00000000-0000-4000-8000-000000000001');assert.equal(verified.fileHash,'a'.repeat(64));
  assert.match(verifyPropertyFinderMediaDeliveryToken(token,{env,now:new Date('2026-08-20T00:00:00.000Z')}).error,/expired/);
});

test('dev.142 captures a complete safe upstream failure record without the bearer token',async()=>{
  const pfEnv={NYSA_DEPLOYMENT_ENV:'crm_test',PROPERTY_FINDER_ENVIRONMENT:'sandbox',PROPERTY_FINDER_API_BASE_URL:PROPERTY_FINDER_SANDBOX_ORIGIN,
    PROPERTY_FINDER_SANDBOX_API_KEY:'k'.repeat(40),PROPERTY_FINDER_SANDBOX_API_SECRET:'s'.repeat(32),PROPERTY_FINDER_SANDBOX_EXPIRES_AT:'2026-09-04T16:26:00.000Z',
    PROPERTY_FINDER_API_SCOPES:'users:read,listings:read,credits:read,compliances:read,listing_verification:full_access,locations:read,projects:read,webhooks:full_access',PROPERTY_FINDER_SANDBOX_ENABLED:'1',PROPERTY_FINDER_ALLOW_READS:'1'};
  const client=createPropertyFinderSandboxClient({env:pfEnv,now:()=>now.getTime(),fetchImpl:async(url)=>url.endsWith('/v1/auth/token')
    ?new Response(JSON.stringify({accessToken:'t'.repeat(32),expiresIn:1800}),{status:200})
    :new Response(JSON.stringify({title:'Not found',detail:'No matching endpoint',apiSecret:'must-not-leak'}),{status:404,headers:{'content-type':'application/problem+json'}})});
  await assert.rejects(client.searchLocations({query:'Meydan'}),error=>{assert.equal(error.upstreamStatus,404);assert.equal(error.diagnosticEvidence.method,'GET');assert.match(error.diagnosticEvidence.endpoint,/\/v1\/locations/);assert.equal(error.diagnosticEvidence.responseContentType,'application/problem+json');assert.match(error.diagnosticEvidence.responseBody,/No matching endpoint/);assert.doesNotMatch(error.diagnosticEvidence.responseBody,/must-not-leak/);return true;});
});

test('dev.142 exposes governed profile selection and automatic media preparation but no PF write method',()=>{
  const route=read('src/routes/property-finder-sandbox.js'),delivery=read('src/routes/property-finder-media-delivery.js'),ui=read('public/app.js'),server=read('src/server.js');
  for(const marker of ['LIST_PROPERTY_FINDER_SANDBOX_PUBLIC_PROFILES','PROPERTY_FINDER_MEDIA_DELIVERY_CONFIRMATION','diagnosticEvidence','effectiveMappingVersionCode'])assert.ok(route.includes(marker),marker);
  for(const marker of ['Read PF public profiles','Verify photos and create temporary CRM-Test delivery URLs','PREPARE_PROPERTY_FINDER_SANDBOX_MEDIA'])assert.ok(ui.includes(marker),marker);
  assert.ok(server.indexOf("app.mount('/api', propertyFinderMediaDeliveryRoutes)")<server.indexOf("app.mount('/api', propertyFinderSandboxRoutes)"));
  assert.match(delivery,/approvalStatus !== 'approved'/);assert.doesNotMatch(route,/client\.(create|update|delete|publish|unpublish)/);
});
