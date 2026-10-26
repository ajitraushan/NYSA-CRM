const DAY_MS=24*60*60*1000;

const date=value=>{const parsed=value?new Date(value):null;return parsed&&!Number.isNaN(parsed.valueOf())?parsed:null;};
const minutesBetween=(future,now)=>Math.round((future-now)/60000);
const readableMinutes=value=>{const minutes=Math.max(0,Math.round(Math.abs(Number(value)||0)));if(minutes<60)return `${Math.max(1,minutes)} minute${minutes===1?'':'s'}`;const hours=Math.ceil(minutes/60);if(hours<24)return `${hours} hour${hours===1?'':'s'}`;const days=Math.ceil(minutes/1440);if(days<7)return `${days} day${days===1?'':'s'}`;const weeks=Math.ceil(minutes/10080);return `${weeks} week${weeks===1?'':'s'}`;};

export const CUSTOMER_PRIORITY_BANDS=[
  {code:'immediate',label:'Immediate attention'},
  {code:'new_enquiry',label:'New enquiries'},
  {code:'due_today',label:'Due today'},
  {code:'high_potential',label:'High-potential opportunities'},
  {code:'waiting',label:'Waiting and monitor'}
];

function suggestedAction(record){
  if(!record.assignedTo)return {code:'assign_agent',label:'Assign a responsible agent',target:'lead'};
  if(!record.acceptedAt)return {code:'accept_assignment',label:'Accept or reject assignment',target:'lead'};
  if(!record.firstContactAt)return {code:'record_first_contact',label:'Contact the customer and record the outcome',target:'lead'};
  if(!Number(record.requirementCount||0))return {code:'capture_requirements',label:'Record the customer requirements',target:'requirements'};
  if(!Number(record.qualificationCount||0))return {code:'complete_qualification',label:'Complete the approved qualification',target:'qualification'};
  if(record.opportunityId&&record.opportunityNextAction)return {code:'opportunity_action',label:record.opportunityNextAction,target:'opportunity'};
  if(['Qualified','Viewing','Negotiation','Won'].includes(record.leadStage)&&!record.opportunityId)
    return {code:'create_opportunity',label:'Create or review the Opportunity',target:'lead'};
  return {code:'continue_follow_up',label:record.nextAction||'Continue customer follow-up',target:'lead'};
}

export function buildCustomerPriorityCase(record,nowValue=new Date()){
  const now=date(nowValue)||new Date(),due=date(record.dueAt),received=date(record.receivedAt||record.createdAt),lastInteraction=date(record.lastInteractionAt),
    dueMinutes=due?minutesBetween(due,now):null,ageMinutes=received?Math.max(0,Math.round((now-received)/60000)):null,
    why=[];
  let suggestion=suggestedAction(record);
  let band='waiting',consequence='Continue monitoring the agreed next action.';
  if(record.hardPriority){band='immediate';if(record.hardPriorityAction)suggestion=record.hardPriorityAction;why.push(record.hardPriorityReason||'A governed decision requires immediate attention');consequence='The controlled decision is blocking further progress.';}
  else if(record.doNotContact){band='immediate';suggestion={code:'review_contact_restriction',label:'Review the communication restriction',target:'customer'};why.push('Communication restriction requires review before contact');consequence='Contact must not proceed until the restriction is resolved.';}
  else if(dueMinutes!==null&&dueMinutes<=60){band='immediate';why.push(dueMinutes<0?`Action is overdue by ${readableMinutes(dueMinutes)}`:`Only ${readableMinutes(dueMinutes)} remain`);consequence='Delay risks missing the recorded service or transaction deadline.';}
  else if(!record.acceptedAt||!record.firstContactAt){band='new_enquiry';why.push(!record.acceptedAt?'Assignment has not been accepted':'First customer contact is not recorded');if(ageMinutes!==null)why.push(`Enquiry received ${readableMinutes(ageMinutes)} ago`);consequence='A slow first response increases the risk of losing the enquiry.';}
  else if(dueMinutes!==null&&dueMinutes<=24*60){band='due_today';why.push('The agreed action is due within 24 hours');consequence='Complete or reschedule the action with a recorded reason.';}
  else if(['Hot','Warm'].includes(record.temperature)&&Number(record.requirementCount||0)&&Number(record.qualificationCount||0)){
    band='high_potential';why.push(`${record.temperature} historical qualification is supported by recorded requirements`);if(record.opportunityId)why.push('An active Opportunity is available for execution');consequence='Timely progress may improve the chance of conversion.';
  }else{
    if(due)why.push(`Next action is scheduled for ${due.toISOString()}`);else why.push('No imminent governed deadline is recorded');
    consequence=due?'Monitor until the agreed action becomes due.':'Record a clear next action so this customer does not disappear from active work.';
  }
  if(record.emailStatus&&record.emailStatus!=='verified'&&record.emailStatus!=='confirmed')why.push(`Email is ${String(record.emailStatus).replaceAll('_',' ')}`);
  if(!Number(record.requirementCount||0)&&!why.some(item=>/requirement/i.test(item)))why.push('Structured requirements are still missing');
  return {...record,priorityBand:band,priorityRank:CUSTOMER_PRIORITY_BANDS.findIndex(item=>item.code===band)+1,dueMinutes,ageMinutes,
    whyNow:why.slice(0,3),suggestedAction:suggestion,consequence,suggestionSource:'deterministic_rules',aiAdvisoryAvailable:true,lastInteractionAt:lastInteraction};
}

export function sortCustomerPriorityCases(records,now=new Date()){
  return records.map(record=>buildCustomerPriorityCase(record,now)).sort((a,b)=>a.priorityRank-b.priorityRank||
    (a.dueAt?new Date(a.dueAt).valueOf():Infinity)-(b.dueAt?new Date(b.dueAt).valueOf():Infinity)||
    (b.receivedAt?new Date(b.receivedAt).valueOf():0)-(a.receivedAt?new Date(a.receivedAt).valueOf():0));
}

export function buildCustomer360Profile({customer,pursuits=[],effectiveConsent=false,restricted=false},now=new Date()){
  const active=pursuits.filter(item=>!['closed_won','closed_lost'].includes(String(item.currentStatus||'').toLowerCase())&&!['Won','Lost'].includes(item.leadStage)),
    primary=active[0]||pursuits[0]||null,missing=[];
  if(!customer.email)missing.push('email');if(!customer.phone)missing.push('phone');
  if(primary&&!primary.requirementId)missing.push('structured requirements');
  if(primary&&!primary.qualificationId)missing.push('qualification');
  const credibilityLabels={credible_domain:'credible domain',review_advised:'review advised',check_unavailable:'email check unavailable',invalid_format:'invalid email format'},
    contactQuality=restricted?'restricted':customer.emailStatus==='verified'||customer.phoneStatus==='verified'?'verified':
      credibilityLabels[customer.emailCredibilityStatus]||((customer.emailStatus==='format_valid'||customer.phoneStatus==='format_valid')?'format valid':'review required');
  return {customerId:customer.id,customerName:customer.fullName,contactQuality,effectiveConsent:Boolean(effectiveConsent),restricted:Boolean(restricted),
    activePursuitCount:active.length,totalPursuitCount:pursuits.length,primaryPursuit:primary,missingInformation:missing,
    summary:primary?`${primary.businessType} customer · ${primary.currentStatus||'active'} pursuit · ${primary.temperature||'Unassessed'} historical qualification`:'Customer record exists; no Lead has been created.',
    generatedAt:new Date(now).toISOString(),source:'authoritative_records'};
}
