import { BUSINESS_TYPES } from './crm-domain.js';

const AI_FORMS=new Set(['ai_advisory_v1','ai_property_selection_v1']);
const ROUTING_STATUSES=new Set(['awaiting_property_selection','determined','review_required']);

const text=value=>typeof value==='string'&&value.trim()?value.trim():null;

export function websiteAiRoutingDecision(body={}){
  const form=text(body.form),raw=body?.sourceEvidence?.sourceSpecific?.aiRoutingDecision;
  if(!AI_FORMS.has(form))return null;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {status:'not_emitted',businessType:null,reason:'The signed website payload did not emit an AI routing decision.',source:'not_emitted'};
  const status=text(raw.status),businessType=text(raw.businessType),reason=text(raw.reason)||'No routing explanation was emitted by the website.';
  if(!ROUTING_STATUSES.has(status))return {status:'review_required',businessType:null,reason:'The website emitted an unsupported AI routing status.',source:'invalid',raw};
  if(status==='determined'&&!['Sale','Off-plan'].includes(businessType))return {status:'review_required',businessType:null,reason:'The website AI routing decision did not identify Sale or Off-plan.',source:'invalid',raw};
  return {status,businessType:status==='determined'&&BUSINESS_TYPES.includes(businessType)?businessType:null,reason,source:'signed_website_decision',raw};
}

export function routingReason(decision,rule){
  if(!decision)return rule?`Matched routing rule: ${rule.name}`:'Company unassigned fallback';
  if(decision.status==='awaiting_property_selection')return 'Website AI routing pending completed Property Selection';
  if(decision.status==='review_required'||decision.status==='not_emitted')return `Website AI routing review required: ${decision.reason}`;
  return rule?`Website AI routing: ${decision.reason}; matched rule: ${rule.name}`:`Website AI routing: ${decision.reason}; Company Unassigned Queue`;
}
