-- Obsolete Lead follow-ups are cancelled, never represented as work performed.
-- Independent proposal corrections, compliance, marketing and leave approvals remain open.
CREATE FUNCTION nysa_guard_terminal_lead_follow_up() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE terminal BOOLEAN;
BEGIN
  IF NEW.lead_id IS NULL OR NEW.task_type NOT IN ('general','qualification_follow_up','customer_response_follow_up')
     OR NEW.status NOT IN ('open','in_progress') THEN RETURN NEW; END IF;
  SELECT (stage IN ('Won','Lost') OR current_status IN ('closed_won','closed_lost'))
    INTO terminal FROM leads WHERE id=NEW.lead_id FOR UPDATE;
  IF terminal THEN
    NEW.status := 'cancelled';
    NEW.outcome := CONCAT_WS(E'\n',NULLIF(NEW.outcome,''),'Automatically cancelled: Lead is closed; follow-up is no longer required.');
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_terminal_lead_follow_up_guard BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION nysa_guard_terminal_lead_follow_up();

CREATE FUNCTION nysa_audit_terminal_lead_follow_up() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='cancelled' AND NEW.outcome LIKE '%Automatically cancelled: Lead is closed; follow-up is no longer required.'
     AND (TG_OP='INSERT' OR OLD.status IN ('open','in_progress')) THEN
    INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details)
    VALUES(gen_random_uuid(),'Task',NEW.id,'terminal_lead_follow_up_cancelled',NEW.created_by,
      json_build_object('leadId',NEW.lead_id,'executionMode','automatic_lifecycle_rule',
        'attribution','original_task_creator','reason','Lead closed; follow-up obsolete','status','cancelled')::text);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_terminal_lead_follow_up_audit AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION nysa_audit_terminal_lead_follow_up();

CREATE FUNCTION nysa_close_terminal_lead_follow_ups() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stage IN ('Won','Lost') OR NEW.current_status IN ('closed_won','closed_lost') THEN
    -- The task guard supplies the cancellation reason and the audit trigger records it.
    UPDATE tasks SET updated_at=NOW() WHERE lead_id=NEW.id
      AND task_type IN ('general','qualification_follow_up','customer_response_follow_up')
      AND status IN ('open','in_progress');
    UPDATE leads SET next_follow_up_at=(SELECT MIN(due_at) FROM tasks WHERE lead_id=NEW.id
      AND status IN ('open','in_progress')) WHERE id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leads_close_follow_ups AFTER INSERT OR UPDATE OF stage,current_status ON leads
  FOR EACH ROW EXECUTE FUNCTION nysa_close_terminal_lead_follow_ups();

-- Reconcile existing terminal Leads once; completed/cancelled task history is unchanged.
UPDATE tasks t SET updated_at=NOW() FROM leads l WHERE l.id=t.lead_id
  AND (l.stage IN ('Won','Lost') OR l.current_status IN ('closed_won','closed_lost'))
  AND t.task_type IN ('general','qualification_follow_up','customer_response_follow_up')
  AND t.status IN ('open','in_progress');
UPDATE leads l SET next_follow_up_at=(SELECT MIN(t.due_at) FROM tasks t WHERE t.lead_id=l.id
  AND t.status IN ('open','in_progress'))
  WHERE (l.stage IN ('Won','Lost') OR l.current_status IN ('closed_won','closed_lost'))
    AND l.next_follow_up_at IS DISTINCT FROM (SELECT MIN(t.due_at) FROM tasks t WHERE t.lead_id=l.id
      AND t.status IN ('open','in_progress'));
