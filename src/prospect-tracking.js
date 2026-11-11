const nextSteps = ['follow_up','retry_cadence','close_not_interested','close_dnc','close_wrong_number','convert'];
const noContact = new Set(['no_answer','voicemail','consumer_ended']);
const reasons = new Set(['budget','timing','committed','not_investor','location_product','other_agent','other']);
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
  if ((step === 'close_not_interested' || outcome === 'declined' || reason) && !reasons.has(reason)) {
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
