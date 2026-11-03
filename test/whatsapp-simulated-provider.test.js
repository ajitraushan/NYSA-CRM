import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assertSimulatedProviderEnvironment,assertSimulatedProviderUrl,assertSyntheticWhatsAppPhone,buildSimulatedInbound,buildSimulatedOutbound,
  deterministicRandom,isSyntheticWhatsAppPhone,normalizeBackdateHours,normalizeSimulationFault,normalizeSimulationRate,
  simulatedPayloadHash,simulatedProviderConfig,simulationStatusSequence,syntheticPhoneAt
} from '../src/whatsapp-simulated-provider.js';

const token='synthetic-test-token-that-is-long-enough';
const enabledEnv={LEAD_RESPONSE_ENVIRONMENT:'crm-test',WHATSAPP_SIMULATED_PROVIDER_ENABLED:'true',WHATSAPP_SIMULATED_PROVIDER_TOKEN:token,PORT:'3210'};

test('DEV262 simulator is default-off and refuses production or real provider hosts',()=>{
  assert.equal(simulatedProviderConfig({}).enabled,false);
  assert.throws(()=>assertSimulatedProviderEnvironment({...enabledEnv,LEAD_RESPONSE_ENVIRONMENT:'production'}),/only when LEAD_RESPONSE_ENVIRONMENT=crm-test/);
  assert.throws(()=>assertSimulatedProviderEnvironment({...enabledEnv,WHATSAPP_SIMULATED_PROVIDER_URL:'https://waba.360dialog.io/v1'}),/loopback HTTP/);
  assert.throws(()=>assertSimulatedProviderEnvironment({...enabledEnv,LEAD_WHATSAPP_API_KEY:'must-not-coexist'}),/Live WhatsApp credentials/);
  const config=assertSimulatedProviderEnvironment(enabledEnv);
  assert.equal(config.baseUrl,'http://127.0.0.1:3210/api/providers/whatsapp-simulated');
  assert.throws(()=>assertSimulatedProviderUrl('https://graph.facebook.com/messages',config),error=>error.code==='SIMULATED_EXTERNAL_HOST_BLOCKED');
});

test('synthetic recipients are restricted to the agreed +971509000000 to +971509999999 range',()=>{
  const config=simulatedProviderConfig(enabledEnv);
  assert.equal(isSyntheticWhatsAppPhone('+971509000000',config),true);
  assert.equal(isSyntheticWhatsAppPhone('+971509999999',config),true);
  assert.equal(isSyntheticWhatsAppPhone('+971561066469',config),false);
  assert.equal(isSyntheticWhatsAppPhone('+9715090000000',config),false);
  assert.equal(syntheticPhoneAt(42,config),'+971509000042');
  assert.throws(()=>assertSyntheticWhatsAppPhone('+971561066469',config),/agreed \+971509 synthetic range/);
});

test('provider messages and inbound callbacks are visibly simulated and deterministic',()=>{
  const config=simulatedProviderConfig(enabledEnv),actorId='00000000-0000-4000-8000-000000000001',teamId='00000000-0000-4000-8000-000000000002';
  const outbound=buildSimulatedOutbound({to:'+971509000001',text:'Synthetic hello',actorId,conversationId:'00000000-0000-4000-8000-000000000003'},config);
  const inbound=buildSimulatedInbound({from:'+971509000001',text:'Synthetic reply',actorId,teamId,eventId:'event-1',ctwa:true},config);
  assert.equal(outbound.simulation,true);assert.equal(inbound.simulation,true);assert.equal(inbound.source_type,'ctwa');
  assert.deepEqual(simulationStatusSequence(),['sent','delivered','read']);
  assert.deepEqual(simulationStatusSequence({failure:true}),['sent','failed']);
  assert.equal(simulatedPayloadHash({b:2,a:1}),simulatedPayloadHash({a:1,b:2}));
  const one=deterministicRandom('same-seed'),two=deterministicRandom('same-seed');
  assert.deepEqual([one(),one(),one()],[two(),two(),two()]);
});

test('fault, rate and time-window controls are fail-closed',()=>{
  for(const fault of ['none','timeout','rate_limited','server_error','invalid_number','invalid_payload','template_paused'])assert.equal(normalizeSimulationFault(fault),fault);
  assert.throws(()=>normalizeSimulationFault('real-provider'),/Unsupported/);
  for(const rate of [5,20,50])assert.equal(normalizeSimulationRate(rate),rate);
  assert.throws(()=>normalizeSimulationRate(100),/5, 20 or 50/);
  for(const hours of [23,25,71,73])assert.equal(normalizeBackdateHours(hours),hours);
  assert.throws(()=>normalizeBackdateHours(24),/23, 25, 71 or 73/);
});

test('DEV262 source wires an isolated provider, webhook, audit, badges, generator and cleanup without changing live receivers',()=>{
  const route=fs.readFileSync(new URL('../src/routes/whatsapp-simulated-provider.js',import.meta.url),'utf8');
  const store=fs.readFileSync(new URL('../src/whatsapp-simulated-provider-store.js',import.meta.url),'utf8');
  const migration=fs.readFileSync(new URL('../src/migrations/166_whatsapp_simulated_provider_stub.sql',import.meta.url),'utf8');
  const faultMigration=fs.readFileSync(new URL('../src/migrations/167_whatsapp_simulator_fault_contract.sql',import.meta.url),'utf8');
  const ui=fs.readFileSync(new URL('../public/whatsapp-workspace-ui.js',import.meta.url),'utf8');
  const server=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
  const load=fs.readFileSync(new URL('../tools/whatsapp-simulation-load.mjs',import.meta.url),'utf8');
  assert.match(server,/assertSimulatedProviderEnvironment\(\)/);
  assert.match(route,/providers\/whatsapp-simulated\/events\/:token/);
  assert.match(route,/simulated-submit/);assert.match(route,/campaigns\/:id\/simulated-send/);assert.match(route,/conversations\/:id\/simulated-send/);
  assert.match(route,/submitInProcess/);assert.match(route,/acceptSimulatedEvent/);assert.doesNotMatch(route,/\bfetch\s*\(/);
  assert.match(route,/timeout/);assert.match(route,/rate_limited/);assert.match(route,/server_error/);assert.match(route,/invalid_number/);assert.match(route,/invalid_payload/);assert.match(route,/template_paused/);
  assert.match(route,/simulate_failure=req\.body\?\.simulateFailure===true/);
  assert.match(store,/provider_event_id.*UNIQUE|ON CONFLICT\(provider_event_id\)/s);
  assert.match(store,/wa_contact_suppressions/);assert.match(store,/ctwa_entry_at/);assert.match(store,/cleanupAllSimulatedRecords/);assert.match(store,/ensureSimulatedCampaignConversation/);
  assert.match(migration,/simulated BOOLEAN NOT NULL DEFAULT FALSE/);assert.match(migration,/payload_hash/);assert.match(migration,/wa_simulation_runs/);
  assert.match(faultMigration,/invalid_number/);assert.match(faultMigration,/wa_simulated_provider_control_fault_mode_check/);
  assert.match(ui,/SIMULATED PROVIDER/);assert.match(ui,/data-template-simulate/);assert.match(ui,/data-campaign-simulate/);assert.match(ui,/wa-simulated-reply/);
  assert.match(ui,/id="wa-action-error"/);assert.match(ui,/role="alert"/);assert.match(ui,/showActionError\(error\)/);
  assert.match(load,/requestedConversations/);assert.match(load,/requestedMessages/);assert.match(load,/requestedOptOuts/);assert.match(load,/workers/);assert.match(load,/hoursBack/);assert.match(load,/unread/);
  assert.doesNotMatch(route,/waba-sandbox\.360dialog\.io|graph\.facebook\.com|waba\.360dialog\.io/);
});
