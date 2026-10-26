import {agentWorkLeadScopeSql} from './crm-policy.js';

// Dashboard scope is narrower than general record visibility: Managers see
// managed teams only, including when they own a record outside those teams.
export function dashboardTeamScopeSql(teamExpression,broker,params=[]){
  if(broker.jobRole!=='manager')return {clause:'1=1',params};
  params.push(broker.id);const id=`$${params.length}`;
  return {clause:`EXISTS (SELECT 1 FROM teams dashboard_team WHERE dashboard_team.id=${teamExpression} AND dashboard_team.active=1 AND (dashboard_team.manager_id=${id} OR EXISTS (SELECT 1 FROM team_memberships dashboard_tm WHERE dashboard_tm.team_id=dashboard_team.id AND dashboard_tm.broker_id=${id} AND dashboard_tm.membership_role='manager' AND dashboard_tm.ends_at IS NULL) OR EXISTS (SELECT 1 FROM user_role_assignments dashboard_role WHERE dashboard_role.team_id=dashboard_team.id AND dashboard_role.broker_id=${id} AND dashboard_role.job_role='manager' AND dashboard_role.status='active' AND dashboard_role.ends_at IS NULL)))`,params};
}
export function dashboardLeadScopeSql(alias,broker,params=[]){
  return broker.jobRole==='manager'?dashboardTeamScopeSql(`${alias}.assigned_team_id`,broker,params):agentWorkLeadScopeSql(alias,broker,params);
}
