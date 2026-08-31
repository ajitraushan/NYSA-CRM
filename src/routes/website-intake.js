import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { one, many, execute, transaction, uuid, audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasInternalCrmIdentity, isManager } from '../crm-policy.js';
import { validateContactIdentity, validateBudget, SOURCES, BUSINESS_TYPES, normalizeDelimitedValues } from '../crm-domain.js';
import { calculateDeadlines } from './lead-operations.js';
import { resolvePrimaryRoutingArea,selectRoutingRule } from '../routing-service.js';
import { checkEmailCredibility } from '../email-credibility-domain.js';
import { routingReason,websiteAiRoutingDecision } from '../website-ai-routing.js';
import { detectWebsiteRequirementConflicts } from '../requirement-confirmation-domain.js';

const r=Router();
const MAX_CLOCK_SKEW_MS=5*60*1000;
const clean=v=>typeof v==='string'&&v.trim()?v.trim():null;
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const requirementFingerprint=b=>hash(JSON.stringify({businessType:b.businessType,purpose:b.requirement.purpose,
  propertyTypes:normalizeDelimitedValues(b.requirement.propertyTypes).map(x=>x.toLowerCase()).sort(),areas:normalizeDelimitedValues(b.requirement.areas).map(x=>x.toLowerCase()).sort(),
  budgetMin:validateBudget(b.requirement.budgetMin,b.requirement.budgetMax).min,budgetMax:validateBudget(b.requirement.budgetMin,b.requirement.budgetMax).max,
  fundingMethod:b.requirement.fundingMethod||'unknown',timelineCode:b.requirement.timelineCode,propertyReference:clean(b.property?.externalId||b.propertyId||b.listingId)||null}));

function safeEqual(a,b){
  const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));
  return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);
}
function authenticate(req){
  const secret=process.env.WEBSITE_INTAKE_SECRET||'';
  const timestamp=String(req.headers['x-nysa-timestamp']||'');
  const signature=String(req.headers['x-nysa-signature']||'').replace(/^sha256=/,'');
  if(secret.length<32)return {status:503,error:'Website intake is not configured'};
  const time=Number(timestamp);if(!Number.isFinite(time)||Math.abs(Date.now()-time)>MAX_CLOCK_SKEW_MS)return {status:401,error:'Invalid or expired request authentication'};
  const expected=crypto.createHmac('sha256',secret).update(`${timestamp}.${req.rawBody||''}`).digest('hex');
  if(!safeEqual(signature,expected))return {status:401,error:'Invalid or expired request authentication'};
  return null;
}
function validatePayload(b){
  const identity=validateContactIdentity(b?.contact?.email,b?.contact?.phone);
  if(!clean(b?.eventId)||!clean(b?.contact?.fullName)||identity.error)return {error:identity.error||'eventId and contact.fullName are required'};
  if(clean(b?.journeyKey)&&(!/^[A-Za-z0-9_-]{16,120}$/.test(b.journeyKey)))return {error:'journeyKey must be a bounded opaque website identifier'};
  if(b.contact.preferredChannel&&!['Phone','Email','WhatsApp','SMS'].includes(b.contact.preferredChannel))return {error:'Invalid preferred contact channel'};
  if((b.source||'Website')!=='Website'||!SOURCES.includes(b.source||'Website')||!BUSINESS_TYPES.includes(b.businessType))return {error:'Invalid source or businessType'};
  if(!['own_use','investment','business','other'].includes(b?.requirement?.purpose)||!['cash','mortgage','mixed','unknown'].includes(b?.requirement?.fundingMethod||'unknown')||
    !clean(b?.requirement?.timelineCode)||typeof b?.consent?.marketing!=='boolean'||!clean(b?.consent?.statementVersion))
    return {error:'requirement purpose/timeline and explicit consent evidence are required'};
  const budget=validateBudget(b.requirement.budgetMin,b.requirement.budgetMax);if(budget.error)return {error:budget.error};
  if(b.profile){
    if(!['buyer_profile','investment_profile'].includes(clean(b.profile.sourceCode))||!clean(b.profile.sourceVersion)||!clean(b.profile.completedAt))return {error:'Website profile sourceCode, sourceVersion and completedAt are required'};
    if(Number.isNaN(new Date(b.profile.completedAt).valueOf()))return {error:'Website profile completedAt is invalid'};
    for(const field of ['declaredPriorities','mustHaves','preferences','exclusions','acceptableTradeOffs'])if(b.profile[field]!==undefined&&(!Array.isArray(b.profile[field])||b.profile[field].length>20||b.profile[field].some(value=>!clean(value)||String(value).length>240)))return {error:`Website profile ${field} must contain no more than 20 concise values`};
  }
  return {identity};
}
async function intakeActor(){
  const id=process.env.WEBSITE_INTAKE_ACTOR_ID;
  return id?one("SELECT id FROM brokers WHERE id=$1 AND status='active' AND role IN ('admin','internal_broker')",[id]):null;
}

async function persistAiRouting(event,decision,status=decision?.status,client=undefined){
  if(!decision)return;
  await execute(`UPDATE website_intake_events SET ai_routing_status=$1,ai_routing_business_type=$2,ai_routing_reason=$3,ai_routing_decision=$4::jsonb WHERE id=$5`,
    [status,decision.businessType,decision.reason,JSON.stringify(decision.raw||decision),event.id],client);
}

async function queueRoutingReview(event,lead,decision,rule,actor,client){
  const manager=lead.assignedTeamId?await one(`SELECT COALESCE(t.manager_id,(SELECT tm.broker_id FROM team_memberships tm
    WHERE tm.team_id=t.id AND tm.membership_role='manager' AND tm.ends_at IS NULL ORDER BY tm.created_at LIMIT 1)) AS manager_id FROM teams t WHERE t.id=$1`,[lead.assignedTeamId],client):null;
  const assigneeId=manager?.managerId||lead.assignedTo||actor.id,dueAt=new Date(Date.now()+4*60*60*1000);
  await execute(`INSERT INTO tasks(id,lead_id,contact_id,subject,details,assignee_id,priority,status,due_at,created_by)
    VALUES($1,$2,$3,'Review Website AI routing change',$4,$5,'high','open',$6,$7)`,[uuid(),lead.id,lead.contactId,
    `Property Selection proposed ${decision.businessType||'manual team review'}${rule?.name?` via ${rule.name}`:''}. Existing agent ownership was preserved. ${decision.reason}`,assigneeId,dueAt,actor.id],client);
  await persistAiRouting(event,decision,'manager_review',client);
  await audit('Lead',lead.id,'website_ai_routing_review_required',actor.id,{eventId:event.eventId,currentBusinessType:lead.businessType,currentTeamId:lead.assignedTeamId,
    currentAgentId:lead.assignedTo,proposedBusinessType:decision.businessType,proposedTeamId:rule?.teamId||null,reason:decision.reason},client);
  return {status:'manager_review',businessType:lead.businessType,requirementBusinessType:decision.businessType||lead.businessType,teamId:lead.assignedTeamId};
}

async function applyContinuationAiRouting(event,lead,b,decision,actor,client){
  if(!decision||decision.status==='not_emitted'){
    await persistAiRouting(event,decision,decision?.status,client);
    return {status:decision?.status||'not_applicable',businessType:lead.businessType,requirementBusinessType:b.businessType,teamId:lead.assignedTeamId};
  }
  const determined=decision.status==='determined',proposedType=determined?decision.businessType:null,
    rule=determined?await selectRoutingRule({source:b.source||'Website',businessType:proposedType,primaryAreaId:lead.primaryRoutingAreaId},client):null,
    proposedTeamId=rule?.teamId||null,requiresChange=!determined||lead.businessType!==proposedType||lead.assignedTeamId!==proposedTeamId;
  if(lead.assignedTo&&requiresChange)return queueRoutingReview(event,lead,decision,rule,actor,client);
  const nextBusinessType=proposedType||lead.businessType,nextReason=routingReason(decision,rule),teamChanged=lead.assignedTeamId!==proposedTeamId;
  if(teamChanged){
    const currentAssignment=await one('SELECT * FROM lead_assignments WHERE lead_id=$1 AND superseded_at IS NULL FOR UPDATE',[lead.id],client);
    if(currentAssignment)await execute(`UPDATE lead_assignments SET status='reassigned',superseded_at=NOW(),responded_at=NOW(),response_reason=$1 WHERE id=$2`,
      ['Website AI routing decision before agent assignment',currentAssignment.id],client);
    const sequence=Number((await one('SELECT COALESCE(MAX(sequence_no),0)+1 AS sequence FROM lead_assignments WHERE lead_id=$1',[lead.id],client)).sequence),
      deadlines=await calculateDeadlines(new Date(),client);
    await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,acceptance_due_at,assigned_by)
      VALUES($1,$2,$3,$4,NULL,'queued',$5,$6)`,[uuid(),lead.id,sequence,proposedTeamId,deadlines.acceptanceDueAt,actor.id],client);
    await execute(`UPDATE leads SET business_type=$1,assigned_team_id=$2,routing_reason=$3,assignment_status='unassigned',assignment_due_at=$4,
      acceptance_due_at=$4,first_contact_due_at=$5,last_queue_entered_at=NOW(),queue_cycle_no=queue_cycle_no+1,updated_at=NOW() WHERE id=$6`,
      [nextBusinessType,proposedTeamId,nextReason,deadlines.acceptanceDueAt,deadlines.firstContactDueAt,lead.id],client);
  }else await execute('UPDATE leads SET business_type=$1,routing_reason=$2,updated_at=NOW() WHERE id=$3',[nextBusinessType,nextReason,lead.id],client);
  await persistAiRouting(event,decision,decision.status,client);
  await audit('Lead',lead.id,'website_ai_routed',actor.id,{eventId:event.eventId,businessType:nextBusinessType,teamId:proposedTeamId,
    routingRuleId:rule?.id||null,routingStatus:decision.status,reason:decision.reason},client);
  return {status:decision.status,businessType:nextBusinessType,requirementBusinessType:nextBusinessType,teamId:proposedTeamId,rule};
}
async function processEvent(event,b,identity,actor,{forcedContactId=null,forceDistinctLead=false}={}){
  return transaction(async client=>{
    const budget=validateBudget(b.requirement.budgetMin,b.requirement.budgetMax),aiRouting=websiteAiRoutingDecision(b);
    const journeyKey=clean(b.journeyKey);
    const trustedEmail=identity.email&&(event.emailCredibility?.status==='credible_domain'||event.resolution==='approve_email_only')?identity.email:null,
      customerRoles=b.businessType==='Rental'?['tenant']:b.requirement?.purpose==='investment'?['buyer','investor']:['buyer'],
      preferredChannel=!trustedEmail&&identity.phone&&b.contact.preferredChannel==='Email'?'Phone':b.contact.preferredChannel||null,
      emailContact=trustedEmail?await one('SELECT c.* FROM contacts c JOIN contact_channels ch ON ch.contact_id=c.id WHERE ch.channel_kind=\'Email\' AND ch.normalized_value=$1 AND c.lifecycle_status=\'active\' ORDER BY c.created_at LIMIT 1',[trustedEmail],client):null,
      phoneContact=identity.phone?await one('SELECT c.* FROM contacts c JOIN contact_channels ch ON ch.contact_id=c.id WHERE ch.channel_kind=\'Phone\' AND ch.normalized_value=$1 AND c.lifecycle_status=\'active\' ORDER BY c.created_at LIMIT 1',[identity.phone],client):null,
      journeyContact=journeyKey&&b.form==='ai_property_selection_v1'?await one(`SELECT c.* FROM website_intake_events e JOIN contacts c ON c.id=e.contact_id
        WHERE e.journey_key=$1 AND e.status='accepted' AND e.contact_id IS NOT NULL AND c.lifecycle_status='active' AND e.id<>$2
        ORDER BY e.processed_at DESC NULLS LAST,e.received_at DESC LIMIT 1`,[journeyKey,event.id],client):null,
      identityContactIds=[...new Set([emailContact?.id,phoneContact?.id,journeyContact?.id].filter(Boolean))];
    if(!forcedContactId&&(emailContact&&phoneContact&&emailContact.id!==phoneContact.id||identityContactIds.length>1)){
      const conflictIds=identityContactIds,reviewDueAt=new Date(Date.now()+4*60*60*1000);
      await execute(`UPDATE website_intake_events SET status='identity_review',identity_conflict_contact_ids=$1,review_due_at=$2,
        processed_at=NOW(),error_code='IDENTITY_CONFLICT' WHERE id=$3`,[conflictIds,reviewDueAt,event.id],client);
      await audit('WebsiteIntake',event.id,'identity_review_required',actor.id,{eventId:event.eventId,conflictContactIds:conflictIds,reviewDueAt},client);
      return {eventId:event.eventId,status:'identity_review',reviewRequired:true,reviewDueAt};
    }
    let contact=forcedContactId?await one("SELECT * FROM contacts WHERE id=$1 AND lifecycle_status='active'",[forcedContactId],client):phoneContact||emailContact||journeyContact;
    if(forcedContactId&&!contact)throw Object.assign(new Error('Selected Customer is not active'),{statusCode:409});
    if(!contact){
      const contactId=uuid();contact=await one(`INSERT INTO contacts(id,full_name,email,phone,contact_type,preferred_channel,owner_id,created_by,email_status,phone_status,source_first_seen)
        VALUES($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,'Website') RETURNING *`,[contactId,clean(b.contact.fullName),trustedEmail,identity.phone,customerRoles[0],preferredChannel,actor.id,trustedEmail?identity.emailStatus:'unverified',identity.phoneStatus],client);
      if(trustedEmail)await execute(`INSERT INTO contact_channels(id,contact_id,channel_kind,raw_value,normalized_value,verification_status,is_primary,created_by)
        VALUES($1,$2,'Email',$3,$4,'format_valid',1,$5)`,[uuid(),contact.id,b.contact.email,trustedEmail,actor.id],client);
      if(identity.phone)await execute(`INSERT INTO contact_channels(id,contact_id,channel_kind,raw_value,normalized_value,whatsapp_enabled,verification_status,is_primary,created_by)
        VALUES($1,$2,'Phone',$3,$4,$5,'format_valid',1,$6)`,[uuid(),contact.id,b.contact.phone,identity.phone,preferredChannel==='WhatsApp'?1:0,actor.id],client);
    }
    for(const role of customerRoles)await execute(`INSERT INTO contact_roles(id,contact_id,role_code,created_by) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[uuid(),contact.id,role,actor.id],client);
    if(trustedEmail&&!contact.email)await execute(`UPDATE contacts SET email=$1,email_status=$2,updated_at=NOW() WHERE id=$3`,[trustedEmail,identity.emailStatus,contact.id],client);
    if(trustedEmail)await execute(`INSERT INTO contact_channels(id,contact_id,channel_kind,raw_value,normalized_value,verification_status,is_primary,created_by)
      VALUES($1,$2,'Email',$3,$4,'format_valid',0,$5) ON CONFLICT DO NOTHING`,[uuid(),contact.id,b.contact.email,trustedEmail,actor.id],client);
    if(identity.phone&&!contact.phone)await execute(`UPDATE contacts SET phone=$1,phone_status=$2,updated_at=NOW() WHERE id=$3`,[identity.phone,identity.phoneStatus,contact.id],client);
    if(identity.phone)await execute(`INSERT INTO contact_channels(id,contact_id,channel_kind,raw_value,normalized_value,whatsapp_enabled,is_primary,verification_status,created_by)
      VALUES($1,$2,'Phone',$3,$4,$5,0,'format_valid',$6) ON CONFLICT DO NOTHING`,[uuid(),contact.id,b.contact.phone,identity.phone,b.contact.preferredChannel==='WhatsApp'?1:0,actor.id],client);
    if(trustedEmail&&event.emailCredibility)await execute(`UPDATE contacts SET email_credibility_status=$1,email_credibility_reason=$2,
      email_credibility_checked_at=$3,email_credibility_evidence=$4::jsonb,updated_at=NOW() WHERE id=$5`,[event.emailCredibility.status,event.emailCredibility.reason,event.emailCredibility.checkedAt,
        JSON.stringify({status:event.emailCredibility.status,label:event.emailCredibility.label,reason:event.emailCredibility.reason,domain:event.emailCredibility.domain,checks:event.emailCredibility.checks,checkedAt:event.emailCredibility.checkedAt}),contact.id],client);
    const rawCampaign=clean(b.campaign),campaignMapping=rawCampaign?await one(`SELECT m.campaign_id,c.campaign_code,c.name FROM campaign_external_mappings m
      JOIN marketing_campaigns c ON c.id=m.campaign_id WHERE m.status='active' AND c.status<>'retired' AND LOWER(m.source_code)=LOWER($1) AND LOWER(m.external_campaign_code)=LOWER($2)`,[b.source||'Website',rawCampaign],client):null,
      campaignId=campaignMapping?.campaignId||null,campaignMappingStatus=!rawCampaign?'not_supplied':campaignId?'mapped':'unmapped';
    await execute('UPDATE website_intake_events SET campaign_id=$1,campaign_mapping_status=$2 WHERE id=$3',[campaignId,campaignMappingStatus,event.id],client);
    if(journeyKey&&b.form==='ai_property_selection_v1'){
      const priorJourney=await one(`SELECT e.lead_id FROM website_intake_events e JOIN leads l ON l.id=e.lead_id
        WHERE e.journey_key=$1 AND e.status='accepted' AND e.lead_id IS NOT NULL AND l.contact_id=$2 AND e.id<>$3
        ORDER BY e.processed_at DESC NULLS LAST,e.received_at DESC LIMIT 1`,[journeyKey,contact.id,event.id],client);
      if(priorJourney?.leadId){
        if(trustedEmail&&contact.email&&contact.email.toLowerCase()!==trustedEmail.toLowerCase()){
          const previousEmail=contact.email;
          await execute(`UPDATE contact_channels SET is_primary=CASE WHEN normalized_value=$1 THEN 1 ELSE 0 END,
            usage_label=CASE WHEN normalized_value=$1 THEN 'Primary' ELSE 'Previous' END,updated_at=NOW()
            WHERE contact_id=$2 AND channel_kind='Email'`,[trustedEmail,contact.id],client);
          await execute(`UPDATE contacts SET email=$1,email_status=$2,updated_at=NOW() WHERE id=$3`,[trustedEmail,identity.emailStatus,contact.id],client);
          await audit('Contact',contact.id,'website_journey_primary_email_changed',actor.id,{eventId:event.eventId,journeyKey,previousEmail,newEmail:trustedEmail},client);
          contact.email=trustedEmail;
        }
        const lead=await one('SELECT * FROM leads WHERE id=$1 FOR UPDATE',[priorJourney.leadId],client);
        const current=await one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL FOR UPDATE',[lead.id],client);
        if(!current)throw Object.assign(new Error('The advisory Lead has no current requirement version'),{statusCode:409});
        const routingOutcome=await applyContinuationAiRouting(event,lead,b,aiRouting,actor,client);
        const incomingTypes=normalizeDelimitedValues(b.requirement.propertyTypes),incomingAreas=normalizeDelimitedValues(b.requirement.areas),profile=b.profile||{};
        const propertyTypes=incomingTypes.length?incomingTypes:current.propertyTypes||[],areas=incomingAreas.length?incomingAreas:current.areas||[];
        const fundingMethod=b.requirement.fundingMethod&&b.requirement.fundingMethod!=='unknown'?b.requirement.fundingMethod:current.fundingMethod;
        const timelineCode=b.requirement.timelineCode&&b.requirement.timelineCode!=='to_be_confirmed'?b.requirement.timelineCode:current.timelineCode;
        const mergedBody={...b,businessType:routingOutcome.requirementBusinessType,requirement:{...b.requirement,propertyTypes,areas,budgetMin:budget.min??current.budgetMin,budgetMax:budget.max??current.budgetMax,fundingMethod,timelineCode}};
        const reqFingerprint=requirementFingerprint(mergedBody),reqId=uuid(),versionNo=Number(current.versionNo)+1;
        const suppliedPriorities=normalizeDelimitedValues(profile.declaredPriorities),suppliedMustHaves=normalizeDelimitedValues(profile.mustHaves),
          suppliedPreferences=normalizeDelimitedValues(profile.preferences),suppliedExclusions=normalizeDelimitedValues(profile.exclusions),
          suppliedTradeOffs=normalizeDelimitedValues(profile.acceptableTradeOffs),websiteRequirement={
            businessLine:routingOutcome.requirementBusinessType,purpose:b.requirement.purpose,
            propertyTypes:incomingTypes.length?incomingTypes:undefined,areas:incomingAreas.length?incomingAreas:undefined,
            budgetMin:budget.min??undefined,budgetMax:budget.max??undefined,
            fundingMethod:b.requirement.fundingMethod&&b.requirement.fundingMethod!=='unknown'?b.requirement.fundingMethod:undefined,
            bedroomsMin:b.requirement.bedroomsMin??undefined,bedroomsMax:b.requirement.bedroomsMax??undefined,
            timelineCode:b.requirement.timelineCode&&b.requirement.timelineCode!=='to_be_confirmed'?b.requirement.timelineCode:undefined,
            declaredPriorities:suppliedPriorities.length?suppliedPriorities:undefined,mustHaves:suppliedMustHaves.length?suppliedMustHaves:undefined,
            preferences:suppliedPreferences.length?suppliedPreferences:undefined,exclusions:suppliedExclusions.length?suppliedExclusions:undefined,
            acceptableTradeOffs:suppliedTradeOffs.length?suppliedTradeOffs:undefined
          },websiteConflicts=detectWebsiteRequirementConflicts(current,websiteRequirement);
        await execute('UPDATE lead_requirements SET superseded_at=NOW() WHERE id=$1',[current.id],client);
        await execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,property_types,areas,budget_min,budget_max,funding_method,timeline_code,notes,created_by,
          declared_priorities,must_haves,preferences,exclusions,acceptable_trade_offs,source_kind,source_event_id,source_tool_code,source_tool_version,source_completed_at,requirement_fingerprint)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'website_profile',$19,$20,$21,$22,$23)`,
          [reqId,lead.id,versionNo,mergedBody.businessType,b.requirement.purpose,propertyTypes,areas,budget.min??current.budgetMin,budget.max??current.budgetMax,fundingMethod,timelineCode,clean(b.requirement.notes),actor.id,
           normalizeDelimitedValues(profile.declaredPriorities).length?normalizeDelimitedValues(profile.declaredPriorities):current.declaredPriorities||[],
           normalizeDelimitedValues(profile.mustHaves).length?normalizeDelimitedValues(profile.mustHaves):current.mustHaves||[],
           normalizeDelimitedValues(profile.preferences).length?normalizeDelimitedValues(profile.preferences):current.preferences||[],
           normalizeDelimitedValues(profile.exclusions).length?normalizeDelimitedValues(profile.exclusions):current.exclusions||[],
           normalizeDelimitedValues(profile.acceptableTradeOffs).length?normalizeDelimitedValues(profile.acceptableTradeOffs):current.acceptableTradeOffs||[],
           event.id,clean(profile.sourceCode),clean(profile.sourceVersion),profile.completedAt||null,reqFingerprint],client);
        for(const conflict of websiteConflicts)await execute(`INSERT INTO lead_requirement_website_conflicts(
          id,requirement_id,prior_requirement_id,source_event_id,field_code,governed_value,website_value)
          VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,[uuid(),reqId,current.id,event.id,conflict.fieldCode,
          JSON.stringify(conflict.governedValue),JSON.stringify(conflict.websiteValue)],client);
        await execute(`UPDATE leads SET budget_min=$1,budget_max=$2,preferred_areas=$3,property_requirements=$4,updated_at=NOW() WHERE id=$5`,
          [budget.min??current.budgetMin,budget.max??current.budgetMax,areas.join(', ')||null,clean(b.requirement.notes),lead.id],client);
        await execute(`INSERT INTO consent_evidence(id,contact_id,evidence_type,status,statement_version,source_event_id,captured_at,evidence_hash)
          VALUES($1,$2,'website_form',$3,$4,$5,NOW(),$6)`,[uuid(),contact.id,b.consent.marketing?'granted':'denied',b.consent.statementVersion,event.id,hash(JSON.stringify(b.consent))],client);
        await execute(`UPDATE customer_evidence_facts SET contact_id=$1,lead_id=$2,review_status='active',reviewed_at=NOW(),review_reason='Accepted continuation of website advisory journey'
          WHERE intake_event_id=$3 AND review_status='pending_review'`,[contact.id,lead.id,event.id],client);
        await execute("UPDATE website_intake_events SET status='accepted',contact_id=$1,lead_id=$2,processed_at=NOW(),error_code=NULL WHERE id=$3",[contact.id,lead.id,event.id],client);
        await audit('WebsiteIntake',event.id,'journey_enriched',actor.id,{eventId:event.eventId,journeyKey,leadId:lead.id,requirementVersion:versionNo,
          declaredRequirementConflicts:websiteConflicts.map(conflict=>conflict.fieldCode)},client);
        return {eventId:event.eventId,contactId:contact.id,leadId:lead.id,status:'accepted',reusedJourneyLead:true,requirementVersion:versionNo,
          routingStatus:routingOutcome.status,routedBusinessType:routingOutcome.businessType,routedTeamId:routingOutcome.teamId,campaignMappingStatus,governedCampaignCode:campaignMapping?.campaignCode||null};
      }
    }
    const reqFingerprint=requirementFingerprint(b);
    if(!forceDistinctLead){const duplicate=await one(`SELECT l.id,l.lead_reference,l.title,l.received_at FROM leads l JOIN lead_requirements lr ON lr.lead_id=l.id AND lr.superseded_at IS NULL
      WHERE l.contact_id=$1 AND l.stage NOT IN ('Won','Lost') AND l.source=$2 AND l.business_type=$3 AND l.campaign_code IS NOT DISTINCT FROM $4
      AND lr.requirement_fingerprint=$5 AND l.received_at>=NOW()-INTERVAL '30 days' ORDER BY l.received_at DESC LIMIT 1`,[contact.id,b.source||'Website',b.businessType,rawCampaign,reqFingerprint],client);
      if(duplicate){const reviewDueAt=new Date(Date.now()+4*60*60*1000);await execute(`UPDATE website_intake_events SET status='duplicate_review',contact_id=$1,
        requirement_fingerprint=$2,duplicate_candidate_lead_id=$3,review_due_at=$4,processed_at=NOW(),error_code='POSSIBLE_DUPLICATE_LEAD' WHERE id=$5`,[contact.id,reqFingerprint,duplicate.id,reviewDueAt,event.id],client);
        await audit('WebsiteIntake',event.id,'duplicate_lead_review_required',actor.id,{eventId:event.eventId,candidateLeadId:duplicate.id,requirementFingerprint:reqFingerprint,reviewDueAt},client);
        return {eventId:event.eventId,status:'duplicate_review',reviewRequired:true,candidateLeadId:duplicate.id,candidateLeadReference:duplicate.leadReference,reviewDueAt};}}
    const primary=await resolvePrimaryRoutingArea(b.primaryRoutingAreaId,b.requirement.areas,client);if(primary.error)throw Object.assign(new Error(primary.error),{statusCode:400});
    const activeAiRouting=aiRouting?.status==='not_emitted'?null:aiRouting,routeBusinessType=activeAiRouting?.status==='determined'?activeAiRouting.businessType:b.businessType,
      deferTeam=activeAiRouting&&activeAiRouting.status!=='determined',rule=deferTeam?null:await selectRoutingRule({source:b.source||'Website',businessType:routeBusinessType,primaryAreaId:primary.areaId},client);
    const receivedAt=new Date(),deadlines=await calculateDeadlines(receivedAt,client),leadId=uuid();
    const lead=await one(`INSERT INTO leads(id,contact_id,title,source,business_type,temperature,budget_min,budget_max,preferred_areas,primary_routing_area_id,property_requirements,
      assigned_team_id,assigned_to,assignment_status,received_at,external_source_id,campaign_code,source_page,source_form,assignment_due_at,
      original_acceptance_due_at,acceptance_due_at,first_contact_due_at,sla_policy_id,created_by,campaign_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20,$20,$21,$22,$23,$24) RETURNING *`,
      [leadId,contact.id,clean(b.title)||`${routeBusinessType} website enquiry`,b.source||'Website',routeBusinessType,'Unassessed',budget.min,budget.max,
       normalizeDelimitedValues(b.requirement.areas).join(', ')||null,primary.areaId,clean(b.requirement.notes),rule?.teamId||null,null,'unassigned',receivedAt,event.eventId,
       rawCampaign,clean(b.page),clean(b.form),deadlines.acceptanceDueAt,deadlines.firstContactDueAt,deadlines.policy?.id||null,actor.id,campaignId],client);
    const queueReason=event.resolution==='approve_email_only'&&!rule?.teamId?'Approved website email exception awaiting Manager team assignment':routingReason(activeAiRouting,rule);
    await execute('UPDATE leads SET routing_reason=$1,last_queue_entered_at=CASE WHEN assigned_to IS NULL THEN received_at ELSE NULL END WHERE id=$2',[queueReason,lead.id],client);
    await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,acceptance_due_at,assigned_by) VALUES($1,$2,1,$3,NULL,'queued',$4,$5)`,
      [uuid(),lead.id,rule?.teamId||null,deadlines.acceptanceDueAt,actor.id],client);
    await persistAiRouting(event,aiRouting,aiRouting?.status,client);
    const profile=b.profile||{},reqId=uuid();await execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,property_types,areas,budget_min,budget_max,funding_method,timeline_code,notes,created_by,
      declared_priorities,must_haves,preferences,exclusions,acceptable_trade_offs,source_kind,source_event_id,source_tool_code,source_tool_version,source_completed_at,requirement_fingerprint)
      VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,[reqId,lead.id,routeBusinessType,b.requirement.purpose,normalizeDelimitedValues(b.requirement.propertyTypes),normalizeDelimitedValues(b.requirement.areas),budget.min,budget.max,b.requirement.fundingMethod||'unknown',b.requirement.timelineCode,clean(b.requirement.notes),actor.id,
        normalizeDelimitedValues(profile.declaredPriorities),normalizeDelimitedValues(profile.mustHaves),normalizeDelimitedValues(profile.preferences),normalizeDelimitedValues(profile.exclusions),normalizeDelimitedValues(profile.acceptableTradeOffs),b.profile?'website_profile':'broker_recorded',b.profile?event.id:null,clean(profile.sourceCode),clean(profile.sourceVersion),profile.completedAt||null,reqFingerprint],client);
    await execute(`INSERT INTO consent_evidence(id,contact_id,evidence_type,status,statement_version,source_event_id,captured_at,evidence_hash)
      VALUES($1,$2,'website_form',$3,$4,$5,$6,$7)`,[uuid(),contact.id,b.consent.marketing?'granted':'denied',b.consent.statementVersion,event.id,receivedAt,hash(JSON.stringify(b.consent))],client);
    await execute(`UPDATE customer_evidence_facts SET contact_id=$1,lead_id=$2,review_status='active',reviewed_at=NOW(),review_reason='Accepted website intake'
      WHERE intake_event_id=$3 AND review_status='pending_review'`,[contact.id,lead.id,event.id],client);
    if(identity.email&&!trustedEmail)await execute(`UPDATE customer_evidence_facts SET review_status='rejected',reviewed_at=NOW(),
      review_reason='Email was retained on the Intake Event but was not promoted to an active Customer contact channel'
      WHERE intake_event_id=$1 AND fact_code='submitted_email'`,[event.id],client);
    await execute("UPDATE website_intake_events SET status='accepted',contact_id=$1,lead_id=$2,processed_at=NOW(),error_code=NULL WHERE id=$3",[contact.id,lead.id,event.id],client);
    await audit('WebsiteIntake',event.id,'accepted',actor.id,{leadId:lead.id,eventId:event.eventId,rawCampaign,campaignId,campaignMappingStatus},client);
    return {eventId:event.eventId,contactId:contact.id,leadId:lead.id,status:'accepted',routingStatus:aiRouting?.status||'not_applicable',routedBusinessType:routeBusinessType,
      routedTeamId:rule?.teamId||null,campaignMappingStatus,governedCampaignCode:campaignMapping?.campaignCode||null};
  });
}

function emailOnlyGate(identity,emailCredibility){
  if(identity.phone||!identity.email)return null;
  if(emailCredibility?.status==='credible_domain')return null;
  return {status:'email_review',reviewRequired:true,reason:emailCredibility?.reason||'The email-only enquiry could not pass the free credibility checks.'};
}

const ADVISORY_QUESTION_LABELS=new Map([
  ['residency','Are you currently living in Dubai?'],['rent','If renting, what is your approximate annual rent?'],
  ['household','What best describes your household?'],['daily_anchor','Which location anchor matters most in daily life?'],
  ['zone','Where do you spend most of your week?'],['budget','What is your approximate purchase budget?'],
  ['funding','How do you plan to fund the purchase?'],['monthly','What monthly payment feels comfortable?'],
  ['rent_replace','Are you trying to replace rent with ownership?'],['horizon','How long can you hold the property?'],
  ['goal','What outcome matters most?'],['risk','How comfortable are you with off-plan risk?']
]);
const boundedText=(value,max)=>{const normalized=clean(value);return normalized?normalized.slice(0,max):null;};

function advisoryEvidenceFacts(b){
  if(b?.form!=='ai_advisory_v1')return [];
  const specific=b?.sourceEvidence?.sourceSpecific||{},rows=Array.isArray(specific.advisoryEvidence)?specific.advisoryEvidence:[],facts=[];
  for(const row of rows.slice(0,12)){
    const questionId=boundedText(row?.questionId,40),question=ADVISORY_QUESTION_LABELS.get(questionId),answerCode=boundedText(row?.answerCode,80),answerLabel=boundedText(row?.answerLabel,240);
    if(!question||!answerCode||!answerLabel)continue;
    facts.push(['advisory',`advisory_answer_${questionId}`,{questionId,question,answerCode,answerLabel},'declared']);
  }
  const sourceSummary=specific.advisorySummary&&typeof specific.advisorySummary==='object'&&!Array.isArray(specific.advisorySummary)?specific.advisorySummary:null;
  if(sourceSummary){
    const summary={clientProfile:boundedText(sourceSummary.clientProfile,500),recommendedRoute:boundedText(sourceSummary.recommendedRoute,500),summary:boundedText(sourceSummary.summary,2000),focusAreas:boundedText(sourceSummary.focusAreas,1000),whatToAvoid:boundedText(sourceSummary.whatToAvoid,1000)};
    if(Object.values(summary).some(Boolean))facts.push(['advisory','advisory_summary',summary,'system_observed']);
  }
  return facts;
}

function recommendationEvidenceFacts(b){
  if(b?.form!=='ai_property_selection_v1')return [];
  const run=b?.sourceEvidence?.sourceSpecific?.recommendationRun;
  if(!run||typeof run!=='object'||Array.isArray(run))return [['recommendation','recommendation_run_status',{status:'not_emitted_by_website',detail:'The website did not emit a structured recommendation run.'},'system_observed']];
  const metadata={journeyKey:boundedText(run.journeyKey,120),eventIdentity:boundedText(run.eventIdentity,190),generatedAt:boundedText(run.generatedAt,80),sourcePage:boundedText(run.sourcePage,2000),sourceTool:boundedText(run.sourceTool,240),toolVersion:boundedText(run.toolVersion,120),model:boundedText(run.model,240),overallRecommendation:boundedText(run.overallRecommendation,12000),unavailableFields:Array.isArray(run.unavailableFields)?run.unavailableFields.slice(0,20).map(x=>boundedText(x,500)).filter(Boolean):[]};
  const facts=[['recommendation','recommendation_run',metadata,'system_observed']];
  for(const [index,row] of (Array.isArray(run.options)?run.options:[]).entries()){
    if(!row||typeof row!=='object')continue;
    const list=(value,max=1000)=>Array.isArray(value)?value.map(x=>boundedText(x,max)).filter(Boolean):[];
    facts.push(['recommendation',`recommendation_option_${String(index+1).padStart(3,'0')}`,{presentedRank:Number(row.presentedRank)||index+1,displayedName:boundedText(row.displayedName,1000),externalReference:boundedText(row.externalReference,500),externalUrl:boundedText(row.externalUrl,4000),displayedLocation:boundedText(row.displayedLocation,2000),displayedPropertyType:boundedText(row.displayedPropertyType,500),displayedPrice:boundedText(row.displayedPrice,500),displayedSummary:boundedText(row.displayedSummary,4000),displayedText:boundedText(row.displayedText,12000),matchScore:boundedText(row.matchScore,120),matchScoreScale:boundedText(row.matchScoreScale,120),scoreLabel:boundedText(row.scoreLabel,240),matchedFactors:list(row.matchedFactors),reasons:list(row.reasons,2000),gaps:list(row.gaps,2000),cautions:list(row.cautions,2000),tradeOffs:list(row.tradeOffs,2000),selectedState:boundedText(row.selectedState,120),notEmittedByWebsite:list(row.notEmittedByWebsite,120),inventoryMappingStatus:'Website AI suggestion — Inventory mapping not yet verified'},'system_observed']);
  }
  return facts;
}

function intakeEvidenceFacts(b,identity){
  const profile=b.profile||{},requirement=b.requirement||{},sourceEvidence=b.sourceEvidence||{},attribution=sourceEvidence.attribution||{},facts=[
    ['identity','submitted_name',clean(b.contact?.fullName),'declared'],
    ['identity','submitted_mobile',identity.phone,'system_observed'],
    ['identity','submitted_email',identity.email,'system_observed'],
    ['enquiry','business_type',clean(b.businessType),'declared'],
    ['enquiry','ai_routing_decision',sourceEvidence.sourceSpecific?.aiRoutingDecision||null,'system_observed'],
    ['enquiry','message',clean(requirement.notes),'declared'],
    ['requirement','purpose',clean(requirement.purpose),'declared'],
    ['requirement','property_types',normalizeDelimitedValues(requirement.propertyTypes),'declared'],
    ['requirement','areas',normalizeDelimitedValues(requirement.areas),'declared'],
    ['requirement','budget',{min:requirement.budgetMin??null,max:requirement.budgetMax??null},'declared'],
    ['requirement','funding_method',clean(requirement.fundingMethod),'declared'],
    ['requirement','timeline',clean(requirement.timelineCode),'declared'],
    ['profile','declared_priorities',normalizeDelimitedValues(profile.declaredPriorities),'declared'],
    ['profile','must_haves',normalizeDelimitedValues(profile.mustHaves),'declared'],
    ['profile','preferences',normalizeDelimitedValues(profile.preferences),'declared'],
    ['profile','exclusions',normalizeDelimitedValues(profile.exclusions),'declared'],
    ['profile','acceptable_trade_offs',normalizeDelimitedValues(profile.acceptableTradeOffs),'declared'],
    ['attribution','campaign',clean(b.campaign),'system_observed'],
    ['attribution','source_page',clean(b.page),'system_observed'],
    ['attribution','source_form',clean(b.form),'system_observed'],
    ['attribution','form_version',clean(sourceEvidence.formVersion||b.formVersion),'system_observed'],
    ['attribution','referrer',clean(sourceEvidence.referrer),'system_observed'],
    ['attribution','utm_source',clean(attribution.utmSource),'system_observed'],
    ['attribution','utm_medium',clean(attribution.utmMedium),'system_observed'],
    ['attribution','utm_campaign',clean(attribution.utmCampaign),'system_observed'],
    ['attribution','utm_content',clean(attribution.utmContent),'system_observed'],
    ['attribution','utm_term',clean(attribution.utmTerm),'system_observed'],
    ['attribution','property_reference',clean(b.property?.externalId||b.propertyId||b.listingId),'system_observed'],
    ['consent','marketing',{granted:Boolean(b.consent?.marketing),statementVersion:clean(b.consent?.statementVersion)},'system_observed'],
    ...advisoryEvidenceFacts(b),...recommendationEvidenceFacts(b)
  ];
  return facts.filter(([,code,value])=>value!==null&&value!==undefined&&value!==''&&(!Array.isArray(value)||value.length)&&
    (code!=='budget'||value.min!==null||value.max!==null));
}

async function retainIntakeEvidence(event,b,identity,client=undefined){
  const sourceCode=clean(b.profile?.sourceCode)||clean(b.form)||'website_intake',sourceVersion=clean(b.profile?.sourceVersion)||clean(b.formVersion);
  for(const [group,code,value,kind] of intakeEvidenceFacts(b,identity))await execute(`INSERT INTO customer_evidence_facts
    (id,intake_event_id,fact_group,fact_code,value_json,evidence_kind,review_status,source_code,source_version,captured_at)
    VALUES($1,$2,$3,$4,$5::jsonb,$6,'pending_review',$7,$8,COALESCE($9::timestamptz,NOW())) ON CONFLICT(intake_event_id,fact_code) DO NOTHING`,
    [uuid(),event.id,group,code,JSON.stringify(value),kind,sourceCode,sourceVersion,b.profile?.completedAt||null],client);
}

r.post('/intake/website',async(req,res)=>{
  if(Buffer.byteLength(req.rawBody||'')>262144)return res.status(413).json({error:'Website intake body is too large'});
  const auth=authenticate(req);if(auth)return res.status(auth.status).json({error:auth.error});
  const b=req.body||{},checked=validatePayload(b);if(checked.error)return res.status(400).json({error:checked.error});
  const aiRouting=websiteAiRoutingDecision(b);
  const actor=await intakeActor();if(!actor)return res.status(503).json({error:'Website intake is not configured'});
  const primaryArea=await resolvePrimaryRoutingArea(b.primaryRoutingAreaId,b.requirement.areas);if(primaryArea.error)return res.status(400).json({error:primaryArea.error});
  const payloadHash=hash(req.rawBody||'');
  const existing=await one('SELECT * FROM website_intake_events WHERE event_id=$1',[b.eventId]);
  if(existing){
    if(existing.payloadHash!==payloadHash)return res.status(409).json({error:'Event identifier was already used with different data'});
    if(existing.status==='accepted')return res.json({eventId:existing.eventId,contactId:existing.contactId,leadId:existing.leadId,status:'accepted',idempotent:true});
    return res.status(409).json({error:'Event requires authorized support replay'});
  }
  const emailCredibility=checked.identity.email?await checkEmailCredibility(checked.identity.email):null;
  const event=await one(`INSERT INTO website_intake_events(id,event_id,payload_hash,status,received_payload,source_code,campaign_code,source_page,source_form,email_credibility,profile_source_code,profile_source_version,journey_key,
    ai_routing_status,ai_routing_business_type,ai_routing_reason,ai_routing_decision)
    VALUES($1,$2,$3,'processing',$4::jsonb,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16::jsonb) RETURNING *`,[uuid(),b.eventId,payloadHash,JSON.stringify(b),b.source||'Website',clean(b.campaign),clean(b.page),clean(b.form),emailCredibility?JSON.stringify(emailCredibility):null,clean(b.profile?.sourceCode),clean(b.profile?.sourceVersion),clean(b.journeyKey),
    aiRouting?.status||null,aiRouting?.businessType||null,aiRouting?.reason||null,aiRouting?JSON.stringify(aiRouting.raw||aiRouting):null]);
  try{
    await retainIntakeEvidence(event,b,checked.identity);
    const emailGate=emailOnlyGate(checked.identity,emailCredibility);
    if(emailGate){
      const reviewDueAt=new Date(Date.now()+4*60*60*1000);
      await execute(`UPDATE website_intake_events SET status='email_review',review_due_at=$1,processed_at=NOW(),error_code='EMAIL_ONLY_CREDIBILITY_REVIEW' WHERE id=$2`,[reviewDueAt,event.id]);
      await audit('WebsiteIntake',event.id,'email_only_review_required',actor.id,{eventId:event.eventId,emailCredibilityStatus:emailCredibility?.status,reviewDueAt});
      return res.status(202).json({eventId:event.eventId,status:'email_review',reviewRequired:true,reviewDueAt,reason:emailGate.reason});
    }
    const result=await processEvent(event,b,checked.identity,actor);return res.status(['identity_review','duplicate_review'].includes(result.status)?202:201).json(result);
  }
  catch(error){await execute("UPDATE website_intake_events SET status='failed',processed_at=NOW(),error_code='PROCESSING_FAILED' WHERE id=$1",[event.id]);throw error;}
});

function supportOnly(req,res,next){
  if(!hasInternalCrmIdentity(req.broker)||!isManager(req.broker))return res.status(403).json({error:'Manager or administrator access required'});
  next();
}
const reviewText=(value,limit=4000)=>typeof value==='string'&&value.trim()?value.trim().slice(0,limit):null;
const reviewValues=value=>normalizeDelimitedValues(value).slice(0,20).map(item=>String(item).slice(0,240));
function intakeReviewEvidence(payload){
  const source=payload&&typeof payload==='object'?payload:{},contact=source.contact||{},requirement=source.requirement||{},profile=source.profile||{};
  return {
    fullName:reviewText(contact.fullName,190),email:reviewText(contact.email,320),phone:reviewText(contact.phone,80),preferredChannel:reviewText(contact.preferredChannel,40),
    title:reviewText(source.title,190),businessType:reviewText(source.businessType,40),purpose:reviewText(requirement.purpose,80),notes:reviewText(requirement.notes),
    propertyTypes:reviewValues(requirement.propertyTypes),areas:reviewValues(requirement.areas),budgetMin:requirement.budgetMin??null,budgetMax:requirement.budgetMax??null,
    fundingMethod:reviewText(requirement.fundingMethod,80),timelineCode:reviewText(requirement.timelineCode,80),marketingConsent:Boolean(source.consent?.marketing),
    declaredPriorities:reviewValues(profile.declaredPriorities),preferences:reviewValues(profile.preferences),sourceTool:reviewText(profile.sourceCode,120),sourceToolVersion:reviewText(profile.sourceVersion,120)
  };
}
r.get('/admin/website-intake',requireAuth,supportOnly,async(req,res)=>{
  const status=['processing','accepted','failed','email_review','identity_review','duplicate_review','rejected'].includes(req.query.status)?req.query.status:null;
  const events=await many(`SELECT id,event_id,status,contact_id,lead_id,received_at,processed_at,attempt_count,error_code,replayed_by,
    source_code,campaign_code,campaign_id,campaign_mapping_status,source_page,source_form,email_credibility,identity_conflict_contact_ids,review_due_at,resolution,resolution_reason,resolved_at,
    requirement_fingerprint,duplicate_candidate_lead_id,duplicate_resolution,duplicate_resolution_reason,ai_routing_status,ai_routing_business_type,ai_routing_reason,ai_routing_decision,received_payload
    FROM website_intake_events WHERE ($1::text IS NULL OR status=$1) ORDER BY received_at DESC LIMIT 200`,[status]);
  res.json({events:events.map(event=>{const {receivedPayload,...safeEvent}=event;return {...safeEvent,reviewEvidence:intakeReviewEvidence(receivedPayload),recoverable:event.status==='processing'&&!event.processedAt&&Date.now()-new Date(event.receivedAt).getTime()>=5*60*1000};})});
});
r.post('/admin/website-intake/:eventId/resolve-email',requireAuth,supportOnly,async(req,res)=>{
  const resolution=clean(req.body?.resolution),reason=clean(req.body?.reason);
  if(!['approve_email_only','reject_invalid'].includes(resolution))return res.status(400).json({error:'Approve the email-only enquiry or reject it as invalid'});
  if(!reason)return res.status(400).json({error:'Email review reason is required'});
  const current=await one('SELECT * FROM website_intake_events WHERE event_id=$1',[req.params.eventId]);
  if(!current)return res.status(404).json({error:'Website event not found'});if(current.status!=='email_review')return res.status(409).json({error:'Only an email-review event can be resolved'});
  if(resolution==='reject_invalid'){
    const rejected=await one(`UPDATE website_intake_events SET status='rejected',resolution=$1,resolution_reason=$2,resolved_by=$3,
      resolved_at=NOW(),processed_at=NOW() WHERE id=$4 AND status='email_review' RETURNING *`,[resolution,reason,req.broker.id,current.id]);
    if(!rejected)return res.status(409).json({error:'The event was already resolved'});await execute(`UPDATE customer_evidence_facts SET review_status='rejected',reviewed_by=$1,reviewed_at=NOW(),review_reason=$2 WHERE intake_event_id=$3 AND review_status='pending_review'`,[req.broker.id,reason,current.id]);await audit('WebsiteIntake',current.id,'email_only_rejected',req.broker.id,{eventId:current.eventId,reason});return res.json({eventId:current.eventId,status:'rejected'});
  }
  const b=current.receivedPayload||{},checked=validatePayload(b);if(checked.error)return res.status(409).json({error:'Original intake evidence cannot be processed',detail:checked.error});
  const actor=await intakeActor();if(!actor)return res.status(503).json({error:'Website intake is not configured'});
  const claimed=await one(`UPDATE website_intake_events SET status='processing',resolution=$1,resolution_reason=$2,resolved_by=$3,resolved_at=NOW(),
    attempt_count=attempt_count+1,error_code=NULL WHERE id=$4 AND status='email_review' RETURNING *`,[resolution,reason,req.broker.id,current.id]);
  if(!claimed)return res.status(409).json({error:'The event was already resolved'});claimed.emailCredibility=current.emailCredibility;
  try{const result=await processEvent(claimed,b,checked.identity,actor);await audit('WebsiteIntake',current.id,'email_only_approved',req.broker.id,{eventId:current.eventId,reason});res.json(result);}
  catch(error){await execute("UPDATE website_intake_events SET status='failed',processed_at=NOW(),error_code='EMAIL_RESOLUTION_FAILED' WHERE id=$1",[current.id]);throw error;}
});
r.post('/admin/website-intake/:eventId/replay',requireAuth,supportOnly,async(req,res)=>{
  const existing=await one('SELECT * FROM website_intake_events WHERE event_id=$1',[req.params.eventId]);if(!existing)return res.status(404).json({error:'Website event not found'});
  const replayPayload=clean(req.body?.eventId)?req.body:existing.receivedPayload||{},checked=validatePayload(replayPayload);if(checked.error)return res.status(400).json({error:checked.error});
  if(replayPayload.eventId!==req.params.eventId)return res.status(400).json({error:'eventId must match the failed event'});
  const event=await transaction(async client=>{
    const current=await one('SELECT * FROM website_intake_events WHERE event_id=$1 FOR UPDATE',[req.params.eventId],client);
    if(!current)return null;
    const interrupted=current.status==='processing'&&!current.processedAt&&Date.now()-new Date(current.receivedAt).getTime()>=5*60*1000;
    if(current.status!=='failed'&&!interrupted)return {conflict:true};
    return one(`UPDATE website_intake_events SET status='processing',payload_hash=$1,attempt_count=attempt_count+1,replayed_by=$2,error_code=NULL WHERE id=$3 RETURNING *`,
      [hash(JSON.stringify(replayPayload)),req.broker.id,current.id],client);
  });
  if(!event)return res.status(404).json({error:'Website event not found'});if(event.conflict)return res.status(409).json({error:'Only failed or interrupted events can be replayed'});
  const actor=await intakeActor();if(!actor)return res.status(503).json({error:'Website intake is not configured'});
  const emailCredibility=checked.identity.email?await checkEmailCredibility(checked.identity.email):null;
  await execute('UPDATE website_intake_events SET received_payload=$1::jsonb,email_credibility=$2::jsonb WHERE id=$3',[JSON.stringify(replayPayload),emailCredibility?JSON.stringify(emailCredibility):null,event.id]);
  event.emailCredibility=emailCredibility;
  try{const result=await processEvent(event,replayPayload,checked.identity,actor);await audit('WebsiteIntake',event.id,'replayed',req.broker.id);res.json(result);}
  catch(error){await execute("UPDATE website_intake_events SET status='failed',processed_at=NOW(),error_code='PROCESSING_FAILED' WHERE id=$1",[event.id]);throw error;}
});

r.post('/admin/website-intake/:eventId/resolve-identity',requireAuth,supportOnly,async(req,res)=>{
  const resolution=clean(req.body?.resolution),reason=clean(req.body?.reason);
  if(!['use_email_customer','use_phone_customer','reject_invalid'].includes(resolution))return res.status(400).json({error:'Choose the email Customer, phone Customer or reject the invalid event'});
  if(!reason)return res.status(400).json({error:'Resolution reason is required'});
  const current=await one('SELECT * FROM website_intake_events WHERE event_id=$1',[req.params.eventId]);
  if(!current)return res.status(404).json({error:'Website event not found'});if(current.status!=='identity_review')return res.status(409).json({error:'Only an identity-conflict event can be resolved'});
  if(resolution==='reject_invalid'){
    const rejected=await one(`UPDATE website_intake_events SET status='rejected',resolution=$1,resolution_reason=$2,resolved_by=$3,
      resolved_at=NOW(),processed_at=NOW() WHERE id=$4 AND status='identity_review' RETURNING *`,[resolution,reason,req.broker.id,current.id]);
    if(!rejected)return res.status(409).json({error:'The event was already resolved'});await execute(`UPDATE customer_evidence_facts SET review_status='rejected',reviewed_by=$1,reviewed_at=NOW(),review_reason=$2 WHERE intake_event_id=$3 AND review_status='pending_review'`,[req.broker.id,reason,current.id]);await audit('WebsiteIntake',current.id,'identity_conflict_rejected',req.broker.id,{eventId:current.eventId,reason});return res.json({eventId:current.eventId,status:'rejected'});
  }
  const b=current.receivedPayload||{},checked=validatePayload(b);if(checked.error)return res.status(409).json({error:'Original intake evidence cannot be processed',detail:checked.error});
  const channelKind=resolution==='use_email_customer'?'Email':'Phone',normalized=channelKind==='Email'?checked.identity.email:checked.identity.phone;
  const selected=normalized?await one(`SELECT c.id FROM contacts c JOIN contact_channels ch ON ch.contact_id=c.id WHERE ch.channel_kind=$1 AND ch.normalized_value=$2 AND c.lifecycle_status='active' ORDER BY c.created_at LIMIT 1`,[channelKind,normalized]):null;
  if(!selected)return res.status(409).json({error:`The selected ${channelKind.toLowerCase()} Customer is no longer active`});
  const actor=await intakeActor();if(!actor)return res.status(503).json({error:'Website intake is not configured'});
  const claimed=await one(`UPDATE website_intake_events SET status='processing',resolution=$1,resolution_reason=$2,resolved_by=$3,resolved_at=NOW(),
    attempt_count=attempt_count+1,error_code=NULL WHERE id=$4 AND status='identity_review' RETURNING *`,[resolution,reason,req.broker.id,current.id]);
  if(!claimed)return res.status(409).json({error:'The event was already resolved'});claimed.emailCredibility=current.emailCredibility;
  try{const result=await processEvent(claimed,b,checked.identity,actor,{forcedContactId:selected.id});await audit('WebsiteIntake',current.id,'identity_conflict_resolved',req.broker.id,{eventId:current.eventId,resolution,selectedContactId:selected.id,reason});res.json(result);}
  catch(error){await execute("UPDATE website_intake_events SET status='failed',processed_at=NOW(),error_code='RESOLUTION_PROCESSING_FAILED' WHERE id=$1",[current.id]);throw error;}
});

r.post('/admin/website-intake/:eventId/resolve-lead-duplicate',requireAuth,supportOnly,async(req,res)=>{
  const resolution=clean(req.body?.resolution),reason=clean(req.body?.reason);
  if(!['use_existing_lead','create_distinct_lead','reject_invalid'].includes(resolution))return res.status(400).json({error:'Choose the existing Lead, create a distinct Lead or reject the invalid event'});
  if(!reason)return res.status(400).json({error:'Duplicate resolution reason is required'});
  const current=await one('SELECT * FROM website_intake_events WHERE event_id=$1',[req.params.eventId]);if(!current)return res.status(404).json({error:'Website event not found'});if(current.status!=='duplicate_review')return res.status(409).json({error:'Only a possible duplicate Lead event can be resolved'});
  const candidate=await one('SELECT * FROM leads WHERE id=$1',[current.duplicateCandidateLeadId]);if(!candidate)return res.status(409).json({error:'The candidate Lead no longer exists'});
  if(resolution==='reject_invalid'){const rejected=await one(`UPDATE website_intake_events SET status='rejected',duplicate_resolution=$1,duplicate_resolution_reason=$2,
    resolved_by=$3,resolved_at=NOW(),processed_at=NOW() WHERE id=$4 AND status='duplicate_review' RETURNING *`,[resolution,reason,req.broker.id,current.id]);if(!rejected)return res.status(409).json({error:'The event was already resolved'});await execute(`UPDATE customer_evidence_facts SET review_status='rejected',reviewed_by=$1,reviewed_at=NOW(),review_reason=$2 WHERE intake_event_id=$3 AND review_status='pending_review'`,[req.broker.id,reason,current.id]);await audit('WebsiteIntake',current.id,'duplicate_lead_rejected',req.broker.id,{eventId:current.eventId,candidateLeadId:candidate.id,reason});return res.json({eventId:current.eventId,status:'rejected'});}
  const b=current.receivedPayload||{},checked=validatePayload(b);if(checked.error)return res.status(409).json({error:'Original intake evidence cannot be processed',detail:checked.error});
  if(resolution==='use_existing_lead'){
    if(['Won','Lost'].includes(candidate.stage))return res.status(409).json({error:'The candidate Lead is now terminal; create a distinct Lead or reject this event'});
    const result=await transaction(async client=>{const claimed=await one(`UPDATE website_intake_events SET status='accepted',contact_id=$1,lead_id=$2,
      duplicate_resolution=$3,duplicate_resolution_reason=$4,resolved_by=$5,resolved_at=NOW(),processed_at=NOW(),error_code=NULL
      WHERE id=$6 AND status='duplicate_review' RETURNING *`,[candidate.contactId,candidate.id,resolution,reason,req.broker.id,current.id],client);if(!claimed)return null;
      await execute(`INSERT INTO consent_evidence(id,contact_id,evidence_type,status,statement_version,source_event_id,captured_at,evidence_hash)
        VALUES($1,$2,'website_form',$3,$4,$5,NOW(),$6)`,[uuid(),candidate.contactId,b.consent.marketing?'granted':'denied',b.consent.statementVersion,current.id,hash(JSON.stringify(b.consent))],client);
      await execute(`UPDATE customer_evidence_facts SET contact_id=$1,lead_id=$2,review_status='active',reviewed_by=$3,reviewed_at=NOW(),review_reason=$4
        WHERE intake_event_id=$5 AND review_status='pending_review'`,[candidate.contactId,candidate.id,req.broker.id,reason,current.id],client);
      await audit('WebsiteIntake',current.id,'duplicate_lead_linked',req.broker.id,{eventId:current.eventId,existingLeadId:candidate.id,reason},client);return claimed;});
    if(!result)return res.status(409).json({error:'The event was already resolved'});return res.json({eventId:current.eventId,status:'accepted',leadId:candidate.id,contactId:candidate.contactId,reusedExistingLead:true});
  }
  const actor=await intakeActor();if(!actor)return res.status(503).json({error:'Website intake is not configured'});const claimed=await one(`UPDATE website_intake_events SET status='processing',duplicate_resolution=$1,
    duplicate_resolution_reason=$2,resolved_by=$3,resolved_at=NOW(),attempt_count=attempt_count+1,error_code=NULL WHERE id=$4 AND status='duplicate_review' RETURNING *`,[resolution,reason,req.broker.id,current.id]);if(!claimed)return res.status(409).json({error:'The event was already resolved'});claimed.emailCredibility=current.emailCredibility;
  try{const result=await processEvent(claimed,b,checked.identity,actor,{forcedContactId:candidate.contactId,forceDistinctLead:true});await audit('WebsiteIntake',current.id,'distinct_lead_approved',req.broker.id,{eventId:current.eventId,newLeadId:result.leadId,candidateLeadId:candidate.id,reason});res.json(result);}
  catch(error){await execute("UPDATE website_intake_events SET status='failed',processed_at=NOW(),error_code='DUPLICATE_RESOLUTION_FAILED' WHERE id=$1",[current.id]);throw error;}
});

export { processEvent, validatePayload };
export default r;
