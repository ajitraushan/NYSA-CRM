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

const FEE_TYPES=['percentage','fixed','conditional_fixed','percentage_plus_fixed','estimate_range','quantity','tiered'];
const FEE_BASES=['purchase_price','mortgage_amount','property_value','quantity','none'];
const FEE_TRANSACTIONS=['all','purchase','resale','off_plan','mortgage','investment','gift'];
const FEE_CHANNELS=['all','trustee_centre','dubai_now','dld_online','bank','other'];
const FEE_PAYERS=['buyer','seller','shared','contractual','lender','not_applicable'];
const finiteNonNegative=value=>Number.isFinite(Number(value))&&Number(value)>=0;

export function validateFeeItems(items){
  if(!Array.isArray(items)||!items.length)return 'At least one regulatory or fee item is required';
  const seen=new Set();
  for(const item of items){
    const codeError=stableCodeError(item?.code);if(codeError)return codeError;
    if(seen.has(item.code))return `Duplicate fee item code: ${item.code}`;seen.add(item.code);
    if(!String(item.label||'').trim())return `Business label is required for ${item.code}`;
    if(!FEE_TYPES.includes(item.calculationType))return `Invalid calculation type for ${item.code}`;
    const basis=item.calculationBasis||(item.calculationType==='fixed'?'none':'purchase_price');if(!FEE_BASES.includes(basis))return `Invalid calculation basis for ${item.code}`;
    if(item.transactionType&&!FEE_TRANSACTIONS.includes(item.transactionType))return `Invalid transaction type for ${item.code}`;
    if(item.serviceChannel&&!FEE_CHANNELS.includes(item.serviceChannel))return `Invalid service channel for ${item.code}`;
    if(item.payer&&!FEE_PAYERS.includes(item.payer))return `Invalid payer for ${item.code}`;
    if(item.vatPercent!==''&&item.vatPercent!==undefined&&(!finiteNonNegative(item.vatPercent)||Number(item.vatPercent)>100))return `VAT must be between 0 and 100 for ${item.code}`;
    if(item.capAmount!==''&&item.capAmount!==undefined&&!finiteNonNegative(item.capAmount))return `Cap must be non-negative for ${item.code}`;
    if(['percentage','percentage_plus_fixed'].includes(item.calculationType)&&!finiteNonNegative(item.ratePercent))return `Valid percentage is required for ${item.code}`;
    if(item.calculationType==='fixed'&&!finiteNonNegative(item.amount))return `Valid fixed amount is required for ${item.code}`;
    if(item.calculationType==='percentage_plus_fixed'&&!finiteNonNegative(item.fixedAddition))return `Valid fixed addition is required for ${item.code}`;
    if(item.calculationType==='quantity'&&!finiteNonNegative(item.unitAmount))return `Valid amount per unit is required for ${item.code}`;
    if(item.calculationType==='estimate_range'&&(!finiteNonNegative(item.minAmount)||!finiteNonNegative(item.maxAmount)||Number(item.maxAmount)<Number(item.minAmount)))return `Valid minimum and maximum estimate are required for ${item.code}`;
    if(item.calculationType==='conditional_fixed'){
      if(!Array.isArray(item.bands)||!item.bands.length)return `At least one conditional band is required for ${item.code}`;
      for(const band of item.bands){if(!['purchase_price','mortgage_amount','property_value','property_type','service_channel'].includes(band.dimension)||!['below','at_or_above','equals'].includes(band.operator)||band.value===''||band.value===undefined||!finiteNonNegative(band.amount))return `Every conditional band needs a dimension, comparison, value and amount for ${item.code}`;}
    }
    if(item.calculationType==='tiered'&&(!Array.isArray(item.tiers)||!item.tiers.length))return `Tier bands are required for ${item.code}`;
  }
  return null;
}

const feeNorm=value=>String(value||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
const feeRound=value=>Math.round(Number(value)*100)/100;
function feeContext(input){if(typeof input==='number')return {propertyPrice:input,propertyValue:input,mortgageAmount:0,quantity:1,transactionTypes:['purchase'],propertyType:null,serviceChannel:null};const x=input||{};return {propertyPrice:Number(x.propertyPrice??x.baseAmount??0),propertyValue:Number(x.propertyValue??x.propertyPrice??x.baseAmount??0),mortgageAmount:Number(x.mortgageAmount??x.loanAmount??0),quantity:Number(x.quantity??1),quantities:x.quantities||{},transactionTypes:(Array.isArray(x.transactionTypes)?x.transactionTypes:[x.transactionType||'purchase']).map(feeNorm),propertyType:feeNorm(x.propertyType)||null,serviceChannel:feeNorm(x.serviceChannel)||null};}
function feeBase(item,context){return {purchase_price:context.propertyPrice,mortgage_amount:context.mortgageAmount,property_value:context.propertyValue,quantity:context.quantity,none:0}[item.calculationBasis||(item.calculationType==='fixed'?'none':'purchase_price')];}
function feeApplies(item,context){const transaction=feeNorm(item.transactionType||'all'),property=feeNorm(item.propertyType||'all'),channel=feeNorm(item.serviceChannel||'all');if(transaction!=='all'&&!context.transactionTypes.includes(transaction))return false;if(property!=='all'&&context.propertyType!==property)return false;if(channel!=='all'&&context.serviceChannel!==channel)return false;return true;}
function matchingBand(item,context){return (item.bands||[]).find(band=>{const dimension=band.dimension,value=['property_type','service_channel'].includes(dimension)?context[dimension==='property_type'?'propertyType':'serviceChannel']:{purchase_price:context.propertyPrice,mortgage_amount:context.mortgageAmount,property_value:context.propertyValue}[dimension];if(band.operator==='equals')return typeof value==='number'?value===Number(band.value):String(band.value).split(',').map(feeNorm).includes(feeNorm(value));if(!Number.isFinite(Number(value)))return false;return band.operator==='below'?Number(value)<Number(band.value):Number(value)>=Number(band.value);});}

export function calculateFeeItems(items,input){
  const invalid=validateFeeItems(items);if(invalid)return {error:invalid};const context=feeContext(input);
  if([context.propertyPrice,context.propertyValue,context.mortgageAmount,context.quantity].some(x=>!Number.isFinite(x)||x<0))return {error:'Fee calculation inputs must be non-negative numbers'};
  const values={},details={};let total=0,totalMinimum=0,totalMaximum=0;
  for(const item of items){const include=item.includeInTotal!==false,applies=feeApplies(item,context),base=feeBase(item,context),vatRate=Number(item.vatPercent||0);let net=0,min=null,max=null,band=null,reason=null;
    if(!applies)reason='Applicability conditions do not match';
    else if(item.calculationType==='percentage')net=base*Number(item.ratePercent)/100;
    else if(item.calculationType==='fixed')net=Number(item.amount);
    else if(item.calculationType==='percentage_plus_fixed')net=base*Number(item.ratePercent)/100+Number(item.fixedAddition);
    else if(item.calculationType==='quantity')net=Number(context.quantities[item.quantityCode]??context.quantity)*Number(item.unitAmount);
    else if(item.calculationType==='conditional_fixed'){band=matchingBand(item,context);if(band)net=Number(band.amount);else reason='No conditional band matches the supplied context';}
    else if(item.calculationType==='estimate_range'){min=Number(item.minAmount);max=Number(item.maxAmount);}
    else for(const tier of item.tiers){const from=Number(tier.from||0),to=tier.to===null||tier.to===undefined?Infinity:Number(tier.to),slice=Math.max(0,Math.min(base,to)-from);net+=slice*Number(tier.ratePercent||0)/100;}
    if(item.capAmount!==''&&item.capAmount!==undefined&&Number.isFinite(Number(item.capAmount)))net=Math.min(net,Number(item.capAmount));
    const vat=feeRound(net*vatRate/100),amount=min===null?feeRound(net+vat):null,minWithVat=min===null?amount:feeRound(min*(1+vatRate/100)),maxWithVat=max===null?amount:feeRound(max*(1+vatRate/100));values[item.code]=reason?0:amount;
    details[item.code]={label:item.label,placeholder:`fee.${item.code}`,applied:!reason,reason,calculationType:item.calculationType,calculationBasis:item.calculationBasis||'purchase_price',baseAmount:base,netAmount:min===null?feeRound(net):null,vatAmount:min===null?vat:null,amount:reason?0:amount,minimum:reason?0:minWithVat,maximum:reason?0:maxWithVat,payer:item.payer||'contractual',includeInTotal:include,matchedBand:band||null,sourceReference:item.sourceReference||null};
    if(!reason&&include){if(amount!==null){total+=amount;totalMinimum+=amount;totalMaximum+=amount;}else{totalMinimum+=minWithVat;totalMaximum+=maxWithVat;}}
  }
  return {context,values,details,total:feeRound(total),totalMinimum:feeRound(totalMinimum),totalMaximum:feeRound(totalMaximum)};
}

export function validateProposalConfiguration(configuration={}){const sections=configuration.sections;if(!Array.isArray(sections)||!sections.length)return 'At least one proposal section is required';const ids=new Set();for(const section of sections){if(stableCodeError(section?.code))return `Invalid section code: ${section?.code||''}`;if(ids.has(section.code))return `Duplicate section code: ${section.code}`;ids.add(section.code);if(!String(section.label||'').trim()||!['system','agent_input','approved_text','properties','media','financial'].includes(section.source))return `Section ${section.code} needs a label and valid source`;if(section.source==='system'&&!String(section.field||'').trim())return `System field mapping is required for ${section.code}`;}return null;}
