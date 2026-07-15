export const STABLE_CODE_PATTERN=/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
export function stableCodeError(value){const code=String(value||'').trim();if(!code)return 'Stable code is required';if(!STABLE_CODE_PATTERN.test(code))return 'Stable code must use lowercase snake_case, for example loss_reason';return null;}

export function timeToMinutes(value){const match=String(value||'').match(/^([01]\d|2[0-3]):([0-5]\d)$/);return match?Number(match[1])*60+Number(match[2]):null;}
export function minutesToTime(value){const n=Number(value);return Number.isInteger(n)&&n>=0&&n<=1440?`${String(Math.floor(n/60)%24).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`:null;}

export const DASHBOARD_METRICS=Object.freeze({
  new_leads:{label:'New leads',unit:'leads',definition:'Leads received during the selected target period',direction:'low_bad'},
  won_leads:{label:'Won leads',unit:'leads',definition:'Leads moved to Won during the selected target period',direction:'low_bad'},
  hot_leads:{label:'Hot leads',unit:'leads',definition:'Open leads whose latest approved qualification result is Hot',direction:'low_bad'},
  sla_breaches:{label:'SLA breaches',unit:'leads',definition:'Open leads past their active acceptance or first-contact SLA deadline',direction:'high_bad'},
  sla_risk:{label:'SLA risk',unit:'leads',definition:'Open leads within the configured warning window before SLA breach',direction:'high_bad'},
  no_next_action:{label:'No next action',unit:'leads',definition:'Open assigned leads with no future follow-up or open task',direction:'high_bad'},
  stale_risk:{label:'Stale-risk leads',unit:'leads',definition:'Open leads without qualifying recent engagement',direction:'high_bad'},
  team_capacity_pressure:{label:'Team-capacity pressure',unit:'percent',definition:'Assigned open workload relative to maintained active team capacity',direction:'high_bad'},
  proposal_workload:{label:'Proposal workload',unit:'proposals',definition:'Proposal records awaiting generation, review or recorded delivery',direction:'high_bad'},
  customer_engagement:{label:'Customer engagement',unit:'activities',definition:'Qualifying customer activities completed during the target period',direction:'low_bad'},
  inventory_available:{label:'Available inventory',unit:'listings',definition:'Active available listings within the selected scope',direction:'low_bad'},
  inventory_stale:{label:'Aging inventory',unit:'listings',definition:'Available listings older than the approved aging threshold',direction:'high_bad'},
  inventory_readiness_exposure:{label:'Inventory readiness exposure',unit:'listings',definition:'Listings missing an approved readiness requirement',direction:'high_bad'},
  operational_exceptions:{label:'Operational exceptions',unit:'records',definition:'Open governed operational exceptions requiring intervention',direction:'high_bad'}
});

export function validateFeeItems(items){if(!Array.isArray(items)||!items.length)return 'At least one regulatory or fee item is required';const seen=new Set();for(const item of items){const codeError=stableCodeError(item?.code);if(codeError)return codeError;if(seen.has(item.code))return `Duplicate fee item code: ${item.code}`;seen.add(item.code);if(!String(item.label||'').trim())return `Business label is required for ${item.code}`;if(!['percentage','fixed','tiered'].includes(item.calculationType))return `Invalid calculation type for ${item.code}`;if(item.calculationType==='percentage'&&(!Number.isFinite(Number(item.ratePercent))||Number(item.ratePercent)<0))return `Valid percentage is required for ${item.code}`;if(item.calculationType==='fixed'&&(!Number.isFinite(Number(item.amount))||Number(item.amount)<0))return `Valid fixed amount is required for ${item.code}`;if(item.calculationType==='tiered'&&(!Array.isArray(item.tiers)||!item.tiers.length))return `Tier bands are required for ${item.code}`;}return null;}

export function calculateFeeItems(items,baseAmount){const invalid=validateFeeItems(items),base=Number(baseAmount);if(invalid)return {error:invalid};if(!Number.isFinite(base)||base<0)return {error:'A non-negative base amount is required'};const values={};for(const item of items){let amount=0;if(item.calculationType==='percentage')amount=base*Number(item.ratePercent)/100;else if(item.calculationType==='fixed')amount=Number(item.amount);else for(const tier of item.tiers){const from=Number(tier.from||0),to=tier.to===null||tier.to===undefined?Infinity:Number(tier.to),slice=Math.max(0,Math.min(base,to)-from);amount+=slice*Number(tier.ratePercent||0)/100;}values[item.code]=Math.round(amount*100)/100;}return {baseAmount:base,values,total:Object.values(values).reduce((a,b)=>a+b,0)};}

export function validateProposalConfiguration(configuration={}){const sections=configuration.sections;if(!Array.isArray(sections)||!sections.length)return 'At least one proposal section is required';const ids=new Set();for(const section of sections){if(stableCodeError(section?.code))return `Invalid section code: ${section?.code||''}`;if(ids.has(section.code))return `Duplicate section code: ${section.code}`;ids.add(section.code);if(!String(section.label||'').trim()||!['system','agent_input','approved_text','properties','media','financial'].includes(section.source))return `Section ${section.code} needs a label and valid source`;if(section.source==='system'&&!String(section.field||'').trim())return `System field mapping is required for ${section.code}`;}return null;}
