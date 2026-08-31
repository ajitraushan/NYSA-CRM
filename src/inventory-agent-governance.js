export const inventoryAgentEligibilitySql=alias=>`(${alias}.job_role IN ('listing_agent','sales_agent') OR EXISTS (
  SELECT 1 FROM user_role_assignments inventory_role
  WHERE inventory_role.broker_id=${alias}.id
    AND inventory_role.job_role IN ('listing_agent','sales_agent')
    AND inventory_role.status='active'
    AND inventory_role.ends_at IS NULL
))`;

export function inventoryAgentScopeSql(broker,alias,params){
  if(broker.role==='admin'||['admin_assistant','listing_agent'].includes(broker.jobRole))return'TRUE';
  params.push(broker.id);const ref=`$${params.length}`;
  if(broker.jobRole==='manager')return`(${alias}.team_id IN (SELECT t.id FROM teams t WHERE t.manager_id=${ref}) OR EXISTS (
    SELECT 1 FROM team_memberships tm WHERE tm.team_id=${alias}.team_id AND tm.broker_id=${ref} AND tm.membership_role='manager' AND tm.ends_at IS NULL
  ))`;
  return`${alias}.id=${ref}`;
}
