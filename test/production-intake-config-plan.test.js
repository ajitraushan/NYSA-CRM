import test from 'node:test';import assert from 'node:assert/strict';
import {prepareIntakeConfiguration} from '../tools/production-intake-config-plan.mjs';
test('production intake preparation creates independent keys and disabled-login, unassigned service actors',()=>{
 const plan=prepareIntakeConfiguration({});assert.match(plan.patch.WEB_INTAKE_IDENTITY_KEY,/^[a-f0-9]{64}$/);assert.match(plan.patch.WEB_INTAKE_MATCH_KEY,/^[a-f0-9]{64}$/);assert.notEqual(plan.patch.WEB_INTAKE_IDENTITY_KEY,plan.patch.WEB_INTAKE_MATCH_KEY);assert.equal(plan.actors.length,2);
 assert.equal(plan.actors.find(a=>a.role==='viewer').name,'System – NIA Intake');for(const actor of plan.actors){assert.equal(actor.canPost,0);assert.equal(actor.jobRole,null);assert.equal(actor.passwordHash.includes(':'),false);assert.equal(Object.hasOwn(actor,'teamId'),false);}
 assert.equal(plan.patch.WEB_INTAKE_WORKER_ENABLED,'true');for(const key of ['LEAD_RESPONSE_LIVE_ENABLED','META_INTAKE_ENABLED','WHATSAPP_ENABLED','VOICE_ENABLED'])assert.equal(Object.hasOwn(plan.patch,key),false);
});
test('production preparation preserves existing keys, actor assignments and shared secret',()=>{
 const env={WEB_INTAKE_IDENTITY_KEY:'a'.repeat(64),WEB_INTAKE_MATCH_KEY:'b'.repeat(64),WEB_INTAKE_MATCH_KEY_VERSION:'v1',WEBSITE_INTAKE_SECRET:'existing-private-secret',WEB_INTAKE_ACTOR_ID:'web',WEBSITE_INTAKE_ACTOR_ID:'web',NIA_INTAKE_ACTOR_ID:'nia',WEB_INTAKE_WORKER_ENABLED:'true'};
 const plan=prepareIntakeConfiguration(env);assert.deepEqual(plan.patch,{});assert.deepEqual(plan.actors,[]);assert.equal(env.WEBSITE_INTAKE_SECRET,'existing-private-secret');
});
test('production preparation refuses to silently rotate an invalid existing identity key',()=>{
 assert.throws(()=>prepareIntakeConfiguration({WEB_INTAKE_IDENTITY_KEY:'invalid'}),/do not rotate/);
 assert.throws(()=>prepareIntakeConfiguration({WEB_INTAKE_MATCH_KEY:'short'}),/do not replace/);
});
