export const BROKER_NEXT_ACTION_POLICY_VERSION='r3c-next-action-v1';
export const BROKER_ACTION_DECISIONS=['start','defer','complete'];

const ACTIONS={
  interested:{code:'follow_up_interest',label:'Follow up on customer interest',dueHours:4,basePriority:3},
  viewing_requested:{code:'coordinate_viewing',label:'Coordinate property viewing',dueHours:2,basePriority:4},
  information_required:{code:'prepare_property_information',label:'Prepare requested property information',dueHours:4,basePriority:3},
  more_options:{code:'rematch_requirement',label:'Review requirement and prepare more options',dueHours:8,basePriority:2},
  not_suitable_property:{code:'continue_matching',label:'Record property feedback and continue matching',dueHours:8,basePriority:2},
  not_suitable_review:{code:'review_preferences',label:'Review possible preference change',dueHours:8,basePriority:3},
  not_suitable_confirmed:{code:'version_requirement',label:'Prepare a new governed requirement version',dueHours:4,basePriority:4}
};

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const readableMinutes=value=>{const minutes=Math.max(0,Math.round(Math.abs(Number(value)||0)));if(minutes<60)return `${Math.max(1,minutes)} min`;const hours=Math.ceil(minutes/60);if(hours<24)return `${hours} hr`;const days=Math.ceil(minutes/1440);if(days<7)return `${days} day${days===1?'':'s'}`;const weeks=Math.ceil(minutes/10080);return `${weeks} week${weeks===1?'':'s'}`;};
const canonical=value=>{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
};
async function sha256(value){
  const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value))));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function actionFor(response){
  if(response.outcome!=='not_suitable')return ACTIONS[response.outcome]||null;
  const impact=response.notSuitableEvidence?.preferenceImpact?.code;
  if(impact==='property_only')return ACTIONS.not_suitable_property;
  if(impact==='review_required')return ACTIONS.not_suitable_review;
  if(impact==='confirmed_change')return ACTIONS.not_suitable_confirmed;
  return null;
}

function ageing(dueAt,now,basePriority){
  const minutes=Math.floor((dueAt-now)/60000);
  if(minutes<0)return{state:'overdue',label:`Overdue by ${readableMinutes(minutes)}`,priority:'critical',priorityScore:5};
  if(minutes<=60)return{state:'due_soon',label:`Due in ${readableMinutes(minutes)}`,priority:basePriority>=4?'critical':'high',priorityScore:Math.max(4,basePriority)};
  return{state:'open',label:`Due in ${readableMinutes(minutes)}`,priority:basePriority>=4?'high':basePriority===3?'normal':'routine',priorityScore:basePriority};
}

export async function prepareBrokerNextActions(input={}){
  const now=new Date(input.now||Date.now()),responses=input.responses;
  if(Number.isNaN(now.valueOf()))return{error:'Queue time is invalid'};
  if(!Array.isArray(responses)||!responses.length)return{error:'At least one governed customer response is required'};
  const actions=[];
  for(const response of responses){
    const action=actionFor(response),occurredAt=new Date(response.occurredAt);
    if(!clean(response.responseReference)||!clean(response.evidenceHash))return{error:'Every response requires immutable evidence identity'};
    if(!action)return{error:'Customer response cannot be translated without controlled evidence',responseReference:response.responseReference};
    if(Number.isNaN(occurredAt.valueOf())||occurredAt>now)return{error:'Customer response time is invalid',responseReference:response.responseReference};
    const dueAt=new Date(occurredAt.getTime()+action.dueHours*60*60*1000),age=ageing(dueAt,now,action.basePriority);
    const snapshot={
      policyVersion:BROKER_NEXT_ACTION_POLICY_VERSION,
      actionReference:`ACTION-${response.responseReference}`,
      responseReference:response.responseReference,responseEvidenceHash:response.evidenceHash,
      action:{code:action.code,label:action.label},priority:age.priority,priorityScore:age.priorityScore,
      ageingState:age.state,ageingLabel:age.label,occurredAt:occurredAt.toISOString(),dueAt:dueAt.toISOString(),
      responsibleAgentReference:clean(response.responsibleAgentReference),
      opportunityReference:clean(response.opportunityReference),requirementReference:clean(response.requirementReference),
      propertyReferences:[...new Set((response.propertyReferences||[response.propertyReference]).map(clean).filter(Boolean))],
      responseSource:clean(response.responseSource)||'manual_fallback',customerOutcome:response.outcome,
      workingContext:{summary:clean(response.workingContext?.summary),missingFacts:(response.workingContext?.missingFacts||[]).map(clean).filter(Boolean),preferenceImpact:response.notSuitableEvidence?.preferenceImpact||null},
      proposedOnly:true,automaticSend:false,changesInventory:false,changesOpportunityStage:false
    };
    if(!snapshot.responsibleAgentReference||!snapshot.opportunityReference||!snapshot.propertyReferences.length)return{error:'Responsible agent, Opportunity and property context are required',responseReference:response.responseReference};
    actions.push({...snapshot,evidenceHash:await sha256(snapshot)});
  }
  actions.sort((a,b)=>b.priorityScore-a.priorityScore||a.dueAt.localeCompare(b.dueAt)||a.actionReference.localeCompare(b.actionReference));
  return{value:{policyVersion:BROKER_NEXT_ACTION_POLICY_VERSION,generatedAt:now.toISOString(),actions,counts:{total:actions.length,overdue:actions.filter(item=>item.ageingState==='overdue').length,dueSoon:actions.filter(item=>item.ageingState==='due_soon').length},automaticAssignment:false}};
}

export async function previewBrokerActionDecision(action,body={}){
  if(!action?.evidenceHash||!clean(action.actionReference))return{error:'A governed broker action is required'};
  if(!BROKER_ACTION_DECISIONS.includes(body.decision))return{error:'Select a controlled broker decision'};
  const decidedBy=clean(body.decidedBy),note=clean(body.note),decidedAt=new Date(body.decidedAt||Date.now());
  if(!decidedBy)return{error:'A broker reference is required'};
  if(!note)return{error:'Decision evidence note is required'};
  if(note.length>1000)return{error:'Decision evidence note must be 1,000 characters or fewer'};
  if(Number.isNaN(decidedAt.valueOf()))return{error:'Decision time is invalid'};
  if(body.decision==='defer'){
    const deferUntil=new Date(body.deferUntil);
    if(Number.isNaN(deferUntil.valueOf())||deferUntil<=decidedAt)return{error:'Deferral time must be after the decision time'};
  }
  const evidence={actionEvidenceHash:action.evidenceHash,actionReference:action.actionReference,decision:body.decision,note,decidedBy,decidedAt:decidedAt.toISOString(),deferUntil:body.decision==='defer'?new Date(body.deferUntil).toISOString():null,status:'preview_not_applied'};
  return{value:{...evidence,evidenceHash:await sha256(evidence),automaticSend:false,changesInventory:false,changesOpportunityStage:false}};
}
