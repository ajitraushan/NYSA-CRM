-- Move pending leave approval away from the retired Admin decision route.
-- Historical task-link evidence remains immutable; a new approval cycle records
-- each valid Line Manager reroute. Invalid reporting lines fail closed.
DO $$
DECLARE
  item RECORD;
  next_task_id UUID;
  next_cycle INTEGER;
  next_version INTEGER;
  fingerprint TEXT;
BEGIN
  FOR item IN
    SELECT a.*,e.reporting_manager_id,p.decision_due_working_days,
      m.id AS active_manager_id,t.id AS prior_task_id,t.subject AS prior_subject,
      t.details AS prior_details,t.priority AS prior_priority,t.due_at AS prior_due_at
    FROM leave_applications a
    JOIN agent_employment_versions e ON e.id=a.employment_version_id
    JOIN leave_policy_versions p ON p.id=a.policy_version_id
    LEFT JOIN brokers m ON m.id=e.reporting_manager_id
      AND m.role='internal_broker' AND m.job_role IN('manager','director')
      AND m.status='active' AND m.id<>a.applicant_id
    LEFT JOIN tasks t ON t.leave_application_id=a.id AND t.task_type='leave_approval'
      AND t.status IN('open','in_progress')
    WHERE a.status='submitted' AND COALESCE(a.routing_reason,'')<>'leave_to_line_manager'
    FOR UPDATE OF a
  LOOP
    IF item.prior_task_id IS NOT NULL THEN
      UPDATE tasks SET status='cancelled',outcome='Approval route replaced by maintained Line Manager',
        completed_at=NOW(),updated_at=NOW() WHERE id=item.prior_task_id;
    END IF;

    IF item.active_manager_id IS NULL THEN
      UPDATE leave_applications SET status='routing_required',approver_id=NULL,
        routing_reason='line_manager_configuration_required',version=version+1,updated_at=NOW()
      WHERE id=item.id;
      INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details)
      VALUES(gen_random_uuid(),'LeaveApplication',item.id,'line_manager_routing_required',item.created_by,
        '{"migration":"130_line_manager_leave_approval","reason":"No active maintained Manager or Director"}');
      CONTINUE;
    END IF;

    next_task_id:=gen_random_uuid();
    next_cycle:=item.approval_cycle+1;
    next_version:=item.version+1;
    fingerprint:=md5(item.id::text||':'||next_version::text||':'||next_cycle::text||':'||item.active_manager_id::text)
      ||md5('line-manager:'||item.id::text||':'||next_cycle::text||':'||item.active_manager_id::text);

    UPDATE leave_applications SET approver_id=item.active_manager_id,
      routing_reason='leave_to_line_manager',approval_cycle=next_cycle,
      version=next_version,updated_at=NOW() WHERE id=item.id;
    INSERT INTO tasks(id,lead_id,contact_id,subject,details,assignee_id,priority,status,due_at,
      created_by,task_type,leave_application_id)
    VALUES(next_task_id,NULL,NULL,COALESCE(item.prior_subject,'Review leave · '||item.application_reference),
      item.prior_details,item.active_manager_id,COALESCE(item.prior_priority,'normal'),'open',
      GREATEST(COALESCE(item.prior_due_at,NOW()),NOW()+make_interval(days=>item.decision_due_working_days)),
      item.created_by,'leave_approval',item.id);
    INSERT INTO leave_application_task_links(id,application_id,application_version,approval_cycle,
      task_id,approver_id,routing_reason,request_fingerprint)
    VALUES(gen_random_uuid(),item.id,next_version,next_cycle,next_task_id,item.active_manager_id,
      'leave_to_line_manager',fingerprint);
    INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details)
    VALUES(gen_random_uuid(),'LeaveApplication',item.id,'rerouted_to_line_manager',item.created_by,
      json_build_object('migration','130_line_manager_leave_approval','approverId',item.active_manager_id,
        'taskId',next_task_id,'approvalCycle',next_cycle)::text);
  END LOOP;
END $$;
