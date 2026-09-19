import {opportunityScopeSql} from './crm-policy.js';

// This is a read projection, not a Lead stage transition. One scoped Lead is
// counted once, using its furthest accessible pursuit, including a terminal
// Closed Won/Closed Lost outcome ahead of any older open pursuit. Historical
// qualification/contact evidence is never overwritten by dashboard rendering.
export function pipelineJoin(broker,params){
  const scope=opportunityScopeSql('p',broker,params);
  return `LEFT JOIN LATERAL (
    SELECT p.id,p.stage,p.opportunity_reference,
      EXISTS(SELECT 1 FROM deals d WHERE d.opportunity_id=p.id AND d.status='closed_won') AS deal_won
    FROM opportunities p WHERE p.lead_id=l.id AND (${scope.clause})
    ORDER BY CASE p.stage WHEN 'Closed Won' THEN 10 WHEN 'Closed Lost' THEN 9 WHEN 'Deal' THEN 8 WHEN 'Booking' THEN 7
      WHEN 'Negotiation' THEN 6 WHEN 'Offer' THEN 5 WHEN 'Viewing' THEN 4
      WHEN 'Matching' THEN 3 WHEN 'Requirements' THEN 2 ELSE 1 END DESC,
      p.updated_at DESC,p.id LIMIT 1
  ) pipeline ON TRUE`;
}
export const pipelineStageSql=`CASE
  WHEN pipeline.stage='Deal' THEN 'Deal'
  WHEN pipeline.stage='Booking' THEN 'Booking'
  WHEN pipeline.stage='Negotiation' THEN 'Negotiation'
  WHEN pipeline.stage='Offer' THEN 'Offer'
  WHEN pipeline.stage='Viewing' THEN 'Viewing'
  WHEN pipeline.stage IN ('Requirements','Matching') THEN 'Qualified'
  WHEN pipeline.stage='Closed Won' AND pipeline.deal_won THEN 'Won'
  WHEN pipeline.stage='Closed Lost' THEN 'Lost'
  WHEN l.current_status='closed_won' THEN 'Won'
  WHEN l.stage='New' AND l.first_contact_at IS NOT NULL THEN 'Contacted'
  ELSE l.stage END`;
