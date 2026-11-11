const nextSteps = ['follow_up','retry_cadence','close_not_interested','close_dnc','close_wrong_number','convert'];
const noContact = new Set(['no_answer','voicemail','consumer_ended']);
const closeSteps = ['close_not_interested','close_dnc','close_wrong_number'];
const text = value => typeof value === 'string' ? value.trim() : '';

export function validateProspectNextStep(body, now = Date.now()) {
  const step = text(body.nextStep);
  if (!nextSteps.includes(step)) return { error: 'Choose exactly one next step' };
  const outcome = body.outcome;
  if ((['interested','callback_requested'].includes(outcome) && !['follow_up','convert'].includes(step)) ||
      (outcome === 'not_interested' && !closeSteps.includes(step)) ||
      (outcome === 'declined' && !closeSteps.includes(step) && !(step === 'follow_up' && text(body.warningReason).length >= 5)) ||
      (outcome === 'invalid_number' && step !== 'close_wrong_number') ||
      (step === 'retry_cadence' && !noContact.has(outcome))) {
    return { error: 'The next step is incompatible with the call outcome' };
  }
  const reason = text(body.notInterestedReason);
  const note = text(body.notInterestedNote);
  const month = text(body.recontactMonth);
  if ((step === 'close_not_interested' || outcome === 'declined' || reason) && !/^[a-z][a-z0-9_]{0,63}$/.test(reason)) {
    return { error: 'Select a valid not-interested reason' };
  }
  if (reason === 'other' && note.length < 5) return { error: 'Explain the Other reason in at least five characters' };
  if (month && (reason !== 'timing' || !/^[2-9][0-9]{3}-(0[1-9]|1[0-2])$/.test(month))) {
    return { error: 'Select a valid recontact month for the timing reason' };
  }
  if (step === 'close_dnc' && text(body.doNotContactReason).length < 5) {
    return { error: 'A meaningful do-not-contact reason is required' };
  }
  let followUp = null;
  if (step === 'follow_up') {
    const due = Date.parse(body.followUpDueAt);
    const channel = text(body.followUpChannel);
    const subject = text(body.followUpSubject);
    if (!Number.isFinite(due) || due <= now || due > now + 90 * 86400000 ||
        !['call','whatsapp','email'].includes(channel) || !subject) {
      return { error: 'Follow-up needs a channel, subject and future due time within 90 days' };
    }
    followUp = { dueAt: new Date(due).toISOString(), channel, subject };
  }
  return { step, reason: reason || null, note: note || null, recontactDate: month ? month + '-01' : null, followUp };
}

export function addDubaiWorkingDays(at, days, workingDays) {
  if (!Number.isInteger(days) || days < 0 || !workingDays.length) throw new Error('Invalid working-day interval');
  const dubaiOffset = 4 * 3600000;
  const date = new Date(new Date(at).getTime() + dubaiOffset);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid activity timestamp');
  for (let remaining = days; remaining > 0;) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (workingDays.includes(date.getUTCDay() || 7)) remaining--;
  }
  return new Date(date.getTime() - dubaiOffset);
}

export function advanceProspectRetry({ previousAttempts, outcome, step, at, policy }) {
  if (['answered','callback_requested','interested','not_interested','declined'].includes(outcome)) {
    return { attempts: 0, nextAt: null, parkedAt: null };
  }
  if (step !== 'retry_cadence') return { attempts: 0, nextAt: null, parkedAt: null };
  // The first unsuccessful call schedules retry 1. Retry 3 failing parks the prospect.
  const attempts = (previousAttempts ?? 0) + 1;
  const gap = policy.retryGaps[attempts - 1];
  return {
    attempts,
    nextAt: gap ? addDubaiWorkingDays(at, gap, policy.workingDays) : null,
    parkedAt: !gap && policy.parkOnExhaustion ? new Date(at) : null,
  };
}

const boundedInteger = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export function validateProspectCadence(body = {}) {
  const { dailyTarget, workingDays, firstCallDays, retryGaps, parkOnExhaustion } = body;
  if (!boundedInteger(dailyTarget, 0, 300) || !boundedInteger(firstCallDays, 1, 14) ||
      !Array.isArray(workingDays) || workingDays.length === 0 ||
      workingDays.some(day => !boundedInteger(day, 1, 7)) || new Set(workingDays).size !== workingDays.length ||
      !Array.isArray(retryGaps) || !boundedInteger(retryGaps.length, 1, 10) ||
      retryGaps.some(gap => !boundedInteger(gap, 1, 14)) || typeof parkOnExhaustion !== 'boolean') {
    return { error: 'Enter a valid call target, working days, first-call deadline and retry cadence' };
  }
  return { dailyTarget, workingDays: [...workingDays].sort((a,b) => a-b), firstCallDays, retryGaps, parkOnExhaustion };
}

export function validateProspectAgentTarget(body = {}) {
  const { dailyTarget, effectiveFrom } = body;
  const reason = text(body.reason);
  const validDate = typeof effectiveFrom === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(effectiveFrom) &&
    Number.isFinite(Date.parse(effectiveFrom)) && new Date(effectiveFrom).toISOString().slice(0,10) === effectiveFrom;
  if (!boundedInteger(dailyTarget, 0, 300) || !validDate || reason.length < 5 || reason.length > 1000) {
    return { error: 'Enter a target from 0 to 300, an effective date and a meaningful reason' };
  }
  return { dailyTarget, effectiveFrom, reason };
}
