import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {verifyMetaSignature,metaNotificationReferences,referenceDigest,channelWindow,nextMessageWindow,
 applySequenceEvent,evaluateNonvoiceDispatch,suggestLeadTier,evaluateChatContinuation,PILOT_LIMITS,normalizeDeclaredTimeline} from '../src/lead-follow-up-domain.js';
const payload={object:'page',entry:[{id:'100',changes:[{field:'leadgen',value:{page_id:'100',leadgen_id:'200',form_id:'300',created_time:1793066400}}]}]};
const ready={channel:'whatsapp',step:2,country:'IN',locationConfirmed:true,timeZone:'Asia/Kolkata',at:'2026-10-27T08:00:00Z',
 liveEnabled:true,jobGeneration:1,caseGeneration:1,state:'ready',permissionConfirmed:true,restrictionClear:true,identityClear:true,
 scheduledCount:0,templateApproved:true,budgetReserved:true};

test('Meta signatures bind exact raw bytes and fail closed on malformed or absent secrets',()=>{
 const body=JSON.stringify(payload),secret='synthetic-secret-'.repeat(3),signature='sha256='+crypto.createHmac('sha256',secret).update(body).digest('hex');
 assert.equal(verifyMetaSignature(body,signature,secret),true);
 assert.equal(verifyMetaSignature(body+' ',signature,secret),false);
 for(const value of [undefined,'sha256=abc','sha256='+'g'.repeat(64)]) assert.equal(verifyMetaSignature(body,value,secret),false);
 assert.equal(verifyMetaSignature(body,signature,''),false);
});
test('Meta reference parser binds source page, deduplicates and rejects altered batch references',()=>{
 const events=metaNotificationReferences(payload,['100']);assert.equal(events.length,1);
 const duplicate=structuredClone(payload);duplicate.entry[0].changes.push(duplicate.entry[0].changes[0]);
 assert.equal(metaNotificationReferences(duplicate,['100']).length,1);
 assert.throws(()=>metaNotificationReferences(payload,['999']),/UNAPPROVED/);
 const altered=structuredClone(payload);altered.entry[0].changes.push({field:'leadgen',value:{...altered.entry[0].changes[0].value,form_id:'301'}});
 assert.throws(()=>metaNotificationReferences(altered,['100']),/ALTERED/);
 assert.notEqual(referenceDigest(events[0]),referenceDigest({...events[0],formId:'301'}));
});
test('UAE and India windows use confirmed location and have distinct closing boundaries',()=>{
 const args={channel:'voice',country:'IN',locationConfirmed:true,timeZone:'Asia/Kolkata',at:'2026-10-27T13:30:00Z'};
 assert.equal(channelWindow(args).allowed,false);
 assert.equal(channelWindow({...args,country:'AE',timeZone:'Asia/Dubai'}).allowed,true);
 assert.equal(channelWindow({...args,country:'GB'}).allowed,false);
 assert.equal(channelWindow({...args,locationConfirmed:false}).allowed,false);
 assert.equal(channelWindow({...args,at:'2026-10-27T06:00:00Z'}).allowed,true);
});
test('overnight acknowledgement exception does not open general messaging or bypass pilot location',()=>{
 const args={channel:'whatsapp',country:'IN',locationConfirmed:true,timeZone:'Asia/Kolkata',at:'2026-10-27T21:00:00Z'};
 assert.equal(channelWindow({...args,step:0}).allowed,true);
 assert.equal(channelWindow({...args,step:2}).allowed,false);
 assert.equal(channelWindow({...args,step:0,country:'US'}).allowed,false);
 assert.equal(channelWindow({...args,timeZone:null}).reason,'timezone_required');
});
test('deferred messaging enters next local opening and does not run at 9 pm',()=>{
 assert.equal(nextMessageWindow('2026-10-27T15:30:00Z','Asia/Kolkata'),'2026-10-28T03:30:00.000Z');
 assert.equal(nextMessageWindow('2026-10-27T08:00:00.100Z','Asia/Kolkata'),'2026-10-27T08:01:00.000Z');
});
test('reply cancels scheduled generation, permits booking chat and stale callbacks cannot restore it',()=>{
 const current={state:'ready',generation:1};const next=applySequenceEvent(current,{type:'reply',generation:1});
 assert.equal(next.state,'engaged');assert.equal(next.generation,2);assert.equal(next.cancelScheduled,true);assert.equal(next.continueAiChat,true);
 assert.equal(applySequenceEvent(next,{type:'reply',generation:1}).ignored,true);
 assert.equal(applySequenceEvent(next,{type:'reply',generation:2}).generation,3);
});
test('opt-out, takeover and booked states cannot restart from later replies',()=>{
 for(const type of ['opt_out','wrong_person','takeover','booking']){
 const stopped=applySequenceEvent({state:'ready',generation:1},{type,generation:1});
 assert.equal(stopped.continueAiChat,false);assert.equal(applySequenceEvent(stopped,{type:'reply',generation:2}).ignored,true);
 }
});
test('unknown outcome pauses sequence with explicit reconciliation work',()=>{
 const next=applySequenceEvent({state:'ready',generation:1},{type:'unknown_outcome',generation:1});
 assert.equal(next.nextAction,'reconcile_provider');assert.equal(next.cancelScheduled,true);
});
test('nonvoice dispatch independently gates activation, permission, generation, template, cap and budget',()=>{
 assert.equal(evaluateNonvoiceDispatch(ready).allowed,true);
 for(const patch of [{liveEnabled:false},{permissionConfirmed:false},{restrictionClear:false},{identityClear:false},
 {jobGeneration:0},{state:'engaged'},{templateApproved:false},{scheduledCount:3},{scheduledCount:-1},{budgetReserved:false},
 {providerOutcomeUnknown:true},{channel:'voice'},{country:'CA'}]) assert.equal(evaluateNonvoiceDispatch({...ready,...patch}).allowed,false);
});
test('a valid active customer window can allow a reply without a template but never missing permission',()=>{
 assert.equal(evaluateNonvoiceDispatch({...ready,templateApproved:false,customerWindowOpen:true}).allowed,true);
 assert.equal(evaluateNonvoiceDispatch({...ready,templateApproved:false,customerWindowOpen:true,permissionConfirmed:false}).allowed,false);
});
test('missing score dimensions stay unknown, conflicts require human review and qualification is never written',()=>{
 const partial=suggestLeadTier({dimensions:{timing:3}});assert.equal(partial.score,null);assert.equal(partial.suggestedTier,null);
 assert.equal(suggestLeadTier({requestedBooking:true,dimensions:{}}).suggestedTier,'Hot');
 const full={timing:3,requirements:2,budget:2,nextAction:2};assert.equal(suggestLeadTier({dimensions:full}).suggestedTier,'Hot');
 assert.equal(suggestLeadTier({dimensions:full,timelineConflict:true}).suggestedTier,null);
 assert.equal(suggestLeadTier({noResponse:true}).suggestedTier,'Unreached');
 assert.throws(()=>suggestLeadTier({dimensions:{timing:4}}),/INVALID_SCORE/);
 assert.equal(suggestLeadTier({dimensions:full}).humanConfirmationRequired,true);
});

test('full sign-off blocks ALL automated channels for unknown or nonpilot timezones, including step zero',()=>{
 for(const channel of ['whatsapp','email','voice']) for(const step of [0,1,2]){
  for(const timeZone of [undefined,'Europe/London','America/New_York','Asia/Dubai'])
   assert.equal(channelWindow({channel,step,country:'IN',locationConfirmed:true,timeZone,at:'2026-10-27T08:00:00Z'}).allowed,false);
 }
 assert.equal(channelWindow({channel:'whatsapp',step:0,country:'IN',locationConfirmed:true,timeZone:'Asia/Kolkata',at:'2026-10-27T21:00:00Z'}).allowed,true);
});
test('responsive chat permits slow replies within 24 hours but hands off after 10 without progress',()=>{
 const chat={openedAt:'2026-10-27T06:00:00Z',now:'2026-10-27T07:00:00Z',repliesWithoutProgress:9};
 assert.equal(evaluateChatContinuation(chat).allowed,true);
 assert.equal(evaluateChatContinuation({...chat,repliesWithoutProgress:10}).reason,'no_booking_progress');
 assert.equal(evaluateChatContinuation({...chat,now:'2026-10-28T06:00:00Z'}).reason,'chat_expired');
 for(const patch of [{restricted:true},{booked:true},{humanTakenOver:true}]) assert.equal(evaluateChatContinuation({...chat,...patch}).allowed,false);
 assert.throws(()=>evaluateChatContinuation({...chat,repliesWithoutProgress:-1}),/INVALID_CHAT_COUNTER/);
});
test('signed limits and immediate timeline mapping are explicit without inferring other answers',()=>{
 assert.equal(PILOT_LIMITS.maxCallMinutes,8);assert.equal(PILOT_LIMITS.voiceDailyUsd,20);
 assert.equal(PILOT_LIMITS.messagingDailyUsd,10);assert.equal(PILOT_LIMITS.budgetTimeZone,'Asia/Dubai');
 assert.equal(normalizeDeclaredTimeline('Immediately'),'within_30_days');assert.equal(normalizeDeclaredTimeline(''),null);
});
