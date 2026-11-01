import crypto from 'node:crypto';

// WA-001 Stage A: separate from the existing live adapter. No retries, arbitrary
// hosts, credential logging, or automatic activation. Persistence is supplied by
// the caller; a durable claim is mandatory before any provider submission.
export const SANDBOX_MESSAGES_URL = 'https://waba-sandbox.360dialog.io/v1/messages';
const MAX_BYTES = 256 * 1024;
const phone = value => typeof value === 'string' && /^\+[1-9]\d{7,14}$/.test(value);
const bsuid = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value);
const fail = (code, diagnostic) => { const error=new Error(code); if(diagnostic)error.sandboxDiagnostic=diagnostic; throw error; };

function configuration(env) {
  if (env.WHATSAPP_SANDBOX_ENABLED !== 'true' ||
      !['local', 'crm-test'].includes(env.LEAD_RESPONSE_ENVIRONMENT)) fail('SANDBOX_DISABLED');
  const key = env.WHATSAPP_SANDBOX_API_KEY;
  if (typeof key !== 'string' || !key.trim() || key.length > 4096 || /[\r\n]/.test(key)) fail('SANDBOX_CONFIGURATION_INVALID');
  const kind = env.WHATSAPP_SANDBOX_RECIPIENT_KIND;
  const recipient = env.WHATSAPP_SANDBOX_RECIPIENT;
  if (!(kind === 'phone' ? phone(recipient) : kind === 'bsuid' && bsuid(recipient))) fail('SANDBOX_CONFIGURATION_INVALID');
  return {key, kind, recipient};
}

export function buildSandboxMessage(input, {env = process.env, now = Date.now()} = {}) {
  const config = configuration(env);
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.recipient !== config.recipient)
    fail('SANDBOX_RECIPIENT_NOT_APPROVED');
  const allowed = ['recipient', 'type', 'text', 'lastInboundAt', 'templateName', 'parameters'];
  if (Object.keys(input).some(key => !allowed.includes(key))) fail('SANDBOX_ENVELOPE_INVALID');
  const body = {messaging_product: 'whatsapp',
    ...(config.kind === 'phone' ? {recipient_type: 'individual', to: config.recipient.slice(1)} : {recipient: config.recipient})};
  if (input.type === 'text') {
    if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 1500 ||
        input.templateName !== undefined || input.parameters !== undefined) fail('SANDBOX_ENVELOPE_INVALID');
    // Caller must obtain this timestamp from verified durable inbound evidence.
    const age = now - Date.parse(input.lastInboundAt);
    if (!Number.isFinite(age) || age < 0 || age >= 24 * 3600000) fail('SANDBOX_CUSTOMER_WINDOW_CLOSED');
    return {...body, type: 'text', text: {body: input.text}};
  }
  if (input.type !== 'template' || input.text !== undefined || input.lastInboundAt !== undefined)
    fail('SANDBOX_ENVELOPE_INVALID');
  const expected = {disclaimer: 0, first_welcome_messsage: 1};
  if (!Object.hasOwn(expected, input.templateName)) fail('SANDBOX_TEMPLATE_UNSUPPORTED');
  const parameters = input.parameters ?? [];
  if (!Array.isArray(parameters) || parameters.length !== expected[input.templateName] ||
      parameters.some(value => typeof value !== 'string' || !value.trim() || value.length > 500))
    fail('SANDBOX_ENVELOPE_INVALID');
  return {...body, type: 'template', template: {name: input.templateName, language: {code: 'en'},
    components: parameters.length ? [{type: 'body', parameters: parameters.map(text => ({type: 'text', text}))}] : []}};
}

export async function boundedSandboxJson(response) {
  if (!response.body) fail('SANDBOX_PROVIDER_RESPONSE_INVALID');
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) fail('SANDBOX_PROVIDER_RESPONSE_INVALID');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function submitSandboxMessage(input, {
  env = process.env, fetchImpl = fetch, now = Date.now(), claimAttempt, recordOutcome
} = {}) {
  const body = buildSandboxMessage(input, {env, now});
  const {key} = configuration(env);
  if (typeof claimAttempt !== 'function' || typeof recordOutcome !== 'function') fail('SANDBOX_DURABLE_ATTEMPT_REQUIRED');
  // claimAttempt must reserve quota durably and reject duplicate logical actions.
  // Never store the API key in the claim or its public result.
  const claim = await claimAttempt({body});
  if (!claim || claim.state !== 'reserved' || typeof claim.id !== 'string' || !claim.id) fail('SANDBOX_ATTEMPT_NOT_RESERVED');
  let outcome;
  try {
    const response = await fetchImpl(SANDBOX_MESSAGES_URL, {method: 'POST', redirect: 'error',
      headers: {'D360-API-KEY': key, 'Content-Type': 'application/json'},
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000)});
    if ([400, 401, 403, 404, 413, 422, 429].includes(response.status)) {
      await response.body?.cancel().catch(() => {});
      outcome = {state: 'rejected', code: response.status === 429 ? 'SANDBOX_QUOTA_EXHAUSTED' : 'SANDBOX_PROVIDER_REJECTED', httpStatus: response.status};
    } else if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      outcome = {state: 'outcome_unknown', code: 'SANDBOX_SUBMISSION_OUTCOME_UNKNOWN'};
    } else {
      const result = await boundedSandboxJson(response);
      const providerRef = result?.messages?.[0]?.id;
      if (typeof providerRef !== 'string' || !/^[A-Za-z0-9_.:+/=-]{1,200}$/.test(providerRef)) fail('SANDBOX_PROVIDER_RESPONSE_INVALID');
      outcome = {state: 'accepted', providerRef};
    }
  } catch {
    // Includes timeout, redirects, malformed receipts and transport exceptions.
    // A submitted request may have succeeded: it must never be retried blindly.
    outcome = {state: 'outcome_unknown', code: 'SANDBOX_SUBMISSION_OUTCOME_UNKNOWN'};
  }
  try { await recordOutcome(claim.id, outcome); }
  catch { fail('SANDBOX_OUTCOME_PERSISTENCE_REQUIRED'); }
  return {attemptId: claim.id, ...outcome};
}

// This verifies the NYSA authenticated relay contract, NOT a native 360dialog
// signature. Real callback/header support must be proven before enabling ingress.
export function verifySandboxRelay({rawBody, timestamp, signature, secret, now = Date.now()}) {
  if (typeof rawBody !== 'string' || Buffer.byteLength(rawBody) > MAX_BYTES ||
      typeof secret !== 'string' || secret.length < 32 ||
      typeof timestamp !== 'string' || !/^\d{13}$/.test(timestamp) ||
      Math.abs(now - Number(timestamp)) > 300000 ||
      typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(timestamp + '.' + rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Optional provider-configured Basic header, separate from the signed relay.
// Enable only for the controlled sandbox authentication probe / approved path.
export function verifySandboxBasic({authorization, secret}) {
  if(typeof authorization!=='string'||authorization.length>4096||typeof secret!=='string'||secret.length<32)return false;
  const hash=value=>crypto.createHash('sha256').update(value).digest();
  const expected='Basic '+Buffer.from('nysa-sandbox:'+secret).toString('base64');
  return crypto.timingSafeEqual(hash(authorization),hash(expected));
}

export function parseSandboxEvents(body, {recipientKind, recipient, now = Date.now()} = {}) {
  if (!(recipientKind === 'phone' ? phone(recipient) : recipientKind === 'bsuid' && bsuid(recipient))) fail('SANDBOX_CONFIGURATION_INVALID');
  if (!body || typeof body !== 'object' || !Array.isArray(body.entry) || body.entry.length > 20 ||
      Buffer.byteLength(JSON.stringify(body)) > MAX_BYTES) fail('SANDBOX_EVENT_INVALID','envelope');
  const events = [];
  function identity(item, status) {
    const value = recipientKind === 'phone' ? item[status ? 'recipient_id' : 'from'] : item[status ? 'recipient_user_id' : 'from_user_id'];
    if (typeof value !== 'string' || value !== (recipientKind === 'phone' ? recipient.slice(1) : recipient)) fail('SANDBOX_EVENT_RECIPIENT_MISMATCH');
    // Reject conflicting alternate identities instead of choosing one silently.
    const other = recipientKind === 'phone' ? item[status ? 'recipient_user_id' : 'from_user_id'] : item[status ? 'recipient_id' : 'from'];
    if (other !== undefined) fail('SANDBOX_EVENT_INVALID','alternate_identity');
  }
  function base(item) {
    if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_.:+/=-]{1,200}$/.test(item.id)) fail('SANDBOX_EVENT_INVALID','message_id');
    if(typeof item.timestamp !== 'string' || !/^\d{1,12}$/.test(item.timestamp)) fail('SANDBOX_EVENT_INVALID','timestamp_format');
    const millis = Number(item.timestamp) * 1000;
    if (millis <= 0 || millis > now + 300000) fail('SANDBOX_EVENT_INVALID','timestamp_range');
    return {messageRef: item.id, occurredAt: new Date(millis).toISOString()};
  }
  for (const entry of body.entry) {
    if (!entry || !Array.isArray(entry.changes) || entry.changes.length > 20) fail('SANDBOX_EVENT_INVALID','changes');
    for (const change of entry.changes) {
      if (!change || change.field !== 'messages' || !change.value || typeof change.value !== 'object') fail('SANDBOX_EVENT_INVALID','change_value');
      const value = change.value;
      for (const field of ['messages', 'statuses']) if (value[field] !== undefined && (!Array.isArray(value[field]) || value[field].length > 100)) fail('SANDBOX_EVENT_INVALID','event_array');
      for (const item of value.messages ?? []) {
        const common = base(item); identity(item, false);
        if (item.type === 'text' && (typeof item.text?.body !== 'string' || item.text.body.length > 10000)) fail('SANDBOX_EVENT_INVALID','text_format');
        const text = item.type === 'text' ? item.text.body : '';
        const type = item.type !== 'text' ? 'unsupported' : /^\s*(stop|unsubscribe|do not contact)\b/i.test(text) ? 'opt_out' : 'reply';
        events.push({...common, eventRef: item.id, type, text});
      }
      for (const item of value.statuses ?? []) {
        const common = base(item); identity(item, true);
        if (!['sent', 'delivered', 'read', 'failed'].includes(item.status)) fail('SANDBOX_EVENT_INVALID','delivery_status');
        events.push({...common, eventRef: `status:${item.id}:${item.status}:${item.timestamp}`, type: 'delivery_status', status: item.status});
      }
      if (events.length > 100) fail('SANDBOX_EVENT_LIMIT');
    }
  }
  return events;
}
