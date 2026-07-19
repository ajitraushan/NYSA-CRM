import { fundingPaymentCompatibility } from './inventory-domain.js';

const norm=value=>String(value??'').trim().toLowerCase();
const has=value=>value!==null&&value!==undefined&&value!==''&&(!Array.isArray(value)||value.length>0);
const bedroomNumber=value=>norm(value)==='studio'?0:Number.parseInt(value,10);

export function buildMatchEvidence(requirement,listing){
  const matched=[],failed=[],notAssessed=[];
  const compare=(criterion,expected,actual,pass)=>{(pass?matched:failed).push({criterion,expected,actual});};
  if(requirement.areas?.length)compare('Preferred area',requirement.areas.join(', '),listing.area,requirement.areas.some(x=>norm(x)===norm(listing.area)));else notAssessed.push('Preferred area not specified');
  if(requirement.propertyTypes?.length)compare('Property type',requirement.propertyTypes.join(', '),listing.propertyType,requirement.propertyTypes.some(x=>norm(x)===norm(listing.propertyType)));else notAssessed.push('Property type not specified');
  const price=Number(listing.price);if(requirement.budgetMin!==null&&requirement.budgetMin!==undefined)compare('Minimum budget',Number(requirement.budgetMin),price,price>=Number(requirement.budgetMin));
  if(requirement.budgetMax!==null&&requirement.budgetMax!==undefined)compare('Maximum budget',Number(requirement.budgetMax),price,price<=Number(requirement.budgetMax));
  const bedrooms=bedroomNumber(listing.bedrooms);if(requirement.bedroomsMin!==null&&requirement.bedroomsMin!==undefined)compare('Minimum bedrooms',Number(requirement.bedroomsMin),listing.bedrooms,Number.isFinite(bedrooms)&&bedrooms>=Number(requirement.bedroomsMin));
  if(requirement.bedroomsMax!==null&&requirement.bedroomsMax!==undefined)compare('Maximum bedrooms',Number(requirement.bedroomsMax),listing.bedrooms,Number.isFinite(bedrooms)&&bedrooms<=Number(requirement.bedroomsMax));
  compare('Inventory availability','Available',listing.status,listing.status==='Available');
  if(listing.availabilityConfirmedAt)matched.push({criterion:'Availability confirmation',expected:'Current recorded confirmation',actual:listing.availabilityConfirmedAt});else failed.push({criterion:'Availability confirmation',expected:'Current recorded confirmation',actual:'Not recorded'});
  const compatibility=fundingPaymentCompatibility(requirement.fundingMethod,listing.paymentPlanType);if(compatibility.code==='compatible')matched.push({criterion:'Funding / payment plan',expected:requirement.fundingMethod,actual:listing.paymentPlanType});else if(compatibility.code==='incompatible')failed.push({criterion:'Funding / payment plan',expected:requirement.fundingMethod,actual:listing.paymentPlanType});else notAssessed.push('Funding / payment plan compatibility not assessed');
  return{requirement:{businessLine:requirement.businessLine,purpose:requirement.purpose,areas:requirement.areas||[],propertyTypes:requirement.propertyTypes||[],budgetMin:requirement.budgetMin,budgetMax:requirement.budgetMax,fundingMethod:requirement.fundingMethod,bedroomsMin:requirement.bedroomsMin,bedroomsMax:requirement.bedroomsMax,timelineCode:requirement.timelineCode},property:{inventoryReference:listing.inventoryReference,project:listing.project,developer:listing.developer,area:listing.area,propertyType:listing.propertyType,bedrooms:listing.bedrooms,sizeSqft:listing.sizeSqft,price:listing.price,currency:listing.currency,status:listing.status,availabilityConfirmedAt:listing.availabilityConfirmedAt},matched,failed,notAssessed,eligibleForNarrative:failed.every(x=>!['Inventory availability'].includes(x.criterion))};
}

export function buildCompletenessContext(requirement,listings=[]){
  const requirementFields=['businessLine','purpose','propertyTypes','areas','budgetMin','budgetMax','fundingMethod','bedroomsMin','bedroomsMax','timelineCode'];
  const propertyFields=['inventoryReference','project','developer','area','propertyType','bedrooms','sizeSqft','price','currency','status','availabilityConfirmedAt'];
  return{requiredForReliableMatching:{requirement:['businessLine','purpose','budgetMax','fundingMethod','timelineCode'],property:['inventoryReference','project','area','propertyType','price','status','availabilityConfirmedAt']},requiredForBuyerProposal:{requirement:['businessLine','purpose','areas','propertyTypes','budgetMin','budgetMax','fundingMethod','timelineCode'],property:['inventoryReference','project','developer','area','propertyType','bedrooms','sizeSqft','price','currency','status','availabilityConfirmedAt']},requirement:requirement?Object.fromEntries(requirementFields.map(k=>[k,requirement[k]??null])):null,properties:listings.map(x=>Object.fromEntries(propertyFields.map(k=>[k,x[k]??null]))),deterministicMissing:{requirement:requirementFields.filter(k=>!has(requirement?.[k])),properties:listings.map(x=>({inventoryReference:x.inventoryReference||null,fields:propertyFields.filter(k=>!has(x[k]))}))}};
}

export function rankInventoryMatches(requirement,listings=[]){
  if(!requirement)return [];
  const normalizedAreas=(requirement.areas||[]).map(norm),normalizedTypes=(requirement.propertyTypes||[]).map(norm);
  const minBudget=requirement.budgetMin===null||requirement.budgetMin===undefined?null:Number(requirement.budgetMin),maxBudget=requirement.budgetMax===null||requirement.budgetMax===undefined?null:Number(requirement.budgetMax);
  const minBedrooms=requirement.bedroomsMin===null||requirement.bedroomsMin===undefined?null:Number(requirement.bedroomsMin),maxBedrooms=requirement.bedroomsMax===null||requirement.bedroomsMax===undefined?null:Number(requirement.bedroomsMax);
  return listings.filter(x=>x.status==='Available').map(listing=>{
    const criteria=[];
    const add=(code,label,weight,pass,expected,actual)=>criteria.push({code,label,weight,pass,expected,actual});
    if(normalizedAreas.length)add('area','Preferred area',25,normalizedAreas.includes(norm(listing.area)),requirement.areas.join(', '),listing.area);
    if(normalizedTypes.length)add('property_type','Property type',25,normalizedTypes.includes(norm(listing.propertyType)),requirement.propertyTypes.join(', '),listing.propertyType);
    if(minBudget!==null||maxBudget!==null){const price=Number(listing.price),pass=(minBudget===null||price>=minBudget)&&(maxBudget===null||price<=maxBudget);add('budget','Budget range',25,pass,[minBudget,maxBudget].filter(x=>x!==null).join(' – '),price);}
    if(minBedrooms!==null||maxBedrooms!==null){const bedrooms=bedroomNumber(listing.bedrooms),pass=Number.isFinite(bedrooms)&&(minBedrooms===null||bedrooms>=minBedrooms)&&(maxBedrooms===null||bedrooms<=maxBedrooms);add('bedrooms','Bedroom range',15,pass,[minBedrooms,maxBedrooms].filter(x=>x!==null).join(' – '),listing.bedrooms);}
    const compatibility=fundingPaymentCompatibility(requirement.fundingMethod,listing.paymentPlanType);if(compatibility.code!=='not_assessed')add('funding_payment_plan','Funding / payment plan',15,compatibility.compatible,requirement.fundingMethod,listing.paymentPlanType);
    add('availability_confirmation','Availability confirmation',10,Boolean(listing.availabilityConfirmedAt),'Recorded current confirmation',listing.availabilityConfirmedAt||'Not recorded');
    const total=criteria.reduce((sum,x)=>sum+x.weight,0),earned=criteria.filter(x=>x.pass).reduce((sum,x)=>sum+x.weight,0),score=total?Math.round(earned/total*100):0;
    return{listing,score,fit:score>=80?'Strong fit':score>=60?'Partial fit':'Outside key requirements',criteria,evidence:buildMatchEvidence(requirement,listing)};
  }).sort((a,b)=>b.score-a.score||Number(Boolean(b.listing.availabilityConfirmedAt))-Number(Boolean(a.listing.availabilityConfirmedAt))||Number(a.listing.price)-Number(b.listing.price));
}
