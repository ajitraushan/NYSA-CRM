export const SOURCES = ['Website','WhatsApp','Current CRM','Referral','Social media','Walk-in','Phone','Property portal','Other'];
export const BUSINESS_TYPES = ['Sale','Rental','Off-plan','Commercial','Unconfirmed'];
export const STAGES = ['New','Contacted','Qualified','Viewing','Negotiation','Won','Lost'];
export const TEMPERATURES = ['Unassessed','Hot','Warm','Cold'];
export const CONTACT_TYPES = ['buyer','seller','landlord','tenant','developer','investor','other'];
// `developer` remains readable for legacy Contact records only. New Developers are
// governed corporate Company masters, never Customer-role classifications.
export const CUSTOMER_ROLE_INPUT_TYPES = CONTACT_TYPES.filter(role=>role!=='developer');
export const CHANNELS = ['Phone','Email','WhatsApp','SMS'];
export const ACTIVITY_TYPES = ['Task','Note','Call','Email','WhatsApp','Meeting','Viewing'];
export const JOB_ROLES = ['admin','admin_assistant','sales_agent','listing_agent','manager','director','accountant'];
export const COMPANY_TYPES = ['developer','agency','corporate_client','landlord_company','vendor','other'];

export function normalizeDelimitedValues(value) {
  const entries=(Array.isArray(value)?value:String(value??'').split(',')).map(x=>String(x).trim()).filter(Boolean),seen=new Set();
  return entries.filter(x=>{const key=x.toLocaleLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
}

export const LEAD_TRANSITIONS = Object.freeze({
  New: ['Contacted','Lost'],
  Contacted: ['Qualified','Lost'],
  Qualified: ['Viewing','Negotiation','Lost'],
  Viewing: ['Qualified','Negotiation','Lost'],
  Negotiation: ['Viewing','Won','Lost'],
  Won: [],
  Lost: ['New']
});

export function validateLeadTransition(from, to) {
  if (!STAGES.includes(from) || !STAGES.includes(to)) return 'Invalid lead stage';
  if (from === to) return null;
  return LEAD_TRANSITIONS[from].includes(to) ? null : `Lead cannot move from ${from} to ${to}`;
}

export function activityStageTransition(currentStage, activityType) {
  return currentStage === 'New' && activityType === 'Call' ? 'Contacted' : null;
}


// Adds working minutes using a weekly calendar expressed in the calendar's UTC offset.
// This keeps API and SLA-worker calculations deterministic without relying on host timezone.
export function addBusinessMinutes(start, minutes, calendar = {}) {
  const amount = Number(minutes);
  if (!(start instanceof Date) || Number.isNaN(start.valueOf()) || !Number.isFinite(amount) || amount < 0)
    return null;
  const workDays = new Set(calendar.workDays || [1,2,3,4,5]);
  const startMinute = Number(calendar.startMinute ?? 9 * 60);
  const endMinute = Number(calendar.endMinute ?? 18 * 60);
  const offsetMinutes = Number(calendar.utcOffsetMinutes ?? 240);
  if (startMinute < 0 || endMinute > 1440 || startMinute >= endMinute || !workDays.size) return null;
  let remaining = amount;
  let cursor = new Date(start.getTime() + offsetMinutes * 60000);
  cursor.setUTCSeconds(0, 0);
  for (let guard = 0; guard < 3700; guard++) {
    const day = cursor.getUTCDay();
    const minute = cursor.getUTCHours() * 60 + cursor.getUTCMinutes();
    if (!workDays.has(day) || minute >= endMinute) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (minute < startMinute) cursor.setUTCHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);
    const available = endMinute - (cursor.getUTCHours() * 60 + cursor.getUTCMinutes());
    if (remaining <= available) {
      cursor.setUTCMinutes(cursor.getUTCMinutes() + remaining);
      return new Date(cursor.getTime() - offsetMinutes * 60000);
    }
    remaining -= available;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(0, 0, 0, 0);
  }
  return null;
}

export const QUALIFICATION_GUIDANCE = Object.freeze({
  Unassessed: {
    responseMinutes: 240,
    cadence: 'Complete the approved qualification questions during the first substantive conversation',
    strategy: 'Use the normal lead-response SLA and complete an assessment before relying on qualification priority.'
  },
  Hot: {
    responseMinutes: 15,
    cadence: 'Same-day contact and daily follow-up while the requirement is active',
    strategy: 'Call first, confirm budget and decision timeline, then send a short WhatsApp recap with the next action.'
  },
  Warm: {
    responseMinutes: 240,
    cadence: 'Follow up every 2-3 working days with relevant options or a useful market update',
    strategy: 'Clarify motivation, preferred areas, budget and blockers before proposing a focused shortlist.'
  },
  Cold: {
    responseMinutes: 1440,
    cadence: 'Weekly nurture unless the customer requests a different schedule',
    strategy: 'Keep communication concise, permission-based and useful; watch for a change in timing or intent.'
  }
});

export function qualificationFollowUpPlan({temperature,assessedAt=new Date(),policy}={}) {
  const now=assessedAt instanceof Date?assessedAt:new Date(assessedAt);
  if(Number.isNaN(now.valueOf())||!policy)return null;
  const calendar={workDays:policy.workDays,startMinute:policy.workStartMinute,endMinute:policy.workEndMinute,utcOffsetMinutes:policy.utcOffsetMinutes};
  const businessDayMinutes=Number(policy.workEndMinute)-Number(policy.workStartMinute);
  if(!Number.isFinite(businessDayMinutes)||businessDayMinutes<=0)return null;
  if(temperature==='Hot'){
    const minutes=Number(policy.qualificationHotElapsedMinutes);
    if(!Number.isInteger(minutes)||minutes<1)return null;
    return {temperature,dueAt:new Date(now.getTime()+minutes*60000),timerBasis:'elapsed_minutes',targetMinutes:minutes,priority:'urgent',cadenceBusinessDays:null};
  }
  if(temperature==='Warm'){
    const minutes=Number(policy.qualificationWarmBusinessMinutes);
    if(!Number.isInteger(minutes)||minutes<1)return null;
    return {temperature,dueAt:addBusinessMinutes(now,minutes,calendar),timerBasis:'business_minutes',targetMinutes:minutes,priority:'high',cadenceBusinessDays:null};
  }
  if(temperature==='Cold'){
    const days=Number(policy.qualificationColdBusinessDays),cadenceBusinessDays=Number(policy.qualificationColdNurtureBusinessDays);
    if(!Number.isInteger(days)||days<1||!Number.isInteger(cadenceBusinessDays)||cadenceBusinessDays<1)return null;
    return {temperature,dueAt:addBusinessMinutes(now,days*businessDayMinutes,calendar),timerBasis:'business_days',targetMinutes:days*businessDayMinutes,priority:'normal',cadenceBusinessDays};
  }
  return null;
}

export function parseBusinessAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const text=String(value).trim().replace(/,/g,'').replace(/^AED\s*/i,'').replace(/\s*AED$/i,'').trim();
  const match=text.match(/^(\d+(?:\.\d+)?)\s*(K|M|B|THOUSAND|MILLION|BILLION)?$/i);
  if(!match)return NaN;
  const multiplier={K:1e3,THOUSAND:1e3,M:1e6,MILLION:1e6,B:1e9,BILLION:1e9}[String(match[2]||'').toUpperCase()]||1;
  const amount=Number(match[1])*multiplier;
  return Number.isFinite(amount)?amount:NaN;
}

export function validateBudget(minimum, maximum) {
  const min = parseBusinessAmount(minimum);
  const max = parseBusinessAmount(maximum);
  if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0)))
    return { error: 'Budget range is invalid' };
  if (min !== null && max !== null && max < min) return { error: 'Budget range is invalid' };
  return { min, max };
}

export function validateLeadStage(stage, lostReason) {
  if (!STAGES.includes(stage)) return 'Invalid stage';
  if (stage === 'Lost' && !String(lostReason || '').trim()) return 'lostReason is required when a lead is Lost';
  return null;
}

export function normalizePhone(value) {
  if (!value) return null;
  const text = String(value).trim();
  const normalized = (text.startsWith('+') ? '+' : '') + text.replace(/\D/g, '');
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

export function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value).trim());
}

export function validateContactIdentity(email, phone) {
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;
  const cleanPhone = normalizePhone(phone);
  if (cleanEmail && !isValidEmail(cleanEmail)) return { error: 'Email format is invalid' };
  if (phone && !cleanPhone) return { error: 'Phone must use international format, for example +971501234567' };
  if (!cleanEmail && !cleanPhone) return { error: 'A valid email or international phone number is required' };
  return {
    email: cleanEmail,
    phone: cleanPhone,
    emailStatus: cleanEmail ? 'format_valid' : 'unverified',
    phoneStatus: cleanPhone ? 'format_valid' : 'unverified'
  };
}

export function calculateMortgage({ propertyPrice, downPaymentPercent, loanAmount, annualRatePercent, years, additionalCosts = 0, monthlyIncome, monthlyDebt = 0, prudentDbrPercent=47, regulatoryDbrPercent=50 }) {
  const price = Number(propertyPrice), requestedLoan=loanAmount===undefined||loanAmount===null||loanAmount===''?null:Number(loanAmount),
    down = requestedLoan===null?Number(downPaymentPercent):((price-requestedLoan)/price)*100, rate = Number(annualRatePercent), term = Number(years), costs = Number(additionalCosts || 0);
  if (!Number.isFinite(price) || price <= 0) return { error: 'Property price must be positive' };
  if (!Number.isFinite(down) || down < 0 || down > 100) return { error: 'Down payment must be between 0 and 100' };
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { error: 'Annual rate must be between 0 and 100' };
  if (!Number.isFinite(term) || term <= 0 || term > 50) return { error: 'Mortgage term must be between 1 and 50 years' };
  if (!Number.isFinite(costs) || costs < 0) return { error: 'Additional costs cannot be negative' };
  const downPayment = price * down / 100;
  const principal = requestedLoan===null?price-downPayment:requestedLoan;
  if (!Number.isFinite(principal) || principal < 0 || principal > price) return { error:'Loan amount must be between zero and property price' };
  const months = Math.round(term * 12);
  const monthlyRate = rate / 100 / 12;
  const monthlyPayment = monthlyRate === 0 ? principal / months
    : principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
  const totalRepayment = monthlyPayment * months;
  const income=monthlyIncome===undefined||monthlyIncome===null||monthlyIncome===''?null:Number(monthlyIncome),debt=Number(monthlyDebt||0);
  if((income!==null&&(!Number.isFinite(income)||income<=0))||!Number.isFinite(debt)||debt<0)return {error:'Income and debt inputs are invalid'};
  const debtBurdenRatio=income===null?null:Math.round((monthlyPayment+debt)/income*10000)/100;
  const prudent=Number(prudentDbrPercent),regulatory=Number(regulatoryDbrPercent);
  if(!Number.isFinite(prudent)||!Number.isFinite(regulatory)||prudent<=0||regulatory<=prudent||regulatory>100)return {error:'DBR thresholds are invalid'};
  const affordabilityAt=percent=>{
    if(income===null)return null;
    const maximumTotalMonthlyDebt=Math.round(income*percent)/100,
      maximumMortgagePayment=Math.max(0,Math.round((maximumTotalMonthlyDebt-debt)*100)/100),
      maximumLoanPrincipal=monthlyRate===0?maximumMortgagePayment*months:
        maximumMortgagePayment*(1-Math.pow(1+monthlyRate,-months))/monthlyRate,
      equivalentPropertyPrice=down>=100?null:maximumLoanPrincipal/(1-down/100),
      requiredExistingDebtReduction=Math.max(0,Math.round((monthlyPayment+debt-maximumTotalMonthlyDebt)*100)/100);
    return {
      percent,maximumTotalMonthlyDebt,maximumMortgagePayment,
      maximumLoanPrincipal:Math.round(maximumLoanPrincipal*100)/100,
      equivalentPropertyPrice:equivalentPropertyPrice===null?null:Math.round(equivalentPropertyPrice*100)/100,
      maximumExistingMonthlyDebt:Math.max(0,Math.round((maximumTotalMonthlyDebt-monthlyPayment)*100)/100),
      requiredExistingDebtReduction,
      debtReductionAloneSufficient:requiredExistingDebtReduction<=debt
    };
  };
  const prudentAffordability=affordabilityAt(prudent),regulatoryAffordability=affordabilityAt(regulatory);
  const maximumExistingDebtAtPrudent=prudentAffordability?.maximumExistingMonthlyDebt??null;
  const existingDebtReductionToPrudent=prudentAffordability?.requiredExistingDebtReduction??null;
  const dbrBand=debtBurdenRatio===null?null:debtBurdenRatio<=prudent?'prudent':debtBurdenRatio<=regulatory?'limited_buffer':'above_regulatory_ceiling';
  return {
    propertyPrice: price,
    downPayment,
    principal,
    monthlyPayment,
    totalInterest: totalRepayment - principal,
    totalRepayment,
    upfrontCash: downPayment + costs,
    months,loanToValue:Math.round(principal/price*10000)/100,
    debtBurdenRatio,dbrBand,prudentDbrPercent:prudent,regulatoryDbrPercent:regulatory,
    maximumExistingDebtAtPrudent,existingDebtReductionToPrudent,prudentAffordability,regulatoryAffordability,
    monthlyIncome:income,monthlyDebt:debt,additionalCosts:costs
  };
}

export function calculateRoi(price, annualRent, annualCosts = 0) {
  const p = Number(price), rent = Number(annualRent), costs = Number(annualCosts || 0);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(rent) || rent < 0 || !Number.isFinite(costs) || costs < 0)
    return null;
  return Math.round(((rent - costs) / p) * 10000) / 100;
}

const SENSITIVE_FACTOR_PATTERN=/\b(age|gender|sex|religion|religious|ethnic|ethnicity|nationality|health|disability|social\s+media|race|racial|marital|politic|political|politics)\b/i;
export function validateQualificationFactors(factors){
  if(!Array.isArray(factors)||!factors.length)return 'At least one qualification factor is required';
  const codes=new Set();
  for(const f of factors){
    if(!f||!String(f.code||'').match(/^[a-z][a-z0-9_]{1,39}$/))return 'Every factor needs a stable lowercase code';
    if(codes.has(f.code))return `Duplicate factor code: ${f.code}`;codes.add(f.code);
    const factorText=`${f.code} ${f.label||''} ${f.question||''} ${f.inputSource||''}`.replace(/[_-]+/g,' '),sensitiveMatch=factorText.match(SENSITIVE_FACTOR_PATTERN);
    if(sensitiveMatch)return `Qualification factor "${f.label||f.code}" cannot use the personal or social attribute "${sensitiveMatch[0]}"`;
    if(!Number.isFinite(Number(f.min))||!Number.isFinite(Number(f.max))||Number(f.max)<=Number(f.min)||!Number.isFinite(Number(f.weight))||Number(f.weight)<=0)
      return `Invalid range or weight for ${f.code}`;
    if(!['reject','zero','exclude'].includes(f.missingTreatment||'reject'))return `Invalid missing-input treatment for ${f.code}`;
    const answerType=f.answerType||'scale';if(!['scale','yes_no','single_select'].includes(answerType))return `Invalid answer type for ${f.code}`;
    if(answerType==='yes_no'&&(Number(f.min)!==0||Number(f.max)!==1))return `Yes/No factor ${f.code} must use a 0 to 1 range`;
    if(answerType==='single_select'){
      if(!Array.isArray(f.answerOptions)||f.answerOptions.length<2)return `Select-list factor ${f.code} needs at least two answer options`;
      for(const option of f.answerOptions)if(!String(option?.label||'').trim()||!Number.isFinite(Number(option?.value))||Number(option.value)<Number(f.min)||Number(option.value)>Number(f.max))return `Invalid answer option for ${f.code}`;
    }
  }
  return null;
}

export function calculateQualification(model,inputs={}){
  const factors=model?.factors,invalid=validateQualificationFactors(factors);if(invalid)return {error:invalid};
  const contributions=[];let weighted=0,totalWeight=0;
  for(const f of factors){
    const raw=inputs[f.code],missing=raw===undefined||raw===null||raw==='';
    if(missing&&(f.required||f.missingTreatment==='reject'))return {error:`Missing required factor: ${f.code}`};
    if(missing&&f.missingTreatment==='exclude'){contributions.push({code:f.code,label:f.label,value:null,weight:Number(f.weight),contribution:0,missing:true,excluded:true});continue;}
    const value=missing?Number(f.min):Number(raw);if(!Number.isFinite(value))return {error:`Invalid factor value: ${f.code}`};
    const normalized=Math.max(0,Math.min(100,((value-Number(f.min))/(Number(f.max)-Number(f.min)))*100));
    const contribution=normalized*Number(f.weight);weighted+=contribution;totalWeight+=Number(f.weight);
    contributions.push({code:f.code,label:f.label,value:missing?null:value,weight:Number(f.weight),normalized,contribution,missing});
  }
  const score=totalWeight?Math.round(weighted/totalWeight*100)/100:0;
  const hotMin=Number(model.thresholds?.hotMin??75),warmMin=Number(model.thresholds?.warmMin??45);
  const temperature=score>=hotMin?'Hot':score>=warmMin?'Warm':'Cold';
  return {score,temperature,contributions,recommendation:model.guidance?.[temperature]||null};
}

export function applyQualificationOverride(calculated,temperature,reason,authorized){
  if(!temperature||temperature===calculated?.temperature)return {finalTemperature:calculated?.temperature,overrideReason:null};
  if(!authorized)return {error:'Qualification override is not authorized'};
  if(!['Hot','Warm','Cold'].includes(temperature)||!String(reason||'').trim())return {error:'Qualification override requires a valid result and reason'};
  return {finalTemperature:temperature,overrideReason:String(reason).trim()};
}

export function calculateInvestmentReturns({price,annualRent,annualCosts=0,vacancyPercent=0,cashInvested}){
  const p=Number(price),rent=Number(annualRent),costs=Number(annualCosts),vacancy=Number(vacancyPercent),cash=Number(cashInvested??price);
  if(!Number.isFinite(p)||p<=0||!Number.isFinite(rent)||rent<0||!Number.isFinite(costs)||costs<0||!Number.isFinite(vacancy)||vacancy<0||vacancy>100||!Number.isFinite(cash)||cash<=0)
    return {error:'Investment inputs are invalid'};
  const effectiveRent=rent*(1-vacancy/100),netIncome=effectiveRent-costs;
  return {price:p,annualRent:rent,annualCosts:costs,vacancyPercent:vacancy,effectiveRent,netIncome,
    grossYield:Math.round(rent/p*10000)/100,netYield:Math.round(netIncome/p*10000)/100,cashOnCashReturn:Math.round(netIncome/cash*10000)/100,cashInvested:cash};
}

export function isReassignmentDue(lead, now = new Date()) {
  return Boolean(lead && lead.assignedTo && lead.assignmentDueAt && !['Won','Lost'].includes(lead.stage) && new Date(lead.assignmentDueAt) <= now);
}
