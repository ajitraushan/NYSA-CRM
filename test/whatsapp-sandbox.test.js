import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {buildSandboxMessage, submitSandboxMessage, parseSandboxEvents, verifySandboxRelay,verifySandboxBasic, SANDBOX_MESSAGES_URL} from '../src/whatsapp-sandbox.js';

const now = Date.parse('2026-11-01T08:00:00Z');
const env = {WHATSAPP_SANDBOX_ENABLED: 'true', LEAD_RESPONSE_ENVIRONMENT: 'crm-test',
  WHATSAPP_SANDBOX_API_KEY: 'synthetic-not-a-real-key', WHATSAPP_SANDBOX_RECIPIENT_KIND: 'phone', WHATSAPP_SANDBOX_RECIPIENT: '+919900000001'};
const input = {recipient: env.WHATSAPP_SANDBOX_RECIPIENT, type: 'text', text: 'Synthetic reply', lastInboundAt: new Date(now - 1000).toISOString()};
const response = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const packet = value => ({entry: [{changes: [{field: 'messages', value}]}]});
const message = {from: '919900000001', id: 'wamid.synthetic:1', timestamp: String(now / 1000), type: 'text', text: {body: 'Please send the floor plan'}};
const parse = value => parseSandboxEvents(packet(value), {recipientKind: 'phone', recipient: input.recipient, now});

test('sandbox is separately disabled by default and cannot use production or another recipient', () => {
  for (const settings of [{}, {...env, WHATSAPP_SANDBOX_ENABLED: 'false'}, {...env, LEAD_RESPONSE_ENVIRONMENT: 'production'}])
    assert.throws(() => buildSandboxMessage(input, {env: settings, now}), /SANDBOX_DISABLED/);
  assert.throws(() => buildSandboxMessage({...input, recipient: '+919900000002'}, {env, now}), /NOT_APPROVED/);
  assert.throws(() => buildSandboxMessage({...input, endpoint: 'https://example.invalid'}, {env, now}), /ENVELOPE_INVALID/);
  assert.throws(() => buildSandboxMessage(input, {env: {...env, WHATSAPP_SANDBOX_API_KEY: 'bad\r\nheader'}, now}), /CONFIGURATION_INVALID/);
});

test('text window and predefined templates use the fixed sandbox contract', () => {
  assert.deepEqual(buildSandboxMessage(input, {env, now}), {messaging_product: 'whatsapp', recipient_type: 'individual', to: '919900000001', type: 'text', text: {body: input.text}});
  for (const lastInboundAt of ['invalid', new Date(now + 1).toISOString(), new Date(now - 24 * 3600000).toISOString()])
    assert.throws(() => buildSandboxMessage({...input, lastInboundAt}, {env, now}), /WINDOW_CLOSED/);
  const template = {recipient: input.recipient, type: 'template', templateName: 'disclaimer'};
  assert.deepEqual(buildSandboxMessage(template, {env, now}).template.components, []);
  assert.throws(() => buildSandboxMessage({...template, parameters: ['extra']}, {env, now}), /ENVELOPE_INVALID/);
  assert.throws(() => buildSandboxMessage({...template, templateName: 'custom_marketing'}, {env, now}), /TEMPLATE_UNSUPPORTED/);
  assert.equal(buildSandboxMessage({...template, templateName: 'first_welcome_messsage', parameters: ['Synthetic']}, {env, now}).template.components[0].parameters[0].text, 'Synthetic');
});

test('BSUID accounts never synthesize phone numbers', () => {
  const settings = {...env, WHATSAPP_SANDBOX_RECIPIENT_KIND: 'bsuid', WHATSAPP_SANDBOX_RECIPIENT: 'synthetic:user:1'};
  const body = buildSandboxMessage({...input, recipient: settings.WHATSAPP_SANDBOX_RECIPIENT}, {env: settings, now});
  assert.equal(body.recipient, 'synthetic:user:1'); assert.equal(body.to, undefined);
  const incoming = {...message, from_user_id: 'synthetic:user:1'}; delete incoming.from;
  const events = parseSandboxEvents(packet({messages: [incoming]}), {recipientKind: 'bsuid', recipient: 'synthetic:user:1', now});
  assert.equal(events[0].type, 'reply');
  assert.throws(() => parseSandboxEvents(packet({messages: [{...incoming, from: '919900000001'}]}), {recipientKind: 'bsuid', recipient: 'synthetic:user:1', now}), /EVENT_INVALID/);
});

test('provider cannot be contacted without a successful durable attempt claim', async () => {
  let calls = 0; const fetchImpl = async () => { calls++; return response(201, {messages: [{id: 'wamid.synthetic'}]}); };
  await assert.rejects(() => submitSandboxMessage(input, {env, now, fetchImpl}), /DURABLE_ATTEMPT_REQUIRED/);
  await assert.rejects(() => submitSandboxMessage(input, {env, now, fetchImpl, claimAttempt: async () => ({id: 'existing', state: 'accepted'}), recordOutcome: async () => {}}), /NOT_RESERVED/);
  await assert.rejects(() => submitSandboxMessage(input, {env, now, fetchImpl, claimAttempt: async () => {throw new Error('QUOTA_HOLD');}, recordOutcome: async () => {}}), /QUOTA_HOLD/);
  assert.equal(calls, 0);
});

test('accepted send uses header credential, forbids redirects and records outcome once', async () => {
  let claims = 0, calls = 0; const saved = [];
  const result = await submitSandboxMessage(input, {env, now,
    claimAttempt: async ({body}) => {claims++; assert.equal(body.text.body, input.text); return {id: 'attempt-1', state: 'reserved'};},
    recordOutcome: async (id, outcome) => saved.push({id, outcome}),
    fetchImpl: async (url, options) => {calls++; assert.equal(url, SANDBOX_MESSAGES_URL); assert.equal(options.redirect, 'error'); assert.equal(options.headers['D360-API-KEY'], env.WHATSAPP_SANDBOX_API_KEY); assert.ok(!options.body.includes(env.WHATSAPP_SANDBOX_API_KEY)); return response(201, {messages: [{id: 'wamid.synthetic'}]});}
  });
  assert.equal(result.state, 'accepted'); assert.equal(result.providerRef, 'wamid.synthetic');
  assert.equal(claims, 1); assert.equal(calls, 1); assert.equal(saved.length, 1); assert.ok(!JSON.stringify(result).includes(env.WHATSAPP_SANDBOX_API_KEY));
});

test('known rejection and exhausted quota are distinct from ambiguous submissions; no automatic retry', async () => {
  for (const status of [400, 401, 403, 404, 413, 422, 429, 500, 502, 504]) {
    let calls = 0;
    const result = await submitSandboxMessage(input, {env, now, claimAttempt: async () => ({id: 'attempt', state: 'reserved'}), recordOutcome: async () => {}, fetchImpl: async () => {calls++; return response(status, {secret: env.WHATSAPP_SANDBOX_API_KEY});}});
    assert.equal(calls, 1); assert.equal(result.state, status < 500 ? 'rejected' : 'outcome_unknown');
    if (status === 429) assert.equal(result.code, 'SANDBOX_QUOTA_EXHAUSTED');
    assert.ok(!JSON.stringify(result).includes(env.WHATSAPP_SANDBOX_API_KEY));
  }
});

test('timeouts, malformed/oversized receipts and persistence failure do not falsely report success', async () => {
  for (const fetchImpl of [async () => {throw new Error(env.WHATSAPP_SANDBOX_API_KEY);}, async () => response(201, {}), async () => new Response('x'.repeat(17000)), async () => response(201, {messages: [{id: '<invalid>'}]})]) {
    const result = await submitSandboxMessage(input, {env, now, fetchImpl, claimAttempt: async () => ({id: 'attempt', state: 'reserved'}), recordOutcome: async () => {}});
    assert.equal(result.state, 'outcome_unknown'); assert.ok(!JSON.stringify(result).includes(env.WHATSAPP_SANDBOX_API_KEY));
  }
  await assert.rejects(() => submitSandboxMessage(input, {env, now, fetchImpl: async () => response(201, {messages: [{id: 'wamid.synthetic'}]}), claimAttempt: async () => ({id: 'attempt', state: 'reserved'}), recordOutcome: async () => {throw new Error('database unavailable');}}), /OUTCOME_PERSISTENCE_REQUIRED/);
});

test('sandbox events omit live account metadata but retain stable message/status identities', () => {
  const events = parse({messages: [message], statuses: [{id: message.id, recipient_id: message.from, timestamp: message.timestamp, status: 'read'}]});
  assert.equal(events.length, 2); assert.equal(events[0].eventRef, message.id); assert.equal(events[1].type, 'delivery_status');
  assert.deepEqual(parse({messages: [message]}), parse({messages: [message]}));
  assert.equal(parse({messages: [{...message, text: {body: ' STOP please'}}]})[0].type, 'opt_out');
  assert.equal(parse({messages: [{...message, type: 'image', text: undefined}]})[0].type, 'unsupported');
});

test('wrong sender, malformed event structures, invalid timestamps and oversized batches fail atomically', () => {
  for (const value of [{messages: [{...message, from: '919900000002'}]}, {messages: {}}, {messages: [null]},
    {messages: [{...message, timestamp: 'invalid'}]}, {messages: [{...message, timestamp: String(now / 1000 + 301)}]},
    {messages: [{...message, text: {body: 'x'.repeat(10001)}}]}, {statuses: [{id: message.id, recipient_id: message.from, timestamp: message.timestamp, status: 'invented'}]}, {messages: Array(101).fill(message)}])
    assert.throws(() => parse(value), /SANDBOX_EVENT/);
  assert.throws(() => parseSandboxEvents({entry: [null]}, {recipientKind: 'phone', recipient: input.recipient, now}), /EVENT_INVALID/);
});

test('dual identities require the approved phone and retain the BSUID as evidence only',()=>{
 const dual={...message,from_user_id:'synthetic:user:1'};
 assert.deepEqual(parse({messages:[dual]})[0].identity,{phone:message.from,businessScopedUserId:'synthetic:user:1'});
 const status={id:message.id,recipient_id:message.from,recipient_user_id:'synthetic:user:1',timestamp:message.timestamp,status:'read'};
 assert.deepEqual(parse({statuses:[status]})[0].identity,{phone:message.from,businessScopedUserId:'synthetic:user:1'});
 for(const [from,reason]of [[undefined,'recipient_missing'],['919900000002','recipient_mismatch']]){
  assert.throws(()=>parse({messages:[{...dual,from}]}),e=>e.message==='SANDBOX_EVENT_RECIPIENT_MISMATCH'&&e.sandboxDiagnostic===reason);
 }
 for(const from_user_id of ['',null,{},'x'.repeat(161)])assert.throws(()=>parse({messages:[{...dual,from_user_id}]}),e=>e.sandboxDiagnostic==='alternate_identity');
});

test('relay verification binds exact raw bytes and timestamp; it is not advertised as native authentication', () => {
  const rawBody = JSON.stringify(packet({messages: [message]})), timestamp = String(now), secret = 'synthetic-relay-secret-'.repeat(3);
  const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(timestamp + '.' + rawBody).digest('hex');
  assert.equal(verifySandboxRelay({rawBody, timestamp, signature, secret, now}), true);
  assert.equal(verifySandboxRelay({rawBody: rawBody + ' ', timestamp, signature, secret, now}), false);
  assert.equal(verifySandboxRelay({rawBody, timestamp, signature, secret, now: now + 300001}), false);
  assert.equal(verifySandboxRelay({rawBody, timestamp, signature: 'invalid', secret, now}), false);
  assert.equal(verifySandboxRelay({rawBody, timestamp, signature, secret: '', now}), false);
});
test('Basic callback probe requires the exact strong configured header',()=>{
 const secret='synthetic-native-secret-'.repeat(3),authorization='Basic '+Buffer.from('nysa-sandbox:'+secret).toString('base64');
 assert.equal(verifySandboxBasic({authorization,secret}),true);
 assert.equal(verifySandboxBasic({authorization:authorization+'x',secret}),false);
 assert.equal(verifySandboxBasic({authorization,secret:'short'}),false);
 assert.equal(verifySandboxBasic({authorization:undefined,secret}),false);
});
