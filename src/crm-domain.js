export const SOURCES = ['Website','WhatsApp','Current CRM','Referral','Social media','Walk-in','Phone','Property portal','Other'];
export const BUSINESS_TYPES = ['Sale','Rental','Off-plan','Commercial'];
export const STAGES = ['New','Contacted','Qualified','Viewing','Negotiation','Won','Lost'];
export const TEMPERATURES = ['Hot','Warm','Cold'];
export const CONTACT_TYPES = ['buyer','seller','landlord','tenant','developer','investor','other'];
export const CHANNELS = ['Phone','Email','WhatsApp','SMS'];
export const ACTIVITY_TYPES = ['Task','Note','Call','Email','WhatsApp','Meeting','Viewing'];
export const JOB_ROLES = ['admin','sales_agent','listing_agent','manager','director','accountant'];
export const COMPANY_TYPES = ['developer','agency','corporate_client','landlord_company','vendor','other'];

export const QUALIFICATION_GUIDANCE = Object.freeze({
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

export function validateBudget(minimum, maximum) {
  const min = minimum === undefined || minimum === null || minimum === '' ? null : Number(minimum);
  const max = maximum === undefined || maximum === null || maximum === '' ? null : Number(maximum);
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

export function calculateMortgage({ propertyPrice, downPaymentPercent, annualRatePercent, years, additionalCosts = 0 }) {
  const price = Number(propertyPrice), down = Number(downPaymentPercent), rate = Number(annualRatePercent), term = Number(years), costs = Number(additionalCosts || 0);
  if (!Number.isFinite(price) || price <= 0) return { error: 'Property price must be positive' };
  if (!Number.isFinite(down) || down < 0 || down > 100) return { error: 'Down payment must be between 0 and 100' };
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { error: 'Annual rate must be between 0 and 100' };
  if (!Number.isFinite(term) || term <= 0 || term > 50) return { error: 'Mortgage term must be between 1 and 50 years' };
  if (!Number.isFinite(costs) || costs < 0) return { error: 'Additional costs cannot be negative' };
  const downPayment = price * down / 100;
  const principal = price - downPayment;
  const months = Math.round(term * 12);
  const monthlyRate = rate / 100 / 12;
  const monthlyPayment = monthlyRate === 0 ? principal / months
    : principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
  const totalRepayment = monthlyPayment * months;
  return {
    propertyPrice: price,
    downPayment,
    principal,
    monthlyPayment,
    totalInterest: totalRepayment - principal,
    totalRepayment,
    upfrontCash: downPayment + costs,
    months
  };
}

export function calculateRoi(price, annualRent, annualCosts = 0) {
  const p = Number(price), rent = Number(annualRent), costs = Number(annualCosts || 0);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(rent) || rent < 0 || !Number.isFinite(costs) || costs < 0)
    return null;
  return Math.round(((rent - costs) / p) * 10000) / 100;
}

export function isReassignmentDue(lead, now = new Date()) {
  return Boolean(lead && lead.assignedTo && lead.assignmentDueAt && !['Won','Lost'].includes(lead.stage) && new Date(lead.assignmentDueAt) <= now);
}
