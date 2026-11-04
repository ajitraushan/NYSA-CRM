export const triggerDriftChecks=[
  ['invalid_lead_stage_history',`
    SELECT COUNT(*)::int AS count FROM lead_stage_history
     WHERE from_stage IS NOT NULL AND from_stage<>to_stage AND NOT (
       (from_stage='New' AND to_stage IN ('Contacted','Lost')) OR
       (from_stage='Contacted' AND to_stage IN ('Qualified','Lost')) OR
       (from_stage='Qualified' AND to_stage IN ('Viewing','Negotiation','Lost')) OR
       (from_stage='Viewing' AND to_stage IN ('Qualified','Negotiation','Lost')) OR
       (from_stage='Negotiation' AND to_stage IN ('Viewing','Won','Lost')) OR
       (from_stage='Lost' AND to_stage='New')
     )
  `],
  ['terminal_leads_with_open_followups',`
    SELECT COUNT(*)::int AS count FROM tasks t JOIN leads l ON l.id=t.lead_id
     WHERE (l.stage IN ('Won','Lost') OR l.current_status IN ('closed_won','closed_lost'))
       AND t.task_type IN ('general','qualification_follow_up','customer_response_follow_up')
       AND t.status IN ('open','in_progress')
  `],
  ['terminal_leads_with_stale_next_followup',`
    SELECT COUNT(*)::int AS count FROM leads l
     WHERE (l.stage IN ('Won','Lost') OR l.current_status IN ('closed_won','closed_lost'))
       AND l.next_follow_up_at IS DISTINCT FROM (
         SELECT MIN(t.due_at) FROM tasks t WHERE t.lead_id=l.id AND t.status IN ('open','in_progress')
       )
  `],
  ['booking_initial_term_over_seven_days',`
    SELECT COUNT(*)::int AS count FROM bookings
     WHERE expires_at>reservation_starts_at+INTERVAL '7 days'
       AND NOT EXISTS(SELECT 1 FROM booking_reservation_extensions e WHERE e.booking_id=bookings.id)
  `],
  ['booking_term_over_fourteen_days',`
    SELECT COUNT(*)::int AS count FROM bookings
     WHERE expires_at>reservation_starts_at+INTERVAL '14 days'
  `],
  ['booking_extension_without_exact_evidence',`
    SELECT COUNT(*)::int AS count FROM bookings b
     WHERE b.expires_at>b.reservation_starts_at+INTERVAL '7 days'
       AND NOT EXISTS(SELECT 1 FROM booking_reservation_extensions e
                       WHERE e.booking_id=b.id AND e.approved_expires_at=b.expires_at)
  `],
  ['offer_bilateral_acceptance_incomplete',`
    SELECT COUNT(*)::int AS count FROM offers o JOIN offer_revisions r ON r.id=o.accepted_revision_id
     WHERE r.requires_bilateral_acceptance AND
       (SELECT COUNT(DISTINCT n.accepting_side) FROM negotiation_events n
         WHERE n.offer_revision_id=r.id AND n.event_type='accepted' AND n.accepting_party_id IS NOT NULL
           AND NULLIF(BTRIM(n.acceptance_evidence),'') IS NOT NULL)<2
  `],
  ['booking_bilateral_acceptance_incomplete',`
    SELECT COUNT(*)::int AS count FROM bookings b JOIN offer_revisions r ON r.id=b.accepted_offer_revision_id
     WHERE r.requires_bilateral_acceptance AND
       (SELECT COUNT(DISTINCT n.accepting_side) FROM negotiation_events n
         WHERE n.offer_revision_id=r.id AND n.event_type='accepted' AND n.accepting_party_id IS NOT NULL
           AND NULLIF(BTRIM(n.acceptance_evidence),'') IS NOT NULL)<2
  `],
  ['deal_bilateral_acceptance_incomplete',`
    SELECT COUNT(*)::int AS count FROM deals d JOIN offer_revisions r ON r.id=d.accepted_offer_revision_id
     WHERE r.requires_bilateral_acceptance AND
       (SELECT COUNT(DISTINCT n.accepting_side) FROM negotiation_events n
         WHERE n.offer_revision_id=r.id AND n.event_type='accepted' AND n.accepting_party_id IS NOT NULL
           AND NULLIF(BTRIM(n.acceptance_evidence),'') IS NOT NULL)<2
  `],
  ['active_commission_policy_overlap_pairs',`
    SELECT COUNT(*)::int AS count FROM commission_payout_policy_versions a
      JOIN commission_payout_policy_versions b ON a.id<b.id AND a.currency=b.currency
       AND a.status='active' AND b.status='active'
       AND a.effective_from<COALESCE(b.effective_to,'infinity'::date)
       AND b.effective_from<COALESCE(a.effective_to,'infinity'::date)
  `],
  ['active_agent_adjustment_overlap_pairs',`
    SELECT COUNT(*)::int AS count FROM agent_payout_adjustment_versions a
      JOIN agent_payout_adjustment_versions b ON a.id<b.id AND a.agent_id=b.agent_id AND a.currency=b.currency
       AND a.status='active' AND b.status='active'
       AND a.effective_from<COALESCE(b.effective_to,'infinity'::date)
       AND b.effective_from<COALESCE(a.effective_to,'infinity'::date)
  `],
  ['active_commission_policy_invalid_slab_sets',`
    SELECT COUNT(*)::int AS count FROM commission_payout_policy_versions v
     WHERE v.status='active' AND (
       NOT EXISTS(SELECT 1 FROM commission_payout_policy_slabs s WHERE s.policy_version_id=v.id) OR
       EXISTS(SELECT 1 FROM (
         SELECT lower_amount,upper_amount,display_order,
                LAG(upper_amount) OVER(ORDER BY display_order) AS prior_upper,
                MAX(display_order) OVER() AS max_order
           FROM commission_payout_policy_slabs WHERE policy_version_id=v.id
       ) s WHERE (display_order=1 AND lower_amount<>0)
          OR (display_order>1 AND lower_amount IS DISTINCT FROM prior_upper)
          OR (upper_amount IS NULL AND display_order<>max_order))
     )
  `],
  ['active_agent_adjustment_invalid_slab_sets',`
    SELECT COUNT(*)::int AS count FROM agent_payout_adjustment_versions v
     WHERE v.status='active' AND (
       NOT EXISTS(SELECT 1 FROM agent_payout_adjustment_slabs s WHERE s.adjustment_version_id=v.id) OR
       EXISTS(SELECT 1 FROM (
         SELECT lower_amount,upper_amount,display_order,
                LAG(upper_amount) OVER(ORDER BY display_order) AS prior_upper,
                MAX(display_order) OVER() AS max_order
           FROM agent_payout_adjustment_slabs WHERE adjustment_version_id=v.id
       ) s WHERE (display_order=1 AND lower_amount<>0)
          OR (display_order>1 AND lower_amount IS DISTINCT FROM prior_upper)
          OR (upper_amount IS NULL AND display_order<>max_order))
     )
  `],
  ['leave_self_approval_decisions',`
    SELECT COUNT(*)::int AS count FROM leave_application_decisions d
      JOIN leave_applications a ON a.id=d.application_id
     WHERE d.decided_by=a.applicant_id
  `],
  ['leave_approval_task_assignment_mismatch',`
    SELECT COUNT(*)::int AS count FROM tasks t JOIN leave_applications a ON a.id=t.leave_application_id
     WHERE t.task_type='leave_approval' AND t.status IN ('open','in_progress')
       AND (a.approver_id IS NULL OR t.assignee_id<>a.approver_id)
  `]
];

export function normalizeTriggerDriftCheckBaseline(value,{label='trigger-drift data-check'}={}){
  if(!Array.isArray(value))throw Error(`Expected ${label} baseline must be an array`);
  const normalized=value.map(item=>({name:String(item?.name||''),count:Number(item?.count)})).sort((left,right)=>left.name.localeCompare(right.name));
  const names=new Set();
  for(const item of normalized){
    if(!/^[a-z0-9_]+$/.test(item.name)||!Number.isInteger(item.count)||item.count<0||names.has(item.name))throw Error(`Expected ${label} baseline is invalid`);
    names.add(item.name);
  }
  const governed=new Set(triggerDriftChecks.map(([name])=>name));
  if(normalized.length!==governed.size||normalized.some(item=>!governed.has(item.name)))throw Error(`Expected ${label} baseline does not cover every governed check`);
  return normalized;
}

export async function runTriggerDriftDataChecks(pool){
  const client=await pool.connect();
  try{
    await client.query('BEGIN READ ONLY');
    const results=[];
    for(const [name,sql] of triggerDriftChecks){
      const row=(await client.query(sql)).rows[0];
      results.push({name,count:Number(row.count)});
    }
    await client.query('COMMIT');
    return results.sort((left,right)=>left.name.localeCompare(right.name));
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{client.release();}
}

export function compareTriggerDriftDataChecks(expected,observed,{label='trigger-drift data-check'}={}){
  const expectedResults=normalizeTriggerDriftCheckBaseline(expected,{label});
  const observedResults=normalizeTriggerDriftCheckBaseline(observed,{label});
  const observedMap=new Map(observedResults.map(item=>[item.name,item.count]));
  const differences=expectedResults.filter(item=>observedMap.get(item.name)!==item.count).map(item=>({name:item.name,expected:item.count,observed:observedMap.get(item.name)}));
  return {label,expected:expectedResults,observed:observedResults,differences,matches:differences.length===0};
}
