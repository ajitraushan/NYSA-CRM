ALTER TABLE customer_evidence_facts
  DROP CONSTRAINT IF EXISTS customer_evidence_facts_fact_group_check;

ALTER TABLE customer_evidence_facts
  ADD CONSTRAINT customer_evidence_facts_fact_group_check
  CHECK (fact_group IN ('identity','enquiry','requirement','profile','attribution','consent','advisory'));

WITH advisory_questions(question_id, question_text, answer_labels) AS (
  VALUES
    ('residency','Are you currently living in Dubai?','{"renting":"Yes, renting in Dubai","own":"Yes, I own a home in Dubai","moving":"Moving to Dubai soon","overseas":"Overseas investor only"}'::jsonb),
    ('rent','If renting, what is your approximate annual rent?','{"rent_low":"Under AED 75k","rent_mid":"AED 75k-125k","rent_high":"AED 125k-200k","rent_prime":"AED 200k+","rent_na":"Not applicable"}'::jsonb),
    ('household','What best describes your household?','{"single":"Single professional","couple":"Couple","young_family":"Family with young children","school_family":"Family with school-going children","investor_only":"Investor only"}'::jsonb),
    ('daily_anchor','Which location anchor matters most in daily life?','{"office":"Office / business location","school":"Children''s school","airport":"Airport access","beach":"Beach / lifestyle","downtown":"Downtown / DIFC / Business Bay","flexible":"Flexible / investment-led"}'::jsonb),
    ('zone','Where do you spend most of your week?','{"marina":"Dubai Marina / JLT / JBR","downtown_zone":"Downtown / Business Bay / DIFC","hills_barsha":"Dubai Hills / Al Barsha / Jumeirah","meydan":"Meydan / MBR / Nad Al Sheba","south":"Dubai South / Expo / Jebel Ali","abu_dhabi":"Abu Dhabi / Dubai-Abu Dhabi commute","unsure_zone":"Not sure / flexible"}'::jsonb),
    ('budget','What is your approximate purchase budget?','{"b_under1":"Under AED 1M","b_1_2":"AED 1M-2M","b_2_5":"AED 2M-5M","b_5plus":"AED 5M+"}'::jsonb),
    ('funding','How do you plan to fund the purchase?','{"cash":"Cash","mortgage":"Mortgage","mixed":"Cash and mortgage mix","payment_plan":"Developer payment plan","funding_unsure":"Not sure yet"}'::jsonb),
    ('monthly','What monthly payment feels comfortable?','{"m_under5":"Less than AED 5k","m_5_10":"AED 5k-10k","m_10_20":"AED 10k-20k","m_20plus":"AED 20k+","m_lump":"Prefer annual/lump-sum planning"}'::jsonb),
    ('rent_replace','Are you trying to replace rent with ownership?','{"replace_yes":"Yes, that is a key goal","replace_maybe":"Maybe, if numbers make sense","replace_no":"No, pure investment","replace_unsure":"Not sure"}'::jsonb),
    ('horizon','How long can you hold the property?','{"h_short":"1-2 years","h_mid":"3-5 years","h_long":"5+ years","h_unsure":"Not sure"}'::jsonb),
    ('goal','What outcome matters most?','{"rental":"Rental income","growth":"Capital growth","lifestyle":"Family lifestyle","wealth":"Wealth preservation","visa":"Golden Visa / long-term base","balanced":"Balanced"}'::jsonb),
    ('risk','How comfortable are you with off-plan risk?','{"ready_only":"Prefer ready property only","near_handover":"Open to near-handover","strong_developer":"Comfortable with strong developer off-plan","early_stage":"Open to early-stage higher upside","risk_guidance":"Need guidance"}'::jsonb)
), retained_answers AS (
  SELECT e.id AS intake_event_id,e.contact_id,e.lead_id,e.received_at,e.status,
    COALESCE(e.received_payload #>> '{sourceEvidence,formVersion}',e.received_payload #>> '{profile,sourceVersion}') AS source_version,
    answer.key AS question_id,answer.value AS answer_code
  FROM website_intake_events e
  CROSS JOIN LATERAL jsonb_each_text(COALESCE(e.received_payload #> '{sourceEvidence,sourceSpecific,answers}','{}'::jsonb)) answer
  WHERE COALESCE(e.source_form,e.received_payload->>'form')='ai_advisory_v1'
)
INSERT INTO customer_evidence_facts
  (id,intake_event_id,contact_id,lead_id,fact_group,fact_code,value_json,evidence_kind,review_status,source_code,source_version,captured_at,reviewed_at,review_reason)
SELECT gen_random_uuid(),a.intake_event_id,a.contact_id,a.lead_id,'advisory','advisory_answer_'||a.question_id,
  jsonb_build_object('questionId',a.question_id,'question',q.question_text,'answerCode',a.answer_code,
    'answerLabel',COALESCE(q.answer_labels->>a.answer_code,replace(a.answer_code,'_',' '))),
  'declared',CASE WHEN a.status='accepted' AND a.contact_id IS NOT NULL THEN 'active' ELSE 'pending_review' END,
  'investment_profile',a.source_version,a.received_at,
  CASE WHEN a.status='accepted' AND a.contact_id IS NOT NULL THEN NOW() ELSE NULL END,
  CASE WHEN a.status='accepted' AND a.contact_id IS NOT NULL THEN 'Backfilled from retained accepted AI Advisory intake evidence' ELSE NULL END
FROM retained_answers a
JOIN advisory_questions q ON q.question_id=a.question_id
ON CONFLICT(intake_event_id,fact_code) DO NOTHING;

WITH retained_summaries AS (
  SELECT e.id AS intake_event_id,e.contact_id,e.lead_id,e.received_at,e.status,
    COALESCE(e.received_payload #>> '{sourceEvidence,formVersion}',e.received_payload #>> '{profile,sourceVersion}') AS source_version,
    COALESCE(e.received_payload #>> '{sourceEvidence,sourceSpecific,recommendation}','') AS recommended_route,
    COALESCE(e.received_payload #>> '{sourceEvidence,sourceSpecific,raw,message}',e.received_payload #>> '{requirement,notes}','') AS summary_text
  FROM website_intake_events e
  WHERE COALESCE(e.source_form,e.received_payload->>'form')='ai_advisory_v1'
)
INSERT INTO customer_evidence_facts
  (id,intake_event_id,contact_id,lead_id,fact_group,fact_code,value_json,evidence_kind,review_status,source_code,source_version,captured_at,reviewed_at,review_reason)
SELECT gen_random_uuid(),s.intake_event_id,s.contact_id,s.lead_id,'advisory','advisory_summary',
  jsonb_build_object('clientProfile',NULL,'recommendedRoute',NULLIF(s.recommended_route,''),'summary',NULLIF(s.summary_text,''),'focusAreas',NULL,'whatToAvoid',NULL),
  'system_observed',CASE WHEN s.status='accepted' AND s.contact_id IS NOT NULL THEN 'active' ELSE 'pending_review' END,
  'investment_profile',s.source_version,s.received_at,
  CASE WHEN s.status='accepted' AND s.contact_id IS NOT NULL THEN NOW() ELSE NULL END,
  CASE WHEN s.status='accepted' AND s.contact_id IS NOT NULL THEN 'Backfilled from the advisory summary retained with the accepted intake' ELSE NULL END
FROM retained_summaries s
WHERE s.recommended_route<>'' OR s.summary_text<>''
ON CONFLICT(intake_event_id,fact_code) DO NOTHING;

GRANT SELECT,INSERT,UPDATE ON customer_evidence_facts TO nysareal_nysar2app;
