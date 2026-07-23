const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
export const MATCH_FIT_STATUSES=['strong_fit','partial_fit','exception'];
export const MATCH_DECISIONS=['considering','shortlisted','rejected'];
export const VIEWING_STATUSES=['scheduled','completed','cancelled','no_show'];

export function validatePropertyMatch(body={}){
  const listingId=clean(body.listingId),fitStatus=body.fitStatus,rationale=clean(body.rationale),exceptions=clean(body.exceptions);
  if(!listingId)return {error:'Select an approved property'};
  if(!MATCH_FIT_STATUSES.includes(fitStatus))return {error:'Select a valid fit status'};
  if(!rationale)return {error:'Explain why this property fits the current requirement'};
  if(fitStatus==='exception'&&!exceptions)return {error:'Describe the material fit exception'};
  return {value:{listingId,fitStatus,rationale,exceptions,matchSource:'manual'}};
}

export function validateMatchDecision(body={}){
  const status=body.shortlistStatus,reason=clean(body.reason),expectedVersion=Number(body.expectedVersion);
  if(!['shortlisted','rejected','considering'].includes(status))return {error:'Select a valid shortlist decision'};
  if(status==='rejected'&&!reason)return {error:'A rejection reason is required'};
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return {error:'The current match version is required'};
  return {value:{status,reason,expectedVersion}};
}

export function validateViewingCreate(body={}){
  const propertyMatchId=clean(body.propertyMatchId),timezone=clean(body.timezone),location=clean(body.location),instructions=clean(body.instructions);
  const startsAt=new Date(body.startsAt),endsAt=new Date(body.endsAt);
  if(!propertyMatchId)return {error:'Select a shortlisted property'};
  if(Number.isNaN(startsAt.valueOf())||Number.isNaN(endsAt.valueOf())||endsAt<=startsAt)return {error:'The viewing time could not be understood. Re-enter the start date and duration'};
  if(!timezone||!location||!instructions)return {error:'Property address and meeting point are required'};
  const attendees=Array.isArray(body.attendees)?body.attendees:[];
  if(attendees.length>20)return {error:'A viewing can include at most 20 attendees'};
  return {value:{propertyMatchId,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),timezone,location,instructions,attendees}};
}

export function validateViewingOutcome(body={}){
  const status=body.status,outcome=clean(body.outcome),feedback=clean(body.feedback),followUpAction=clean(body.followUpAction),expectedVersion=Number(body.expectedVersion);
  const attendance=Array.isArray(body.attendance)?body.attendance:[];
  const followUpDueAt=body.followUpDueAt?new Date(body.followUpDueAt):null;
  if(!['completed','cancelled','no_show'].includes(status))return {error:'Select a valid viewing outcome'};
  if(status==='completed'&&(!outcome||!feedback))return {error:'Completed viewings require an outcome and feedback'};
  if(status==='completed'&&(!followUpAction||!body.followUpDueAt))return {error:'Completed viewings require a follow-up action and due time'};
  if(attendance.some(x=>!clean(x.id)||!['attended','absent'].includes(x.attendanceStatus)))return {error:'Record a valid attendance status for every attendee'};
  if((followUpAction&&!followUpDueAt)||(!followUpAction&&followUpDueAt)||followUpDueAt&&Number.isNaN(followUpDueAt.valueOf()))return {error:'Follow-up action and valid due time must be provided together'};
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return {error:'The current viewing version is required'};
  return {value:{status,outcome,feedback,followUpAction,followUpDueAt:followUpDueAt?.toISOString()||null,attendance,expectedVersion}};
}

const icsText=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const icsDate=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export function buildViewingIcs(viewing){
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NYSA CORE//R2.2 Viewing//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    `UID:${icsText(viewing.calendarUid)}`,`DTSTAMP:${icsDate(new Date())}`,`DTSTART:${icsDate(viewing.startsAt)}`,`DTEND:${icsDate(viewing.endsAt)}`,
    `SUMMARY:${icsText(`Property viewing - ${viewing.listingProject}`)}`,`LOCATION:${icsText(viewing.location)}`,
    `DESCRIPTION:${icsText(viewing.instructions||`Viewing for ${viewing.opportunityReference}`)}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
