import crypto from 'node:crypto';

export const FOLLOW_UP_POLICY_VERSION = 'NYSA-CRM-20261026-LEAD-001-v1.2';
export const PILOT_COUNTRIES = Object.freeze(['AE', 'IN']);
export const PILOT_LIMITS = Object.freeze({voiceDailyUsd:20, messagingDailyUsd:10, budgetTimeZone:'Asia/Dubai',
  maxCallMinutes:8, voiceConcurrency:2, chatMaxHours:24, chatRepliesWithoutProgress:10});
const pilotTimeZones = Object.freeze({AE:'Asia/Dubai',IN:'Asia/Kolkata'});
export const SEQUENCE_CHANNELS = Object.freeze(['whatsapp', 'voice', 'whatsapp', 'email', 'voice', 'whatsapp', 'email', 'handoff']);
const cap = Object.freeze({voice: 2, whatsapp: 3, email: 2});
const terminal = new Set(['opted_out', 'wrong_person', 'human_owned', 'booked', 'complete']);
function instant(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.valueOf())) throw new Error('INVALID_TIME');
  return date;
}
export function verifyMetaSignature(rawBody, signature, secret) {
  if (typeof secret !== 'string' || secret.length < 32 || typeof rawBody !== 'string' ||
      typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  return crypto.timingSafeEqual(Buffer.from(signature.slice(7), 'hex'), expected);
}
export function metaNotificationReferences(payload, allowedPageIds) {
  if (payload?.object !== 'page' || !Array.isArray(payload.entry) || !payload.entry.length || payload.entry.length > 100)
    throw new Error('INVALID_META_ENVELOPE');
  const allowed = new Set(allowedPageIds);
  const events = new Map();
  for (const entry of payload.entry) {
    if (!allowed.has(String(entry.id)) || !Array.isArray(entry.changes)) throw new Error('UNAPPROVED_META_PAGE');
    for (const change of entry.changes) {
      if (change.field !== 'leadgen') continue;
      const v = change.value;
      if (!v || !/^\d{1,100}$/.test(String(v.leadgen_id)) || !/^\d{1,100}$/.test(String(v.form_id)) ||
          String(v.page_id) !== String(entry.id) || !Number.isSafeInteger(v.created_time) || v.created_time <= 0)
        throw new Error('INVALID_META_LEAD_REFERENCE');
      const event = {pageId: String(entry.id), eventId: String(v.leadgen_id), formId: String(v.form_id),
        sourceCreatedAt: instant(v.created_time * 1000).toISOString()};
      const key = `${event.pageId}:${event.eventId}`;
      const old = events.get(key);
      if (old && JSON.stringify(old) !== JSON.stringify(event)) throw new Error('ALTERED_META_EVENT');
      events.set(key, event);
      if (events.size > 100) throw new Error('META_BATCH_TOO_LARGE');
    }
  }
  return [...events.values()];
}
export const referenceDigest = event => crypto.createHash('sha256').update(JSON.stringify([
  event.pageId, event.eventId, event.formId, event.sourceCreatedAt
])).digest('hex');
function localParts(at, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
  return Object.fromEntries(formatter.formatToParts(instant(at)).filter(p=>p.type !== 'literal').map(p=>[p.type,p.value]));
}
export function channelWindow({channel, country, locationConfirmed, timeZone, at, step}) {
  if (locationConfirmed !== true || !PILOT_COUNTRIES.includes(country)) return {allowed:false, reason:'pilot_location_unconfirmed'};
  if (!timeZone) return {allowed:false, reason:'timezone_required'};
  if (timeZone !== pilotTimeZones[country]) return {allowed:false, reason:'pilot_timezone_mismatch'};
  instant(at);
  if (channel === 'voice') {
    const p = localParts(at, 'Asia/Dubai'), minute = Number(p.hour) * 60 + Number(p.minute);
    return {allowed: minute >= 600 && minute < (country === 'IN' ? 1050 : 1080), reason:'calling_hours'};
  }
  if (!['email','whatsapp'].includes(channel)) return {allowed:false, reason:'unsupported_channel'};
  if (channel === 'whatsapp' && step === 0) return {allowed:true, reason:'immediate_acknowledgement'};
  if (!timeZone) return {allowed:false, reason:'timezone_required'};
  try {
    const p = localParts(at, timeZone), minute = Number(p.hour) * 60 + Number(p.minute);
    return {allowed:minute >= 540 && minute < 1260, reason:'messaging_hours'};
  } catch { return {allowed:false, reason:'timezone_invalid'}; }
}
export function nextMessageWindow(at, timeZone) {
  const date = instant(at);
  // Minute precision is sufficient for these policy windows; bound search across DST changes.
  date.setUTCSeconds(0,0);
  if (date < instant(at)) date.setUTCMinutes(date.getUTCMinutes()+1);
  for (let i=0;i<48*60;i++) {
    const p = localParts(date, timeZone), minute=Number(p.hour)*60+Number(p.minute);
    if (minute>=540 && minute<1260) return date.toISOString();
    date.setUTCMinutes(date.getUTCMinutes()+1);
  }
  throw new Error('MESSAGE_WINDOW_NOT_FOUND');
}
export function applySequenceEvent(current, event) {
  if (!Number.isSafeInteger(current.generation) || current.generation < 1) throw new Error('INVALID_GENERATION');
  const restriction = ['opt_out','wrong_person'].includes(event.type);
  if (event.generation !== current.generation && !restriction) return {...current, ignored:true};
  if (terminal.has(current.state) && (!restriction || ['opted_out','wrong_person'].includes(current.state))) return {...current, ignored:true};
  if (current.state === 'outcome_unknown' && !['opt_out','wrong_person','takeover'].includes(event.type)) return {...current, ignored:true};
  const state = {reply:'engaged', booking:'booked', opt_out:'opted_out', wrong_person:'wrong_person',
    takeover:'human_owned', unknown_outcome:'outcome_unknown'}[event.type];
  if (!state) throw new Error('UNSUPPORTED_SEQUENCE_EVENT');
  // Duplicate replies do not advance the generation or spawn another booking conversation.
  if (current.state === state) return {...current, ignored:true};
  return {...current, state, generation:current.generation+1, cancelScheduled:true,
    continueAiChat:event.type === 'reply', nextAction:event.type === 'reply' ? 'booking_conversation' :
      event.type === 'unknown_outcome' ? 'reconcile_provider' : event.type === 'booking' ? 'human_booking_follow_up' :
      event.type === 'takeover' ? 'human_follow_up' : 'restriction_review'};
}
export function evaluateNonvoiceDispatch(input) {
  if (input.liveEnabled !== true) return {allowed:false, reason:'dispatch_disabled'};
  if (!['whatsapp','email'].includes(input.channel)) return {allowed:false, reason:'voice_not_implemented'};
  if (input.jobGeneration !== input.caseGeneration || input.state !== 'ready') return {allowed:false, reason:'stale_or_paused_case'};
  if (input.permissionConfirmed !== true || input.restrictionClear !== true || input.identityClear !== true)
    return {allowed:false, reason:'contact_permission_required'};
  if (input.providerOutcomeUnknown === true) return {allowed:false, reason:'outcome_unknown'};
  if (!Number.isSafeInteger(input.scheduledCount) || input.scheduledCount < 0 || input.scheduledCount >= cap[input.channel])
    return {allowed:false, reason:'sequence_cap'};
  const window = channelWindow(input);
  if (!window.allowed) return window;
  if (input.channel === 'whatsapp' && input.customerWindowOpen !== true && input.templateApproved !== true)
    return {allowed:false, reason:'approved_template_required'};
  if (input.budgetReserved !== true) return {allowed:false, reason:'budget_not_reserved'};
  return {allowed:true, reason:'eligible'};
}
export function suggestLeadTier({dimensions, requestedBooking=false, timelineConflict=false, noResponse=false}) {
  if (noResponse) return {score:null, suggestedTier:'Unreached', humanConfirmationRequired:true};
  const names=['timing','requirements','budget','nextAction'];
  const values=names.map(name=>dimensions?.[name]);
  if (values.some(v=>v !== null && v !== undefined && (!Number.isInteger(v)||v<0||v>3))) throw new Error('INVALID_SCORE');
  const missing=names.filter((_,i)=>values[i]===null || values[i]===undefined);
  const score=missing.length ? null : values.reduce((a,b)=>a+b,0);
  const suggestedTier=requestedBooking ? 'Hot' : missing.length || timelineConflict ? null : score>=9?'Hot':score>=5?'Warm':'Cold';
  return {score, missing, suggestedTier, requiresReview:timelineConflict||missing.length>0,
    humanConfirmationRequired:true, rubricVersion:FOLLOW_UP_POLICY_VERSION};
}


// Caller persists these counters transactionally and deduplicates reply events before applying.
// Progress is a validated booking-workflow event, never an untrusted model assertion.
export function evaluateChatContinuation({openedAt, now, repliesWithoutProgress, booked=false, humanTakenOver=false, restricted=false}) {
  if (!Number.isSafeInteger(repliesWithoutProgress) || repliesWithoutProgress < 0) throw new Error('INVALID_CHAT_COUNTER');
  const age = instant(now).valueOf() - instant(openedAt).valueOf();
  if (age < 0) throw new Error('INVALID_CHAT_TIME');
  if (restricted || humanTakenOver || booked) return {allowed:false, nextAction:restricted?'restriction_review':'human_follow_up'};
  if (age >= PILOT_LIMITS.chatMaxHours * 3600000) return {allowed:false, nextAction:'human_handoff',reason:'chat_expired'};
  if (repliesWithoutProgress >= PILOT_LIMITS.chatRepliesWithoutProgress) return {allowed:false,nextAction:'human_handoff',reason:'no_booking_progress'};
  return {allowed:true,reason:'booking_conversation'};
}
export function normalizeDeclaredTimeline(value) {
  return value === 'Immediately' ? 'within_30_days' : null;
}
