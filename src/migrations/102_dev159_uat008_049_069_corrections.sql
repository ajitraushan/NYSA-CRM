-- dev.159 cumulative UAT corrections. Property Finder remains disabled and is not targeted.

CREATE TABLE inventory_buildings (
  id UUID PRIMARY KEY,
  stable_code TEXT NOT NULL UNIQUE CHECK(stable_code ~ '^[a-z][a-z0-9_]{2,79}$'),
  community_id UUID NOT NULL REFERENCES market_communities(id),
  business_label TEXT NOT NULL,
  normalized_label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  external_mapping_status TEXT NOT NULL DEFAULT 'not_mapped' CHECK(external_mapping_status IN('not_mapped','mapped','retired')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(community_id,normalized_label)
);

ALTER TABLE listings ADD COLUMN building_id UUID REFERENCES inventory_buildings(id);
CREATE INDEX listings_building_id_idx ON listings(building_id) WHERE deleted_at IS NULL;
CREATE INDEX inventory_buildings_community_idx ON inventory_buildings(community_id,active,business_label);

-- Existing Community/Building text is retained verbatim as historical evidence. It is not guessed into a master.
-- Administrators must explicitly map legacy Inventory during review.

GRANT SELECT,INSERT,UPDATE ON inventory_buildings TO nysareal_nysar2app;

-- The Offer direction vocabulary now represents one coherent dimension.
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_offer_type_check;
-- Existing ambiguous Offer values remain immutable history. NOT VALID permits those retained rows while
-- enforcing the coherent direction vocabulary for every new or changed row.
ALTER TABLE offers ADD CONSTRAINT offers_offer_type_check CHECK(offer_type IN('purchase','sale','rent','rent_out')) NOT VALID;

-- Canonical Lead objective is introduced without silently reinterpreting mixed historical classifications.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_business_type_check;
ALTER TABLE leads ADD CONSTRAINT leads_business_type_check CHECK(business_type IN('Sale','Rental','Off-plan','Commercial','Unconfirmed'));
ALTER TABLE leads ADD COLUMN customer_objective TEXT CHECK(customer_objective IN('buy','sell','rent','rent_out','not_confirmed'));
ALTER TABLE leads ADD COLUMN market_stage_requirement TEXT CHECK(market_stage_requirement IN('ready','off_plan','either','not_confirmed'));
ALTER TABLE leads ADD COLUMN property_segment_requirement TEXT CHECK(property_segment_requirement IN('residential','commercial','either','not_confirmed'));
ALTER TABLE leads ADD COLUMN classification_version TEXT;
ALTER TABLE leads ADD COLUMN legacy_classification_review_required BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE leads SET
  customer_objective=CASE business_type WHEN 'Rental' THEN 'not_confirmed' WHEN 'Sale' THEN 'not_confirmed' ELSE 'not_confirmed' END,
  market_stage_requirement=CASE business_type WHEN 'Off-plan' THEN 'off_plan' ELSE 'not_confirmed' END,
  property_segment_requirement=CASE business_type WHEN 'Commercial' THEN 'commercial' ELSE 'not_confirmed' END,
  classification_version='legacy-dev158-review',
  legacy_classification_review_required=TRUE
WHERE customer_objective IS NULL;

ALTER TABLE lead_requirements ADD COLUMN customer_objective TEXT CHECK(customer_objective IN('buy','sell','rent','rent_out','not_confirmed'));
ALTER TABLE lead_requirements ADD COLUMN market_stage_requirement TEXT CHECK(market_stage_requirement IN('ready','off_plan','either','not_confirmed'));
ALTER TABLE lead_requirements ADD COLUMN property_segment_requirement TEXT CHECK(property_segment_requirement IN('residential','commercial','either','not_confirmed'));
ALTER TABLE lead_requirements ADD COLUMN classification_version TEXT;

ALTER TABLE qualification_models ADD COLUMN customer_objective TEXT CHECK(customer_objective IN('buy','sell','rent','rent_out'));
DROP INDEX IF EXISTS qualification_models_active_uq;
CREATE UNIQUE INDEX qualification_models_active_uq ON qualification_models(model_code,COALESCE(customer_objective,'')) WHERE status='active';
CREATE INDEX qualification_models_objective_status_idx ON qualification_models(customer_objective,status);

-- Negotiation now records Customer acceptance before Booking. The next governed action is therefore
-- an explicit reservation step rather than an acceptance hidden inside Booking.
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_next_action_code_ck;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_next_action_code_ck CHECK (next_action_code IN (
  'confirm_requirements','send_property_details','arrange_consultation','schedule_viewing',
  'obtain_missing_information','confirm_finance_readiness','prepare_or_review_offer',
  'follow_up_offer_feedback','await_customer_decision','nurture_follow_up','controlled_exception',
  'complete_viewing_feedback','return_to_matching','monitor_reservation','create_reservation',
  'complete_deal','closed_won','closed_lost'
));

-- Deal and linkage reference each other. Permit the transaction-local empty staging row; the deferred
-- consistency trigger still rejects any committed Deal whose direct pointers and current linkage disagree.
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_single_property_ck;
ALTER TABLE deals ADD CONSTRAINT deals_single_property_ck CHECK (
  (listing_id IS NOT NULL)::int + (external_property_id IS NOT NULL)::int <= 1
);
