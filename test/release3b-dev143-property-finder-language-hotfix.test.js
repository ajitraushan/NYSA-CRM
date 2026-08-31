import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPropertyFinderSandboxClient, PROPERTY_FINDER_SANDBOX_ORIGIN } from '../src/property-finder-sandbox.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const clock=Date.parse('2026-08-06T16:30:00.000Z');
const env={NYSA_DEPLOYMENT_ENV:'crm_test',PROPERTY_FINDER_ENVIRONMENT:'sandbox',PROPERTY_FINDER_API_BASE_URL:PROPERTY_FINDER_SANDBOX_ORIGIN,
  PROPERTY_FINDER_SANDBOX_API_KEY:'k'.repeat(40),PROPERTY_FINDER_SANDBOX_API_SECRET:'s'.repeat(32),PROPERTY_FINDER_SANDBOX_EXPIRES_AT:'2026-09-04T16:26:00.000Z',
  PROPERTY_FINDER_API_SCOPES:'users:read,listings:read,credits:read,compliances:read,listing_verification:full_access,locations:read,projects:read,webhooks:full_access',PROPERTY_FINDER_SANDBOX_ENABLED:'1',PROPERTY_FINDER_ALLOW_READS:'1'};

test('dev.143 sends the PF language header on every sandbox request',async()=>{const calls=[],client=createPropertyFinderSandboxClient({env,now:()=>clock,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/v1/auth/token')?new Response(JSON.stringify({accessToken:'t'.repeat(32),expiresIn:1800}),{status:200}):new Response(JSON.stringify({data:[{id:'44',name:'Meydan',path:'Dubai, Meydan'}]}),{status:200});}});await client.searchLocations({query:'Meydan'});assert.equal(calls.length,2);assert.ok(calls.every(call=>call.options.headers['Accept-Language']==='en'));});

test('dev.143 retains complete redacted PF evidence in the business UAT screen',()=>{const ui=read('public/app.js'),connector=read('src/property-finder-sandbox.js');for(const marker of ['showPfDiagnostic','error?.data?.diagnosticEvidence','requestedAtUtc','responseContentType','responseBody'])assert.ok(`${ui}\n${connector}`.includes(marker),marker);assert.match(ui,/failed — no listing was sent/);assert.doesNotMatch(ui,/apiSecret|accessToken/);});
