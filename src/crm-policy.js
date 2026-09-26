import {isGovernedNonBusinessRole,JOB_ROLE} from './role-access.js';

export const CRM_JOB_ROLES = Object.values(JOB_ROLE);

// Staff identity and operational CRM authority are deliberately separate.
// Admin is an active NYSA staff identity, but its governed profile permits only
// the maintenance, leave and personal-task endpoints listed in role-access.js.
// The central requireAuth capability gate applies that endpoint allow-list
// before a request reaches the CRM router.
export function hasNysaStaffIdentity(broker) {
  if (!broker || !CRM_JOB_ROLES.includes(broker.jobRole) || broker.jobRole === 'admin_assistant') return false;
  if (broker.role === 'admin') return broker.jobRole === JOB_ROLE.ADMINISTRATOR;
  return broker.role === 'internal_broker' && broker.jobRole !== JOB_ROLE.ADMINISTRATOR;
}

export function hasInternalCrmIdentity(broker) {
  return Boolean(hasNysaStaffIdentity(broker) && broker.role === 'internal_broker' &&
    broker.jobRole !== JOB_ROLE.ADMINISTRATOR);
}

const hasBusinessIdentity=broker=>hasInternalCrmIdentity(broker)&&!isGovernedNonBusinessRole(broker);

export function isCompanyReader(broker) {
  return Boolean(broker && broker.jobRole === 'director');
}

export function isManager(broker) {
  return Boolean(broker && broker.jobRole === 'manager');
}

export function isProposalApprover(broker) {
  return Boolean(hasInternalCrmIdentity(broker) && ['manager','director'].includes(broker.jobRole));
}

export function canApproveProposal(broker, lead) {
  if (!isProposalApprover(broker)) return false;
  if (isCompanyReader(broker)) return true;
  const managedTeams=broker.managedTeamIds?.length?broker.managedTeamIds:[broker.teamId].filter(Boolean);
  return broker.jobRole === 'manager' && managedTeams.includes(lead?.assignedTeamId);
}

export function isCrmReadOnly(broker) {
  return Boolean(broker && ['director','accountant'].includes(broker.jobRole));
}

export function canReadLead(broker, lead) {
  if (!hasBusinessIdentity(broker) || broker.jobRole===JOB_ROLE.ACCOUNTANT) return false;
  return true;
}

export function canWriteLead(broker, lead) {
  if (!hasInternalCrmIdentity(broker) || isCrmReadOnly(broker)) return false;
  if (lead.assignedTo === broker.id) return true;
  const managedTeams=broker.managedTeamIds?.length?broker.managedTeamIds:[broker.teamId].filter(Boolean);
  return broker.jobRole === 'manager' && managedTeams.includes(lead.assignedTeamId);
}

// Operational actions belong to the broker directly assigned to the Lead.
// Team-level Manager authority remains available through canWriteLead for
// governed review, approval, assignment and reassignment workflows.
export function canOperateLead(broker, lead) {
  if (!hasInternalCrmIdentity(broker) || isCrmReadOnly(broker)) return false;
  return Boolean(lead?.assignedTo && String(lead.assignedTo) === String(broker.id));
}

export function canReadOpportunity(broker, opportunity) {
  if (!hasBusinessIdentity(broker) || broker.jobRole===JOB_ROLE.ACCOUNTANT) return false;
  if (isCompanyReader(broker)) return true;
  if (broker.jobRole === 'listing_agent') return Boolean(opportunity?.participantIds?.includes(broker.id));
  if (opportunity?.ownerId === broker.id || opportunity?.createdBy === broker.id) return true;
  const managedTeams=broker.managedTeamIds?.length?broker.managedTeamIds:[broker.teamId].filter(Boolean);
  return broker.jobRole === 'manager' && managedTeams.includes(opportunity?.assignedTeamId);
}

export function canWriteOpportunity(broker, opportunity) {
  return canReadOpportunity(broker,opportunity) && !isCrmReadOnly(broker) && broker.jobRole !== 'listing_agent';
}

export function canApproveDeal(broker,opportunity,deal) {
  if (!hasInternalCrmIdentity(broker)) return false;
  if (broker.jobRole === 'director') return true;
  if (broker.jobRole !== 'manager') return false;
  const managedTeams=broker.managedTeamIds?.length?broker.managedTeamIds:[broker.teamId].filter(Boolean);
  return managedTeams.includes(opportunity?.assignedTeamId);
}

// The standard historical commercial-review item is an operational management review.
// Preserve its frozen template identity; record the actual authorized reviewer in the audit trail.
export function canCompleteDealChecklistItem(broker,opportunity,deal,item) {
  if (!hasInternalCrmIdentity(broker)) return false;
  if (!canWriteOpportunity(broker,opportunity) && broker.jobRole!=='director') return false;
  if (item.responsibleRole==='director' && item.itemCode==='DIRECTOR_REVIEW' &&
      ['commercial_sale','commercial_rental'].includes(deal?.dealType) && broker.jobRole==='manager')
    return canApproveDeal(broker,opportunity,deal);
  return item.responsibleRole==='sales_agent'?['sales_agent','manager'].includes(broker.jobRole):item.responsibleRole===broker.jobRole;
}

export function canCreateOpportunity(broker, lead) {
  return Boolean(canOperateLead(broker,lead) && ['sales_agent','manager'].includes(broker.jobRole));
}

export function canAssignLead(broker, lead) {
  if (broker?.jobRole==='director'&&hasInternalCrmIdentity(broker))return true;
  if (!canWriteLead(broker, lead)) return false;
  const managedTeams=broker.managedTeamIds?.length?broker.managedTeamIds:[broker.teamId].filter(Boolean);
  return broker.jobRole === 'manager' && managedTeams.includes(lead.assignedTeamId);
}

function bind(params, value) {
  params.push(value);
  return `$${params.length}`;
}

export function leadScopeSql(alias, broker, params = []) {
  if (!hasBusinessIdentity(broker) || broker.jobRole===JOB_ROLE.ACCOUNTANT) return { clause:'1=0', params };
  return { clause:'1=1', params };
}

export function agentWorkLeadScopeSql(alias,broker,params=[]){
  if(hasInternalCrmIdentity(broker)&&['sales_agent','listing_agent'].includes(broker.jobRole)){
    const id=bind(params,broker.id);
    return {clause:`${alias}.assigned_to=${id}`,params};
  }
  if(hasInternalCrmIdentity(broker)&&broker.jobRole==='manager'){
    const id=bind(params,broker.id);
    return {clause:`(${alias}.assigned_to=${id} OR EXISTS (
      SELECT 1 FROM team_memberships tm WHERE tm.broker_id=${id} AND tm.team_id=${alias}.assigned_team_id
        AND tm.membership_role='manager' AND tm.ends_at IS NULL))`,params};
  }
  return leadScopeSql(alias,broker,params);
}

export function opportunityScopeSql(alias, broker, params = []) {
  if (isCompanyReader(broker)) return {clause:'1=1',params};
  if (!hasBusinessIdentity(broker) || broker.jobRole===JOB_ROLE.ACCOUNTANT) return {clause:'1=0',params};
  const id=bind(params,broker.id);
  if (broker.jobRole === 'listing_agent') return {clause:`EXISTS (SELECT 1 FROM opportunity_participants op WHERE op.opportunity_id=${alias}.id AND op.broker_id=${id} AND op.active)`,params};
  if (broker.jobRole === 'manager') return {clause:`(${alias}.owner_id=${id} OR ${alias}.created_by=${id} OR EXISTS (
    SELECT 1 FROM team_memberships tm WHERE tm.broker_id=${id} AND tm.team_id=${alias}.assigned_team_id
      AND tm.membership_role='manager' AND tm.ends_at IS NULL))`,params};
  return {clause:`(${alias}.owner_id=${id} OR ${alias}.created_by=${id})`,params};
}

export function proposalApprovalScopeSql(alias, broker, params = []) {
  if (isProposalApprover(broker) && isCompanyReader(broker)) return { clause:'1=1', params };
  if (!isProposalApprover(broker) || broker.jobRole !== 'manager') return { clause:'1=0', params };
  const id=bind(params,broker.id);
  return { clause:`EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.broker_id=${id} AND tm.team_id=${alias}.assigned_team_id
    AND tm.membership_role='manager' AND tm.ends_at IS NULL)`, params };
}

export function teamScopeSql(alias,broker,params=[]){
  if(isCompanyReader(broker))return {clause:'1=1',params};
  if(!hasBusinessIdentity(broker)||broker.jobRole===JOB_ROLE.ACCOUNTANT)return {clause:'1=0',params};
  if(broker.jobRole==='manager'){
    const id=bind(params,broker.id);
    return {clause:`EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.team_id=${alias}.id AND tm.broker_id=${id} AND tm.membership_role='manager' AND tm.ends_at IS NULL)`,params};
  }
  if(broker.teamId){const teamId=bind(params,broker.teamId);return {clause:`${alias}.id=${teamId}`,params};}
  return {clause:'1=0',params};
}

export function contactScopeSql(alias, broker, params = []) {
  if (!hasBusinessIdentity(broker) || broker.jobRole===JOB_ROLE.ACCOUNTANT) return { clause:'1=0', params };
  return { clause:'1=1', params };
}

export function companyScopeSql(alias, broker, params = []) {
  if (isCompanyReader(broker)) return { clause:'1=1', params };
  if (!hasBusinessIdentity(broker) || broker.jobRole===JOB_ROLE.ACCOUNTANT) return { clause:'1=0', params };
  const id = bind(params, broker.id);
  if (broker.jobRole === 'manager') {
    return { clause:`(${alias}.owner_id=${id} OR EXISTS (
      SELECT 1 FROM contacts sc JOIN leads sl ON sl.contact_id=sc.id
      JOIN team_memberships tm ON tm.team_id=sl.assigned_team_id
      WHERE sc.company_id=${alias}.id AND tm.broker_id=${id} AND tm.membership_role='manager' AND tm.ends_at IS NULL))`, params };
  }
  return { clause:`(${alias}.owner_id=${id} OR EXISTS (
    SELECT 1 FROM contacts sc JOIN leads sl ON sl.contact_id=sc.id
    WHERE sc.company_id=${alias}.id AND (sl.assigned_to=${id} OR sl.created_by=${id})))`, params };
}
