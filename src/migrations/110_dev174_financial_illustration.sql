-- DEF-097: introduce a calculation-led Financial Illustration without weakening buyer proposal contracts.
ALTER TABLE proposal_templates DROP CONSTRAINT IF EXISTS proposal_templates_template_type_check;
ALTER TABLE proposal_templates ADD CONSTRAINT proposal_templates_template_type_check
  CHECK (template_type IN ('Quick','Investment','Comparison','Financial Illustration'));

WITH approved_source AS (
  SELECT
    COALESCE(
      (SELECT created_by FROM proposal_templates ORDER BY (status='active') DESC, created_at DESC LIMIT 1),
      (SELECT id FROM brokers WHERE role='admin' ORDER BY updated_at LIMIT 1)
    ) AS actor_id,
    COALESCE(
      (SELECT brand_version FROM proposal_templates ORDER BY (status='active') DESC, created_at DESC LIMIT 1),
      (SELECT brand_version FROM organization_settings WHERE status='active' LIMIT 1),
      'NYSA-2026.1'
    ) AS brand_version
)
INSERT INTO proposal_templates(
  id,template_type,name,version,brand_version,configuration,status,effective_from,
  created_by,approved_by,approved_at
)
SELECT gen_random_uuid(),'Financial Illustration','NYSA Financial Illustration',1,brand_version,
  jsonb_build_object(
    'brand','NYSA Realty',
    'approvedDisclaimers',jsonb_build_array('This Financial Illustration is indicative and prepared from the selected saved scenario. It is not lending approval, financial advice or a property recommendation. Figures, fees, rates and eligibility remain subject to lender, authority and transaction verification.'),
    'sections',jsonb_build_array(
      jsonb_build_object('code','customer_name','label','Customer name','source','system','field','contact.full_name','mandatory',true),
      jsonb_build_object('code','selected_property','label','Selected property','source','properties','mandatory',true),
      jsonb_build_object('code','financial_calculation','label','Saved financial calculation','source','financial','mandatory',true),
      jsonb_build_object('code','assumptions','label','Customer-facing assumptions','source','agent_input','mandatory',true,'helpText','Explain what is indicative or remains subject to lender, authority and transaction verification.')
    ),
    'buyerBooklet',jsonb_build_object(
      'maxProperties',1,'maxMediaPerProperty',0,'maxAmenities',1,'requireAvailabilityCheck',false,
      'propertyFields',jsonb_build_array(
        jsonb_build_object('code','inventory_id','mandatory',true,'condition','always'),
        jsonb_build_object('code','price','mandatory',true,'condition','always'),
        jsonb_build_object('code','location','mandatory',true,'condition','always'),
        jsonb_build_object('code','property_status','mandatory',true,'condition','always'),
        jsonb_build_object('code','built_up_area','mandatory',false,'condition','always'),
        jsonb_build_object('code','developer','mandatory',false,'condition','always'),
        jsonb_build_object('code','bedrooms','mandatory',false,'condition','always'),
        jsonb_build_object('code','parking','mandatory',false,'condition','always')
      ),
      'timelineStages','[]'::jsonb
    )
  ),
  'active',NOW(),actor_id,actor_id,NOW()
FROM approved_source
WHERE actor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM proposal_templates WHERE template_type='Financial Illustration');
