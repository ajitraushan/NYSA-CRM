export const CRM_JOB_ROLES = ['admin','admin_assistant','sales_agent','listing_agent','manager','director','accountant'];

export function hasInternalCrmIdentity(broker) {
  return Boolean(broker && ['admin','internal_broker'].includes(broker.role) && CRM_JOB_ROLES.includes(broker.jobRole));
}

export function isCompanyReader(broker) {
  return Boolean(broker && (broker.role === 'admin' || broker.jobRole === 'director'));
}

export function isManager(broker) {
  return Boolean(broker && (broker.role === 'admin' || broker.jobRole === 'manager'));
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
  if (!hasInternalCrmIdentity(broker) || broker.jobRole === 'accountant') return false;
  if (isCompanyReader(broker)) return true;
  if (lead.assignedTo === broker.id || lead.createdBy === broker.id) return true;
  const managedTeams=broker.managedTeamIds?.length?broker.managedTeamIds:[broker.teamId].filter(Boolean);
  return broker.jobRole === 'manager' && managedTeams.includes(lead.assignedTeamId);
}

export function canWriteLead(broker, lead) {
  return canReadLead(broker, lead) && !isCrmReadOnly(broker);
}

export function canReadOpportunity(broker, opportunity) {
  if (!hasInternalCrmIdentity(broker) || broker.jobRole === 'accountant') return false;
  if (isCompanyReader(broker)) return true;
  if (broker.jobRole === 'listing_agent') return Boolean(opportunity?.participantIds?.includes(broker.id));
  if (opportunity?.ownerId === broker.id || opportunity?.createdBy === broker.id) return true;
  const managedTeams=broker.managedTeamIds?.length?broker.managedTeamIds:[broker.teamId].filter(Boolean);
  return broker.jobRole === 'manager' && managedTeams.includes(opportunity?.assignedTeamId);
}

export function canWriteOpportunity(broker, opportunity) {
  return canReadOpportunity(broker,opportunity) && !isCrmReadOnly(broker) && broker.jobRole !== 'listing_agent';
}

export function canCreateOpportunity(broker, lead) {
  return Boolean(canWriteLead(broker,lead) && ['admin','sales_agent','manager'].includes(broker.jobRole));
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
  if (isCompanyReader(broker)) return { clause:'1=1', params };
  if (!hasInternalCrmIdentity(broker) || broker.jobRole === 'accountant') return { clause:'1=0', params };
  const id = bind(params, broker.id);
  if (broker.jobRole === 'manager') {
    return { clause:`(${alias}.assigned_to=${id} OR ${alias}.created_by=${id} OR EXISTS (
      SELECT 1 FROM team_memberships tm WHERE tm.broker_id=${id} AND tm.team_id=${alias}.assigned_team_id
        AND tm.membership_role='manager' AND tm.ends_at IS NULL))`, params };
  }
  return { clause:`(${alias}.assigned_to=${id} OR ${alias}.created_by=${id})`, params };
}

export function opportunityScopeSql(alias, broker, params = []) {
  if (isCompanyReader(broker)) return {clause:'1=1',params};
  if (!hasInternalCrmIdentity(broker) || broker.jobRole === 'accountant') return {clause:'1=0',params};
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
  if(!hasInternalCrmIdentity(broker)||broker.jobRole==='accountant')return {clause:'1=0',params};
  if(broker.jobRole==='manager'){
    const id=bind(params,broker.id);
    return {clause:`EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.team_id=${alias}.id AND tm.broker_id=${id} AND tm.membership_role='manager' AND tm.ends_at IS NULL)`,params};
  }
  if(broker.teamId){const teamId=bind(params,broker.teamId);return {clause:`${alias}.id=${teamId}`,params};}
  return {clause:'1=0',params};
}

export function contactScopeSql(alias, broker, params = []) {
  if (isCompanyReader(broker)) return { clause:'1=1', params };
  if (!hasInternalCrmIdentity(broker) || broker.jobRole === 'accountant') return { clause:'1=0', params };
  const id = bind(params, broker.id);
  if (broker.jobRole === 'manager') {
    return { clause:`(${alias}.owner_id=${id} OR EXISTS (
      SELECT 1 FROM team_memberships member
      JOIN team_memberships reviewer ON reviewer.team_id=member.team_id
      WHERE member.broker_id=${alias}.owner_id AND member.ends_at IS NULL
        AND reviewer.broker_id=${id} AND reviewer.membership_role='manager' AND reviewer.ends_at IS NULL
    ) OR EXISTS (
      SELECT 1 FROM leads sl JOIN team_memberships tm ON tm.team_id=sl.assigned_team_id
      WHERE sl.contact_id=${alias}.id AND tm.broker_id=${id} AND tm.membership_role='manager' AND tm.ends_at IS NULL))`, params };
  }
  return { clause:`(${alias}.owner_id=${id} OR EXISTS (
    SELECT 1 FROM leads sl WHERE sl.contact_id=${alias}.id AND (sl.assigned_to=${id} OR sl.created_by=${id})))`, params };
}

export function companyScopeSql(alias, broker, params = []) {
  if (isCompanyReader(broker)) return { clause:'1=1', params };
  if (!hasInternalCrmIdentity(broker) || broker.jobRole === 'accountant') return { clause:'1=0', params };
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
