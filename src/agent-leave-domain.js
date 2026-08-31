import crypto from 'node:crypto';

const date=value=>{const text=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw new Error('A valid ISO date is required');const parsed=new Date(`${text}T12:00:00Z`);if(Number.isNaN(parsed.valueOf()))throw new Error('A valid ISO date is required');return parsed;};
const dayKey=value=>value.toISOString().slice(0,10);
const round=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
export const leaveFingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(value,Object.keys(value).sort())).digest('hex');

export function calculateLeaveUnits({startDate,endDate,startPortion='full',endPortion='full',weekendDays=[0,6]}){
  const start=date(startDate),end=date(endDate);if(end<start)throw new Error('Leave end date cannot precede start date');
  if(!['full','half'].includes(startPortion)||!['full','half'].includes(endPortion))throw new Error('Leave portions must be full or half day');
  let units=0,workingDates=[];for(let cursor=new Date(start);cursor<=end;cursor.setUTCDate(cursor.getUTCDate()+1)){if(weekendDays.includes(cursor.getUTCDay()))continue;let value=1;if(dayKey(cursor)===startDate&&startPortion==='half')value-=0.5;if(dayKey(cursor)===endDate&&endPortion==='half')value-=0.5;if(startDate===endDate&&startPortion==='half'&&endPortion==='half')value=0.5;if(value>0){units+=value;workingDates.push({date:dayKey(cursor),units:value});}}
  if(!units)throw new Error('Leave must contain at least half a working day');return{units:round(units),workingDates};
}

export function validateEmploymentVersion(input={}){
  const errors=[],value={employmentStatus:String(input.employmentStatus||'active'),effectiveFrom:String(input.effectiveFrom||''),effectiveTo:input.effectiveTo||null,startDate:String(input.startDate||''),endDate:input.endDate||null,reportingManagerId:String(input.reportingManagerId||''),workPatternCode:String(input.workPatternCode||'mon_fri'),policyVersionId:String(input.policyVersionId||''),reason:String(input.reason||'').trim()};
  if(!['active','leave','ended'].includes(value.employmentStatus))errors.push('Employment status is invalid');
  for(const [key,label] of [['effectiveFrom','Effective-from date'],['startDate','Employment start date']])try{date(value[key]);}catch{errors.push(`${label} is required`);}
  if(value.effectiveTo&&value.effectiveTo<value.effectiveFrom)errors.push('Effective-to date cannot precede effective-from date');
  if(value.endDate&&value.endDate<value.startDate)errors.push('Employment end date cannot precede start date');
  if(!value.reportingManagerId)errors.push('Reporting Manager is required');if(!value.policyVersionId)errors.push('Leave policy is required');if(value.reason.length<10)errors.push('A meaningful change reason is required');
  return{valid:!errors.length,errors,value};
}

export function validateLeavePolicy(input={}){
  const errors=[],entitlements=Array.isArray(input.entitlements)?input.entitlements:[],value={policyCode:String(input.policyCode||'').trim().toLowerCase(),name:String(input.name||'').trim(),effectiveFrom:String(input.effectiveFrom||''),effectiveTo:input.effectiveTo||null,decisionDueWorkingDays:Number(input.decisionDueWorkingDays||2),reason:String(input.reason||'').trim(),entitlements:entitlements.map((row,index)=>({displayOrder:index+1,leaveTypeVersionId:String(row.leaveTypeVersionId||''),annualUnits:Number(row.annualUnits),carryForwardUnits:Number(row.carryForwardUnits||0),allowNegativeBalance:Boolean(row.allowNegativeBalance)}))};
  if(!/^[a-z0-9_]{3,40}$/.test(value.policyCode))errors.push('Policy code must be lowercase snake case');if(value.name.length<3)errors.push('Policy name is required');try{date(value.effectiveFrom);}catch{errors.push('Effective-from date is required');}
  if(!Number.isInteger(value.decisionDueWorkingDays)||value.decisionDueWorkingDays<1||value.decisionDueWorkingDays>10)errors.push('Decision due working days must be 1 to 10');if(value.reason.length<10)errors.push('A meaningful policy reason is required');if(!value.entitlements.length)errors.push('At least one entitlement is required');
  const seen=new Set();for(const row of value.entitlements){if(!row.leaveTypeVersionId)errors.push('Each entitlement requires a leave type');if(seen.has(row.leaveTypeVersionId))errors.push('Leave type entitlement is duplicated');seen.add(row.leaveTypeVersionId);if(!Number.isFinite(row.annualUnits)||row.annualUnits<0)errors.push('Annual units must be zero or greater');if(!Number.isFinite(row.carryForwardUnits)||row.carryForwardUnits<0)errors.push('Carry-forward units must be zero or greater');}
  return{valid:!errors.length,errors,value};
}

export function resolveLeaveApprover({applicantId,applicantJobRole,reportingManagerId,directorId}){
  const approverId=applicantJobRole==='manager'?directorId:reportingManagerId;if(!approverId)throw new Error(applicantJobRole==='manager'?'An active Director is required':'An active reporting Manager is required');if(String(approverId)===String(applicantId))throw new Error('Self-approval is prohibited');return{approverId,routingReason:applicantJobRole==='manager'?'manager_leave_to_director':'employment_reporting_manager'};
}

export function validateLeaveApplication({startDate,endDate,startPortion='full',endPortion='full',reason,availableUnits,allowNegativeBalance=false,employmentStartDate,employmentEndDate}){
  const calculation=calculateLeaveUnits({startDate,endDate,startPortion,endPortion});const errors=[];if(String(reason||'').trim().length<5)errors.push('A leave reason is required');if(startDate<employmentStartDate||employmentEndDate&&endDate>employmentEndDate)errors.push('Leave dates must fall within active employment');if(!allowNegativeBalance&&calculation.units>Number(availableUnits||0))errors.push('Available leave balance is insufficient');return{valid:!errors.length,errors,...calculation};
}

export function mayMaintainLeave(broker){return broker?.role==='admin';}
export function mayDecideLeave({broker,application}){return Boolean(broker&&application&&String(broker.id)===String(application.approverId)&&String(broker.id)!==String(application.applicantId)&&['manager','director'].includes(broker.jobRole));}
