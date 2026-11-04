-- DEV264: restore the complete governed trigger contract after CRM Test schema drift.
-- Generated from 167 migrations through 167_whatsapp_simulator_fault_contract.sql.
-- Contract SHA-256: a270024b7f86cb4506fdcec33c19b14589ef3302d9cb5c2e29a0f1248b9cb073
-- This migration intentionally recreates triggers only. It does not replace trigger functions.

-- Reconcile every monthly Lead counter with durable references before restoring
-- the BEFORE INSERT allocator. Existing higher counters are never reduced.
INSERT INTO lead_month_number_counters(period_code,last_value,updated_at)
SELECT SUBSTRING(lead_reference FROM 9 FOR 6),
       MAX(SUBSTRING(lead_reference FROM 16)::INTEGER),
       NOW()
  FROM leads
 WHERE lead_reference ~ '^NYSA-LD-[0-9]{6}-[0-9]{6}$'
 GROUP BY 1
ON CONFLICT(period_code) DO UPDATE
  SET last_value=GREATEST(lead_month_number_counters.last_value,EXCLUDED.last_value),
      updated_at=CASE
        WHEN lead_month_number_counters.last_value<EXCLUDED.last_value THEN NOW()
        ELSE lead_month_number_counters.updated_at
      END;

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "agent_adjustment_slabs_draft_only" ON "agent_payout_adjustment_slabs";
CREATE TRIGGER agent_adjustment_slabs_draft_only BEFORE DELETE OR UPDATE ON agent_payout_adjustment_slabs FOR EACH ROW EXECUTE FUNCTION protect_payout_configuration();

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "agent_adjustment_no_overlap" ON "agent_payout_adjustment_versions";
CREATE TRIGGER agent_adjustment_no_overlap BEFORE INSERT OR UPDATE OF status, effective_from, effective_to ON agent_payout_adjustment_versions FOR EACH ROW EXECUTE FUNCTION prevent_active_payout_overlap();

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "agent_adjustment_validate_slabs" ON "agent_payout_adjustment_versions";
CREATE TRIGGER agent_adjustment_validate_slabs BEFORE UPDATE OF status ON agent_payout_adjustment_versions FOR EACH ROW EXECUTE FUNCTION validate_commission_slab_set();

-- 135_accountant_workspace_payout_advice.sql
DROP TRIGGER IF EXISTS "protect_agent_payout_advice_evidence" ON "agent_payout_advices";
CREATE TRIGGER protect_agent_payout_advice_evidence BEFORE UPDATE ON agent_payout_advices FOR EACH ROW EXECUTE FUNCTION protect_agent_payout_advice_evidence();

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "payout_bands_immutable" ON "agent_payout_calculation_bands";
CREATE TRIGGER payout_bands_immutable BEFORE DELETE OR UPDATE ON agent_payout_calculation_bands FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "payout_decisions_immutable" ON "agent_payout_decision_events";
CREATE TRIGGER payout_decisions_immutable BEFORE DELETE OR UPDATE ON agent_payout_decision_events FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "payout_releases_immutable" ON "agent_payout_release_events";
CREATE TRIGGER payout_releases_immutable BEFORE DELETE OR UPDATE ON agent_payout_release_events FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

-- 121_agent_social_media_payout_eligibility.sql
DROP TRIGGER IF EXISTS "agent_social_media_status_no_overlap" ON "agent_social_media_payout_status_versions";
CREATE TRIGGER agent_social_media_status_no_overlap BEFORE INSERT OR UPDATE OF agent_id, effective_from, effective_to ON agent_social_media_payout_status_versions FOR EACH ROW EXECUTE FUNCTION prevent_agent_social_media_status_overlap();

-- 079_release3b_reservation_expiry_governance.sql
DROP TRIGGER IF EXISTS "booking_reservation_extensions_immutable" ON "booking_reservation_extensions";
CREATE TRIGGER booking_reservation_extensions_immutable BEFORE DELETE OR UPDATE ON booking_reservation_extensions FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 046_release2_booking_reservation.sql
DROP TRIGGER IF EXISTS "booking_status_history_immutable" ON "booking_status_history";
CREATE TRIGGER booking_status_history_immutable BEFORE DELETE OR UPDATE ON booking_status_history FOR EACH ROW EXECUTE FUNCTION reject_booking_history_mutation();

-- 136_uat_inventory_mandates_and_offer_acceptance.sql
DROP TRIGGER IF EXISTS "bookings_bilateral_acceptance" ON "bookings";
CREATE TRIGGER bookings_bilateral_acceptance BEFORE INSERT OR UPDATE OF accepted_offer_revision_id ON bookings FOR EACH ROW EXECUTE FUNCTION ensure_bilateral_offer_acceptance();

-- 079_release3b_reservation_expiry_governance.sql
DROP TRIGGER IF EXISTS "bookings_reservation_expiry_policy" ON "bookings";
CREATE TRIGGER bookings_reservation_expiry_policy BEFORE INSERT OR UPDATE OF expires_at ON bookings FOR EACH ROW EXECUTE FUNCTION enforce_booking_reservation_expiry_policy();

-- 094_release3d_calendly_scheduling.sql
DROP TRIGGER IF EXISTS "calendly_projection_events_immutable" ON "calendly_projection_events";
CREATE TRIGGER calendly_projection_events_immutable BEFORE DELETE OR UPDATE ON calendly_projection_events FOR EACH ROW EXECUTE FUNCTION prevent_calendly_evidence_mutation();

-- 094_release3d_calendly_scheduling.sql
DROP TRIGGER IF EXISTS "calendly_provider_event_processing_immutable" ON "calendly_provider_event_processing";
CREATE TRIGGER calendly_provider_event_processing_immutable BEFORE DELETE OR UPDATE ON calendly_provider_event_processing FOR EACH ROW EXECUTE FUNCTION prevent_calendly_evidence_mutation();

-- 094_release3d_calendly_scheduling.sql
DROP TRIGGER IF EXISTS "calendly_provider_events_immutable" ON "calendly_provider_events";
CREATE TRIGGER calendly_provider_events_immutable BEFORE DELETE OR UPDATE ON calendly_provider_events FOR EACH ROW EXECUTE FUNCTION prevent_calendly_evidence_mutation();

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "commission_policy_slabs_draft_only" ON "commission_payout_policy_slabs";
CREATE TRIGGER commission_policy_slabs_draft_only BEFORE DELETE OR UPDATE ON commission_payout_policy_slabs FOR EACH ROW EXECUTE FUNCTION protect_payout_configuration();

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "commission_policy_no_overlap" ON "commission_payout_policy_versions";
CREATE TRIGGER commission_policy_no_overlap BEFORE INSERT OR UPDATE OF status, effective_from, effective_to ON commission_payout_policy_versions FOR EACH ROW EXECUTE FUNCTION prevent_active_payout_overlap();

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "commission_policy_validate_slabs" ON "commission_payout_policy_versions";
CREATE TRIGGER commission_policy_validate_slabs BEFORE UPDATE OF status ON commission_payout_policy_versions FOR EACH ROW EXECUTE FUNCTION validate_commission_slab_set();

-- 118_dev186_187_receivable_workflow.sql
DROP TRIGGER IF EXISTS "receivable_adjustment_protection" ON "commission_receivable_adjustment_requests";
CREATE TRIGGER receivable_adjustment_protection BEFORE DELETE OR UPDATE ON commission_receivable_adjustment_requests FOR EACH ROW EXECUTE FUNCTION protect_receivable_adjustment_request();

-- 115_receivable_single_entry_receipts.sql
DROP TRIGGER IF EXISTS "receivable_collection_link" ON "commission_receivable_collections";
CREATE TRIGGER receivable_collection_link BEFORE INSERT ON commission_receivable_collections FOR EACH ROW EXECUTE FUNCTION validate_receivable_receipt_link();

-- 113_dev177_commission_receivables.sql
DROP TRIGGER IF EXISTS "receivable_collections_immutable" ON "commission_receivable_collections";
CREATE TRIGGER receivable_collections_immutable BEFORE DELETE OR UPDATE ON commission_receivable_collections FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

-- 113_dev177_commission_receivables.sql
DROP TRIGGER IF EXISTS "receivable_invoice_protection" ON "commission_receivable_invoices";
CREATE TRIGGER receivable_invoice_protection BEFORE DELETE OR UPDATE ON commission_receivable_invoices FOR EACH ROW EXECUTE FUNCTION protect_commission_receivable_invoice();

-- 113_dev177_commission_receivables.sql
DROP TRIGGER IF EXISTS "receivable_requests_immutable" ON "commission_receivable_requests";
CREATE TRIGGER receivable_requests_immutable BEFORE DELETE OR UPDATE ON commission_receivable_requests FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

-- 115_receivable_single_entry_receipts.sql
DROP TRIGGER IF EXISTS "receivable_reversal_link" ON "commission_receivable_reversals";
CREATE TRIGGER receivable_reversal_link BEFORE INSERT ON commission_receivable_reversals FOR EACH ROW EXECUTE FUNCTION validate_receivable_receipt_link();

-- 113_dev177_commission_receivables.sql
DROP TRIGGER IF EXISTS "receivable_reversals_immutable" ON "commission_receivable_reversals";
CREATE TRIGGER receivable_reversals_immutable BEFORE DELETE OR UPDATE ON commission_receivable_reversals FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

-- 113_dev177_commission_receivables.sql
DROP TRIGGER IF EXISTS "receivable_schedules_immutable" ON "commission_receivable_schedules";
CREATE TRIGGER receivable_schedules_immutable BEFORE DELETE OR UPDATE ON commission_receivable_schedules FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

-- 085_release3c_governed_share_response.sql
DROP TRIGGER IF EXISTS "communication_policy_decisions_immutable" ON "communication_policy_decisions";
CREATE TRIGGER communication_policy_decisions_immutable BEFORE DELETE OR UPDATE ON communication_policy_decisions FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 085_release3c_governed_share_response.sql
DROP TRIGGER IF EXISTS "customer_response_task_provenance_immutable" ON "customer_response_task_provenance";
CREATE TRIGGER customer_response_task_provenance_immutable BEFORE DELETE OR UPDATE ON customer_response_task_provenance FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "deal_agent_credit_lines_immutable" ON "deal_agent_credit_lines";
CREATE TRIGGER deal_agent_credit_lines_immutable BEFORE DELETE OR UPDATE ON deal_agent_credit_lines FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "commission_expectation_components_immutable" ON "deal_commission_expectation_components";
CREATE TRIGGER commission_expectation_components_immutable BEFORE DELETE OR UPDATE ON deal_commission_expectation_components FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

-- 112_dev176_commission_proof.sql
DROP TRIGGER IF EXISTS "commission_proofs_immutable" ON "deal_commission_proofs";
CREATE TRIGGER commission_proofs_immutable BEFORE DELETE OR UPDATE ON deal_commission_proofs FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

-- 116_opportunity_finance_identity.sql
DROP TRIGGER IF EXISTS "proof_opportunity" ON "deal_commission_proofs";
CREATE TRIGGER proof_opportunity BEFORE INSERT ON deal_commission_proofs FOR EACH ROW EXECUTE FUNCTION validate_finance_opportunity();

-- 115_receivable_single_entry_receipts.sql
DROP TRIGGER IF EXISTS "commission_confirmations_immutable" ON "deal_commission_receipt_confirmations";
CREATE TRIGGER commission_confirmations_immutable BEFORE DELETE OR UPDATE ON deal_commission_receipt_confirmations FOR EACH ROW EXECUTE FUNCTION protect_commission_confirmation_evidence();

-- 116_opportunity_finance_identity.sql
DROP TRIGGER IF EXISTS "confirmation_opportunity" ON "deal_commission_receipt_confirmations";
CREATE TRIGGER confirmation_opportunity BEFORE INSERT ON deal_commission_receipt_confirmations FOR EACH ROW EXECUTE FUNCTION validate_finance_opportunity();

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "commission_receipts_immutable" ON "deal_commission_receipts";
CREATE TRIGGER commission_receipts_immutable BEFORE DELETE OR UPDATE ON deal_commission_receipts FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

-- 115_receivable_single_entry_receipts.sql
DROP TRIGGER IF EXISTS "receipt_changes_supersede_confirmation" ON "deal_commission_receipts";
CREATE TRIGGER receipt_changes_supersede_confirmation AFTER INSERT ON deal_commission_receipts FOR EACH ROW EXECUTE FUNCTION supersede_changed_receipt_confirmation();

-- 116_opportunity_finance_identity.sql
DROP TRIGGER IF EXISTS "receipt_opportunity" ON "deal_commission_receipts";
CREATE TRIGGER receipt_opportunity BEFORE INSERT ON deal_commission_receipts FOR EACH ROW EXECUTE FUNCTION validate_finance_opportunity();

-- 088_release5_commission_receipt_realtime_payout.sql
DROP TRIGGER IF EXISTS "commission_variance_decisions_immutable" ON "deal_commission_variance_decisions";
CREATE TRIGGER commission_variance_decisions_immutable BEFORE DELETE OR UPDATE ON deal_commission_variance_decisions FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

-- 090_release6_customer_transaction_document_compliance.sql
DROP TRIGGER IF EXISTS "deal_document_requirement_instances_immutable" ON "deal_document_requirement_instances";
CREATE TRIGGER deal_document_requirement_instances_immutable BEFORE DELETE OR UPDATE ON deal_document_requirement_instances FOR EACH ROW EXECUTE FUNCTION reject_document_compliance_evidence_mutation();

-- 099_dev153_inventory_assignment_lifecycle.sql
DROP TRIGGER IF EXISTS "deal_inventory_linkages_immutable" ON "deal_inventory_linkages";
CREATE TRIGGER deal_inventory_linkages_immutable BEFORE DELETE OR UPDATE ON deal_inventory_linkages FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 047_release2_deal_foundation.sql
DROP TRIGGER IF EXISTS "deal_status_history_immutable" ON "deal_status_history";
CREATE TRIGGER deal_status_history_immutable BEFORE DELETE OR UPDATE ON deal_status_history FOR EACH ROW EXECUTE FUNCTION reject_deal_status_history_mutation();

-- 136_uat_inventory_mandates_and_offer_acceptance.sql
DROP TRIGGER IF EXISTS "deals_bilateral_acceptance" ON "deals";
CREATE TRIGGER deals_bilateral_acceptance BEFORE INSERT OR UPDATE OF accepted_offer_revision_id ON deals FOR EACH ROW EXECUTE FUNCTION ensure_bilateral_offer_acceptance();

-- 099_dev153_inventory_assignment_lifecycle.sql
DROP TRIGGER IF EXISTS "deals_current_inventory_linkage_consistency" ON "deals";
CREATE CONSTRAINT TRIGGER deals_current_inventory_linkage_consistency AFTER INSERT OR UPDATE OF current_inventory_linkage_id, listing_id, external_property_id, offer_id, accepted_offer_revision_id, booking_id ON deals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_deal_current_inventory_linkage();

-- 098_developer_arrangement_and_listing_noc.sql
DROP TRIGGER IF EXISTS "developer_arrangement_immutable" ON "developer_brokerage_arrangement_versions";
CREATE TRIGGER developer_arrangement_immutable BEFORE DELETE OR UPDATE ON developer_brokerage_arrangement_versions FOR EACH ROW EXECUTE FUNCTION prevent_developer_arrangement_fact_mutation();

-- 087_release4_dld_market_intelligence.sql
DROP TRIGGER IF EXISTS "dld_observations_immutable" ON "dld_market_observations";
CREATE TRIGGER dld_observations_immutable BEFORE INSERT OR DELETE OR UPDATE ON dld_market_observations FOR EACH ROW EXECUTE FUNCTION enforce_dld_observation_immutability();

-- 087_release4_dld_market_intelligence.sql
DROP TRIGGER IF EXISTS "dld_source_rows_immutable" ON "dld_market_source_rows";
CREATE TRIGGER dld_source_rows_immutable BEFORE DELETE OR UPDATE ON dld_market_source_rows FOR EACH ROW EXECUTE FUNCTION reject_dld_source_row_mutation();

-- 090_release6_customer_transaction_document_compliance.sql
DROP TRIGGER IF EXISTS "document_compliance_reviews_immutable" ON "document_compliance_evidence_review_events";
CREATE TRIGGER document_compliance_reviews_immutable BEFORE DELETE OR UPDATE ON document_compliance_evidence_review_events FOR EACH ROW EXECUTE FUNCTION reject_document_compliance_evidence_mutation();

-- 090_release6_customer_transaction_document_compliance.sql
DROP TRIGGER IF EXISTS "document_compliance_evidence_immutable" ON "document_compliance_evidence_versions";
CREATE TRIGGER document_compliance_evidence_immutable BEFORE DELETE OR UPDATE ON document_compliance_evidence_versions FOR EACH ROW EXECUTE FUNCTION reject_document_compliance_evidence_mutation();

-- 090_release6_customer_transaction_document_compliance.sql
DROP TRIGGER IF EXISTS "document_compliance_task_links_immutable" ON "document_compliance_followup_task_links";
CREATE TRIGGER document_compliance_task_links_immutable BEFORE DELETE OR UPDATE ON document_compliance_followup_task_links FOR EACH ROW EXECUTE FUNCTION reject_document_compliance_evidence_mutation();

-- 090_release6_customer_transaction_document_compliance.sql
DROP TRIGGER IF EXISTS "document_compliance_official_links_immutable" ON "document_compliance_official_evidence_links";
CREATE TRIGGER document_compliance_official_links_immutable BEFORE DELETE OR UPDATE ON document_compliance_official_evidence_links FOR EACH ROW EXECUTE FUNCTION reject_document_compliance_evidence_mutation();

-- 093_release3d_microsoft365_email.sql
DROP TRIGGER IF EXISTS "email_message_evidence_immutable" ON "email_message_evidence";
CREATE TRIGGER email_message_evidence_immutable BEFORE DELETE OR UPDATE ON email_message_evidence FOR EACH ROW EXECUTE FUNCTION prevent_email_integration_evidence_mutation();

-- 093_release3d_microsoft365_email.sql
DROP TRIGGER IF EXISTS "email_message_state_events_immutable" ON "email_message_state_events";
CREATE TRIGGER email_message_state_events_immutable BEFORE DELETE OR UPDATE ON email_message_state_events FOR EACH ROW EXECUTE FUNCTION prevent_email_integration_evidence_mutation();

-- 093_release3d_microsoft365_email.sql
DROP TRIGGER IF EXISTS "email_projection_events_immutable" ON "email_projection_events";
CREATE TRIGGER email_projection_events_immutable BEFORE DELETE OR UPDATE ON email_projection_events FOR EACH ROW EXECUTE FUNCTION prevent_email_integration_evidence_mutation();

-- 093_release3d_microsoft365_email.sql
DROP TRIGGER IF EXISTS "email_provider_event_processing_immutable" ON "email_provider_event_processing";
CREATE TRIGGER email_provider_event_processing_immutable BEFORE DELETE OR UPDATE ON email_provider_event_processing FOR EACH ROW EXECUTE FUNCTION prevent_email_integration_evidence_mutation();

-- 093_release3d_microsoft365_email.sql
DROP TRIGGER IF EXISTS "email_provider_events_immutable" ON "email_provider_events";
CREATE TRIGGER email_provider_events_immutable BEFORE DELETE OR UPDATE ON email_provider_events FOR EACH ROW EXECUTE FUNCTION prevent_email_integration_evidence_mutation();

-- 080_release3b_external_portal_preparation.sql
DROP TRIGGER IF EXISTS "external_listing_preparation_versions_immutable" ON "external_listing_preparation_versions";
CREATE TRIGGER external_listing_preparation_versions_immutable BEFORE DELETE OR UPDATE ON external_listing_preparation_versions FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 081_release3b_portal_permit_reconciliation.sql
DROP TRIGGER IF EXISTS "external_portal_permit_evidence_versions_immutable" ON "external_portal_permit_evidence_versions";
CREATE TRIGGER external_portal_permit_evidence_versions_immutable BEFORE DELETE OR UPDATE ON external_portal_permit_evidence_versions FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 078_release3b_inventory_progressive_governance.sql
DROP TRIGGER IF EXISTS "inventory_agent_assignment_history_immutable" ON "inventory_agent_assignment_history";
CREATE TRIGGER inventory_agent_assignment_history_immutable BEFORE DELETE OR UPDATE ON inventory_agent_assignment_history FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 099_dev153_inventory_assignment_lifecycle.sql
DROP TRIGGER IF EXISTS "inventory_assignment_events_immutable" ON "inventory_assignment_events";
CREATE TRIGGER inventory_assignment_events_immutable BEFORE DELETE OR UPDATE ON inventory_assignment_events FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 099_dev153_inventory_assignment_lifecycle.sql
DROP TRIGGER IF EXISTS "inventory_assignment_expiry_changes_immutable" ON "inventory_assignment_expiry_changes";
CREATE TRIGGER inventory_assignment_expiry_changes_immutable BEFORE DELETE OR UPDATE ON inventory_assignment_expiry_changes FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 087_release4_dld_market_intelligence.sql
DROP TRIGGER IF EXISTS "market_snapshot_reviews_immutable" ON "inventory_market_intelligence_review_events";
CREATE TRIGGER market_snapshot_reviews_immutable BEFORE DELETE OR UPDATE ON inventory_market_intelligence_review_events FOR EACH ROW EXECUTE FUNCTION reject_market_snapshot_mutation();

-- 087_release4_dld_market_intelligence.sql
DROP TRIGGER IF EXISTS "market_snapshots_immutable" ON "inventory_market_intelligence_snapshots";
CREATE TRIGGER market_snapshots_immutable BEFORE DELETE OR UPDATE ON inventory_market_intelligence_snapshots FOR EACH ROW EXECUTE FUNCTION reject_market_snapshot_mutation();

-- 092_release3b_matching_completion.sql
DROP TRIGGER IF EXISTS "inventory_match_candidate_assessments_immutable" ON "inventory_match_candidate_assessments";
CREATE TRIGGER inventory_match_candidate_assessments_immutable BEFORE DELETE OR UPDATE ON inventory_match_candidate_assessments FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 076_release3b_match_decisions_and_feedback.sql
DROP TRIGGER IF EXISTS "inventory_match_decisions_immutable" ON "inventory_match_decisions";
CREATE TRIGGER inventory_match_decisions_immutable BEFORE DELETE OR UPDATE ON inventory_match_decisions FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 076_release3b_match_decisions_and_feedback.sql
DROP TRIGGER IF EXISTS "inventory_match_feedback_immutable" ON "inventory_match_feedback";
CREATE TRIGGER inventory_match_feedback_immutable BEFORE DELETE OR UPDATE ON inventory_match_feedback FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 075_release3b_governed_inventory_matching.sql
DROP TRIGGER IF EXISTS "inventory_matching_candidates_immutable" ON "inventory_matching_candidates";
CREATE TRIGGER inventory_matching_candidates_immutable BEFORE DELETE OR UPDATE ON inventory_matching_candidates FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 075_release3b_governed_inventory_matching.sql
DROP TRIGGER IF EXISTS "inventory_matching_runs_immutable" ON "inventory_matching_runs";
CREATE TRIGGER inventory_matching_runs_immutable BEFORE DELETE OR UPDATE ON inventory_matching_runs FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 084_partner_organization_integration.sql
DROP TRIGGER IF EXISTS "inventory_organization_link_events_append_only" ON "inventory_organization_link_events";
CREATE TRIGGER inventory_organization_link_events_append_only BEFORE DELETE OR UPDATE ON inventory_organization_link_events FOR EACH ROW EXECUTE FUNCTION prevent_inventory_organization_link_mutation();

-- 084_partner_organization_integration.sql
DROP TRIGGER IF EXISTS "inventory_organization_link_events_validate" ON "inventory_organization_link_events";
CREATE TRIGGER inventory_organization_link_events_validate BEFORE INSERT ON inventory_organization_link_events FOR EACH ROW EXECUTE FUNCTION validate_inventory_organization_link_event();

-- 077_release3b_requirement_confirmation.sql
DROP TRIGGER IF EXISTS "lead_requirement_confirmations_immutable" ON "lead_requirement_confirmations";
CREATE TRIGGER lead_requirement_confirmations_immutable BEFORE DELETE OR UPDATE ON lead_requirement_confirmations FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 077_release3b_requirement_confirmation.sql
DROP TRIGGER IF EXISTS "lead_requirement_conflict_resolutions_immutable" ON "lead_requirement_conflict_resolutions";
CREATE TRIGGER lead_requirement_conflict_resolutions_immutable BEFORE DELETE OR UPDATE ON lead_requirement_conflict_resolutions FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 077_release3b_requirement_confirmation.sql
DROP TRIGGER IF EXISTS "lead_requirement_website_conflicts_immutable" ON "lead_requirement_website_conflicts";
CREATE TRIGGER lead_requirement_website_conflicts_immutable BEFORE DELETE OR UPDATE ON lead_requirement_website_conflicts FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 060_consolidated_lead_opportunity_remediation.sql
DROP TRIGGER IF EXISTS "leads_assign_reference" ON "leads";
CREATE TRIGGER leads_assign_reference BEFORE INSERT ON leads FOR EACH ROW EXECUTE FUNCTION nysa_assign_lead_reference();

-- 138_terminal_lead_follow_up_cleanup.sql
DROP TRIGGER IF EXISTS "leads_close_follow_ups" ON "leads";
CREATE TRIGGER leads_close_follow_ups AFTER INSERT OR UPDATE OF stage, current_status ON leads FOR EACH ROW EXECUTE FUNCTION nysa_close_terminal_lead_follow_ups();

-- 009_acceptance_hardening.sql
DROP TRIGGER IF EXISTS "leads_stage_transition_guard" ON "leads";
CREATE TRIGGER leads_stage_transition_guard BEFORE UPDATE OF stage ON leads FOR EACH ROW EXECUTE FUNCTION enforce_lead_stage_transition();

-- 089_agent_employment_leave.sql
DROP TRIGGER IF EXISTS "leave_decision_no_self_approval" ON "leave_application_decisions";
CREATE TRIGGER leave_decision_no_self_approval BEFORE INSERT ON leave_application_decisions FOR EACH ROW EXECUTE FUNCTION prohibit_leave_self_approval();

-- 089_agent_employment_leave.sql
DROP TRIGGER IF EXISTS "leave_decisions_immutable" ON "leave_application_decisions";
CREATE TRIGGER leave_decisions_immutable BEFORE DELETE OR UPDATE ON leave_application_decisions FOR EACH ROW EXECUTE FUNCTION reject_leave_evidence_mutation();

-- 089_agent_employment_leave.sql
DROP TRIGGER IF EXISTS "leave_task_links_immutable" ON "leave_application_task_links";
CREATE TRIGGER leave_task_links_immutable BEFORE DELETE OR UPDATE ON leave_application_task_links FOR EACH ROW EXECUTE FUNCTION reject_leave_evidence_mutation();

-- 089_agent_employment_leave.sql
DROP TRIGGER IF EXISTS "leave_balance_immutable" ON "leave_balance_ledger";
CREATE TRIGGER leave_balance_immutable BEFORE DELETE OR UPDATE ON leave_balance_ledger FOR EACH ROW EXECUTE FUNCTION reject_leave_evidence_mutation();

-- 132_approved_documents_and_brand.sql
DROP TRIGGER IF EXISTS "listing_noc_evidence_immutable" ON "listing_noc_evidence_versions";
CREATE TRIGGER listing_noc_evidence_immutable BEFORE DELETE OR UPDATE ON listing_noc_evidence_versions FOR EACH ROW EXECUTE FUNCTION prevent_listing_noc_evidence_fact_mutation();

-- 091_release6_marketing_material_compliance.sql
DROP TRIGGER IF EXISTS "marketing_media_links_immutable" ON "marketing_material_media_links";
CREATE TRIGGER marketing_media_links_immutable BEFORE DELETE OR UPDATE ON marketing_material_media_links FOR EACH ROW EXECUTE FUNCTION reject_marketing_material_evidence_mutation();

-- 091_release6_marketing_material_compliance.sql
DROP TRIGGER IF EXISTS "marketing_official_links_immutable" ON "marketing_material_official_evidence_links";
CREATE TRIGGER marketing_official_links_immutable BEFORE DELETE OR UPDATE ON marketing_material_official_evidence_links FOR EACH ROW EXECUTE FUNCTION reject_marketing_material_evidence_mutation();

-- 091_release6_marketing_material_compliance.sql
DROP TRIGGER IF EXISTS "marketing_permit_snapshots_immutable" ON "marketing_material_permit_snapshots";
CREATE TRIGGER marketing_permit_snapshots_immutable BEFORE DELETE OR UPDATE ON marketing_material_permit_snapshots FOR EACH ROW EXECUTE FUNCTION reject_marketing_material_evidence_mutation();

-- 091_release6_marketing_material_compliance.sql
DROP TRIGGER IF EXISTS "marketing_review_events_immutable" ON "marketing_material_review_events";
CREATE TRIGGER marketing_review_events_immutable BEFORE DELETE OR UPDATE ON marketing_material_review_events FOR EACH ROW EXECUTE FUNCTION reject_marketing_material_evidence_mutation();

-- 091_release6_marketing_material_compliance.sql
DROP TRIGGER IF EXISTS "marketing_task_links_immutable" ON "marketing_material_task_links";
CREATE TRIGGER marketing_task_links_immutable BEFORE DELETE OR UPDATE ON marketing_material_task_links FOR EACH ROW EXECUTE FUNCTION reject_marketing_material_evidence_mutation();

-- 091_release6_marketing_material_compliance.sql
DROP TRIGGER IF EXISTS "marketing_material_version_guard" ON "marketing_material_versions";
CREATE TRIGGER marketing_material_version_guard BEFORE DELETE OR UPDATE ON marketing_material_versions FOR EACH ROW EXECUTE FUNCTION protect_marketing_material_version();

-- 076_release3b_match_decisions_and_feedback.sql
DROP TRIGGER IF EXISTS "matching_policy_versions_immutable" ON "matching_policy_versions";
CREATE TRIGGER matching_policy_versions_immutable BEFORE DELETE OR UPDATE ON matching_policy_versions FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 045_release2_offer_negotiation.sql
DROP TRIGGER IF EXISTS "negotiation_events_immutable" ON "negotiation_events";
CREATE TRIGGER negotiation_events_immutable BEFORE DELETE OR UPDATE ON negotiation_events FOR EACH ROW EXECUTE FUNCTION reject_negotiation_event_mutation();

-- 095_dev146_full_scope_uat_governance.sql
DROP TRIGGER IF EXISTS "offer_replacement_actions_immutable" ON "offer_replacement_actions";
CREATE TRIGGER offer_replacement_actions_immutable BEFORE DELETE OR UPDATE ON offer_replacement_actions FOR EACH ROW EXECUTE FUNCTION reject_offer_replacement_action_mutation();

-- 045_release2_offer_negotiation.sql
DROP TRIGGER IF EXISTS "offer_revisions_immutable" ON "offer_revisions";
CREATE TRIGGER offer_revisions_immutable BEFORE DELETE OR UPDATE ON offer_revisions FOR EACH ROW EXECUTE FUNCTION reject_offer_revision_mutation();

-- 136_uat_inventory_mandates_and_offer_acceptance.sql
DROP TRIGGER IF EXISTS "offers_bilateral_acceptance" ON "offers";
CREATE CONSTRAINT TRIGGER offers_bilateral_acceptance AFTER INSERT OR UPDATE OF accepted_revision_id ON offers DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ensure_bilateral_offer_acceptance();

-- 086_release4_official_document_evidence.sql
DROP TRIGGER IF EXISTS "official_document_review_immutable" ON "official_document_evidence_review_events";
CREATE TRIGGER official_document_review_immutable BEFORE DELETE OR UPDATE ON official_document_evidence_review_events FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 086_release4_official_document_evidence.sql
DROP TRIGGER IF EXISTS "official_document_evidence_immutable" ON "official_document_evidence_versions";
CREATE TRIGGER official_document_evidence_immutable BEFORE DELETE OR UPDATE ON official_document_evidence_versions FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 086_release4_official_document_evidence.sql
DROP TRIGGER IF EXISTS "official_document_task_link_immutable" ON "official_document_followup_task_links";
CREATE TRIGGER official_document_task_link_immutable BEFORE DELETE OR UPDATE ON official_document_followup_task_links FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 061_dev90_reference_and_status_governance.sql
DROP TRIGGER IF EXISTS "opportunities_sync_lead_status" ON "opportunities";
CREATE TRIGGER opportunities_sync_lead_status AFTER INSERT OR UPDATE OF stage ON opportunities FOR EACH ROW EXECUTE FUNCTION nysa_opportunity_sync_lead_status();

-- 039_release2_connected_operations.sql
DROP TRIGGER IF EXISTS "opportunity_assignment_history_immutable" ON "opportunity_assignment_history";
CREATE TRIGGER opportunity_assignment_history_immutable BEFORE DELETE OR UPDATE ON opportunity_assignment_history FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 038_release2_opportunity_foundation.sql
DROP TRIGGER IF EXISTS "opportunity_attribution_immutable" ON "opportunity_attribution";
CREATE TRIGGER opportunity_attribution_immutable BEFORE DELETE OR UPDATE ON opportunity_attribution FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 085_release3c_governed_share_response.sql
DROP TRIGGER IF EXISTS "opportunity_property_share_events_immutable" ON "opportunity_property_share_events";
CREATE TRIGGER opportunity_property_share_events_immutable BEFORE DELETE OR UPDATE ON opportunity_property_share_events FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 085_release3c_governed_share_response.sql
DROP TRIGGER IF EXISTS "opportunity_property_share_items_governed_immutable" ON "opportunity_property_share_items";
CREATE TRIGGER opportunity_property_share_items_governed_immutable BEFORE DELETE OR UPDATE ON opportunity_property_share_items FOR EACH ROW EXECUTE FUNCTION prevent_governed_property_share_item_mutation();

-- 085_release3c_governed_share_response.sql
DROP TRIGGER IF EXISTS "opportunity_property_shares_governed_immutable_facts" ON "opportunity_property_shares";
CREATE TRIGGER opportunity_property_shares_governed_immutable_facts BEFORE UPDATE ON opportunity_property_shares FOR EACH ROW EXECUTE FUNCTION prevent_governed_property_share_fact_mutation();

-- 038_release2_opportunity_foundation.sql
DROP TRIGGER IF EXISTS "opportunity_stage_history_immutable" ON "opportunity_stage_history";
CREATE TRIGGER opportunity_stage_history_immutable BEFORE DELETE OR UPDATE ON opportunity_stage_history FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 084_partner_organization_integration.sql
DROP TRIGGER IF EXISTS "partner_organization_versions_immutable_facts" ON "partner_organization_versions";
CREATE TRIGGER partner_organization_versions_immutable_facts BEFORE UPDATE ON partner_organization_versions FOR EACH ROW EXECUTE FUNCTION prevent_partner_organization_fact_mutation();

-- 098_developer_arrangement_and_listing_noc.sql
DROP TRIGGER IF EXISTS "property_listing_noc_immutable" ON "property_listing_noc_versions";
CREATE TRIGGER property_listing_noc_immutable BEFORE DELETE OR UPDATE ON property_listing_noc_versions FOR EACH ROW EXECUTE FUNCTION prevent_property_listing_noc_fact_mutation();

-- 092_release3b_matching_completion.sql
DROP TRIGGER IF EXISTS "property_match_governed_origins_immutable" ON "property_match_governed_origins";
CREATE TRIGGER property_match_governed_origins_immutable BEFORE DELETE OR UPDATE ON property_match_governed_origins FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 040_release2_matching_viewing.sql
DROP TRIGGER IF EXISTS "property_match_history_immutable" ON "property_match_history";
CREATE TRIGGER property_match_history_immutable BEFORE DELETE OR UPDATE ON property_match_history FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- 138_terminal_lead_follow_up_cleanup.sql
DROP TRIGGER IF EXISTS "tasks_terminal_lead_follow_up_audit" ON "tasks";
CREATE TRIGGER tasks_terminal_lead_follow_up_audit AFTER INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION nysa_audit_terminal_lead_follow_up();

-- 138_terminal_lead_follow_up_cleanup.sql
DROP TRIGGER IF EXISTS "tasks_terminal_lead_follow_up_guard" ON "tasks";
CREATE TRIGGER tasks_terminal_lead_follow_up_guard BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION nysa_guard_terminal_lead_follow_up();

-- 040_release2_matching_viewing.sql
DROP TRIGGER IF EXISTS "viewing_status_history_immutable" ON "viewing_status_history";
CREATE TRIGGER viewing_status_history_immutable BEFORE DELETE OR UPDATE ON viewing_status_history FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

DO $trigger_contract$
DECLARE
  missing_count INTEGER;
  unexpected_count INTEGER;
  disabled_count INTEGER;
  wrong_function_count INTEGER;
BEGIN
  WITH expected(table_name,trigger_name,function_name,enabled) AS (VALUES
    ('agent_payout_adjustment_slabs','agent_adjustment_slabs_draft_only','protect_payout_configuration','O'),
    ('agent_payout_adjustment_versions','agent_adjustment_no_overlap','prevent_active_payout_overlap','O'),
    ('agent_payout_adjustment_versions','agent_adjustment_validate_slabs','validate_commission_slab_set','O'),
    ('agent_payout_advices','protect_agent_payout_advice_evidence','protect_agent_payout_advice_evidence','O'),
    ('agent_payout_calculation_bands','payout_bands_immutable','reject_immutable_finance_mutation','O'),
    ('agent_payout_decision_events','payout_decisions_immutable','reject_immutable_finance_mutation','O'),
    ('agent_payout_release_events','payout_releases_immutable','reject_immutable_finance_mutation','O'),
    ('agent_social_media_payout_status_versions','agent_social_media_status_no_overlap','prevent_agent_social_media_status_overlap','O'),
    ('booking_reservation_extensions','booking_reservation_extensions_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('booking_status_history','booking_status_history_immutable','reject_booking_history_mutation','O'),
    ('bookings','bookings_bilateral_acceptance','ensure_bilateral_offer_acceptance','O'),
    ('bookings','bookings_reservation_expiry_policy','enforce_booking_reservation_expiry_policy','O'),
    ('calendly_projection_events','calendly_projection_events_immutable','prevent_calendly_evidence_mutation','O'),
    ('calendly_provider_event_processing','calendly_provider_event_processing_immutable','prevent_calendly_evidence_mutation','O'),
    ('calendly_provider_events','calendly_provider_events_immutable','prevent_calendly_evidence_mutation','O'),
    ('commission_payout_policy_slabs','commission_policy_slabs_draft_only','protect_payout_configuration','O'),
    ('commission_payout_policy_versions','commission_policy_no_overlap','prevent_active_payout_overlap','O'),
    ('commission_payout_policy_versions','commission_policy_validate_slabs','validate_commission_slab_set','O'),
    ('commission_receivable_adjustment_requests','receivable_adjustment_protection','protect_receivable_adjustment_request','O'),
    ('commission_receivable_collections','receivable_collection_link','validate_receivable_receipt_link','O'),
    ('commission_receivable_collections','receivable_collections_immutable','reject_immutable_finance_mutation','O'),
    ('commission_receivable_invoices','receivable_invoice_protection','protect_commission_receivable_invoice','O'),
    ('commission_receivable_requests','receivable_requests_immutable','reject_immutable_finance_mutation','O'),
    ('commission_receivable_reversals','receivable_reversal_link','validate_receivable_receipt_link','O'),
    ('commission_receivable_reversals','receivable_reversals_immutable','reject_immutable_finance_mutation','O'),
    ('commission_receivable_schedules','receivable_schedules_immutable','reject_immutable_finance_mutation','O'),
    ('communication_policy_decisions','communication_policy_decisions_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('customer_response_task_provenance','customer_response_task_provenance_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('deal_agent_credit_lines','deal_agent_credit_lines_immutable','reject_immutable_finance_mutation','O'),
    ('deal_commission_expectation_components','commission_expectation_components_immutable','reject_immutable_finance_mutation','O'),
    ('deal_commission_proofs','commission_proofs_immutable','reject_immutable_finance_mutation','O'),
    ('deal_commission_proofs','proof_opportunity','validate_finance_opportunity','O'),
    ('deal_commission_receipt_confirmations','commission_confirmations_immutable','protect_commission_confirmation_evidence','O'),
    ('deal_commission_receipt_confirmations','confirmation_opportunity','validate_finance_opportunity','O'),
    ('deal_commission_receipts','commission_receipts_immutable','reject_immutable_finance_mutation','O'),
    ('deal_commission_receipts','receipt_changes_supersede_confirmation','supersede_changed_receipt_confirmation','O'),
    ('deal_commission_receipts','receipt_opportunity','validate_finance_opportunity','O'),
    ('deal_commission_variance_decisions','commission_variance_decisions_immutable','reject_immutable_finance_mutation','O'),
    ('deal_document_requirement_instances','deal_document_requirement_instances_immutable','reject_document_compliance_evidence_mutation','O'),
    ('deal_inventory_linkages','deal_inventory_linkages_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('deal_status_history','deal_status_history_immutable','reject_deal_status_history_mutation','O'),
    ('deals','deals_bilateral_acceptance','ensure_bilateral_offer_acceptance','O'),
    ('deals','deals_current_inventory_linkage_consistency','enforce_deal_current_inventory_linkage','O'),
    ('developer_brokerage_arrangement_versions','developer_arrangement_immutable','prevent_developer_arrangement_fact_mutation','O'),
    ('dld_market_observations','dld_observations_immutable','enforce_dld_observation_immutability','O'),
    ('dld_market_source_rows','dld_source_rows_immutable','reject_dld_source_row_mutation','O'),
    ('document_compliance_evidence_review_events','document_compliance_reviews_immutable','reject_document_compliance_evidence_mutation','O'),
    ('document_compliance_evidence_versions','document_compliance_evidence_immutable','reject_document_compliance_evidence_mutation','O'),
    ('document_compliance_followup_task_links','document_compliance_task_links_immutable','reject_document_compliance_evidence_mutation','O'),
    ('document_compliance_official_evidence_links','document_compliance_official_links_immutable','reject_document_compliance_evidence_mutation','O'),
    ('email_message_evidence','email_message_evidence_immutable','prevent_email_integration_evidence_mutation','O'),
    ('email_message_state_events','email_message_state_events_immutable','prevent_email_integration_evidence_mutation','O'),
    ('email_projection_events','email_projection_events_immutable','prevent_email_integration_evidence_mutation','O'),
    ('email_provider_event_processing','email_provider_event_processing_immutable','prevent_email_integration_evidence_mutation','O'),
    ('email_provider_events','email_provider_events_immutable','prevent_email_integration_evidence_mutation','O'),
    ('external_listing_preparation_versions','external_listing_preparation_versions_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('external_portal_permit_evidence_versions','external_portal_permit_evidence_versions_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('inventory_agent_assignment_history','inventory_agent_assignment_history_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('inventory_assignment_events','inventory_assignment_events_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('inventory_assignment_expiry_changes','inventory_assignment_expiry_changes_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('inventory_market_intelligence_review_events','market_snapshot_reviews_immutable','reject_market_snapshot_mutation','O'),
    ('inventory_market_intelligence_snapshots','market_snapshots_immutable','reject_market_snapshot_mutation','O'),
    ('inventory_match_candidate_assessments','inventory_match_candidate_assessments_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('inventory_match_decisions','inventory_match_decisions_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('inventory_match_feedback','inventory_match_feedback_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('inventory_matching_candidates','inventory_matching_candidates_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('inventory_matching_runs','inventory_matching_runs_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('inventory_organization_link_events','inventory_organization_link_events_append_only','prevent_inventory_organization_link_mutation','O'),
    ('inventory_organization_link_events','inventory_organization_link_events_validate','validate_inventory_organization_link_event','O'),
    ('lead_requirement_confirmations','lead_requirement_confirmations_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('lead_requirement_conflict_resolutions','lead_requirement_conflict_resolutions_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('lead_requirement_website_conflicts','lead_requirement_website_conflicts_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('leads','leads_assign_reference','nysa_assign_lead_reference','O'),
    ('leads','leads_close_follow_ups','nysa_close_terminal_lead_follow_ups','O'),
    ('leads','leads_stage_transition_guard','enforce_lead_stage_transition','O'),
    ('leave_application_decisions','leave_decision_no_self_approval','prohibit_leave_self_approval','O'),
    ('leave_application_decisions','leave_decisions_immutable','reject_leave_evidence_mutation','O'),
    ('leave_application_task_links','leave_task_links_immutable','reject_leave_evidence_mutation','O'),
    ('leave_balance_ledger','leave_balance_immutable','reject_leave_evidence_mutation','O'),
    ('listing_noc_evidence_versions','listing_noc_evidence_immutable','prevent_listing_noc_evidence_fact_mutation','O'),
    ('marketing_material_media_links','marketing_media_links_immutable','reject_marketing_material_evidence_mutation','O'),
    ('marketing_material_official_evidence_links','marketing_official_links_immutable','reject_marketing_material_evidence_mutation','O'),
    ('marketing_material_permit_snapshots','marketing_permit_snapshots_immutable','reject_marketing_material_evidence_mutation','O'),
    ('marketing_material_review_events','marketing_review_events_immutable','reject_marketing_material_evidence_mutation','O'),
    ('marketing_material_task_links','marketing_task_links_immutable','reject_marketing_material_evidence_mutation','O'),
    ('marketing_material_versions','marketing_material_version_guard','protect_marketing_material_version','O'),
    ('matching_policy_versions','matching_policy_versions_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('negotiation_events','negotiation_events_immutable','reject_negotiation_event_mutation','O'),
    ('offer_replacement_actions','offer_replacement_actions_immutable','reject_offer_replacement_action_mutation','O'),
    ('offer_revisions','offer_revisions_immutable','reject_offer_revision_mutation','O'),
    ('offers','offers_bilateral_acceptance','ensure_bilateral_offer_acceptance','O'),
    ('official_document_evidence_review_events','official_document_review_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('official_document_evidence_versions','official_document_evidence_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('official_document_followup_task_links','official_document_task_link_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('opportunities','opportunities_sync_lead_status','nysa_opportunity_sync_lead_status','O'),
    ('opportunity_assignment_history','opportunity_assignment_history_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('opportunity_attribution','opportunity_attribution_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('opportunity_property_share_events','opportunity_property_share_events_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('opportunity_property_share_items','opportunity_property_share_items_governed_immutable','prevent_governed_property_share_item_mutation','O'),
    ('opportunity_property_shares','opportunity_property_shares_governed_immutable_facts','prevent_governed_property_share_fact_mutation','O'),
    ('opportunity_stage_history','opportunity_stage_history_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('partner_organization_versions','partner_organization_versions_immutable_facts','prevent_partner_organization_fact_mutation','O'),
    ('property_listing_noc_versions','property_listing_noc_immutable','prevent_property_listing_noc_fact_mutation','O'),
    ('property_match_governed_origins','property_match_governed_origins_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('property_match_history','property_match_history_immutable','prevent_release2_immutable_evidence_mutation','O'),
    ('tasks','tasks_terminal_lead_follow_up_audit','nysa_audit_terminal_lead_follow_up','O'),
    ('tasks','tasks_terminal_lead_follow_up_guard','nysa_guard_terminal_lead_follow_up','O'),
    ('viewing_status_history','viewing_status_history_immutable','prevent_release2_immutable_evidence_mutation','O')
  ),actual AS (
    SELECT c.relname AS table_name,t.tgname AS trigger_name,p.proname AS function_name,t.tgenabled AS enabled
      FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_proc p ON p.oid=t.tgfoid
     WHERE NOT t.tgisinternal AND n.nspname=current_schema()
  )
  SELECT COUNT(*) FILTER(WHERE a.trigger_name IS NULL),
         COUNT(*) FILTER(WHERE a.trigger_name IS NOT NULL AND a.enabled<>e.enabled),
         COUNT(*) FILTER(WHERE a.trigger_name IS NOT NULL AND a.function_name<>e.function_name)
    INTO missing_count,disabled_count,wrong_function_count
    FROM expected e LEFT JOIN actual a USING(table_name,trigger_name);

  WITH expected(table_name,trigger_name) AS (VALUES
    ('agent_payout_adjustment_slabs','agent_adjustment_slabs_draft_only'),
    ('agent_payout_adjustment_versions','agent_adjustment_no_overlap'),
    ('agent_payout_adjustment_versions','agent_adjustment_validate_slabs'),
    ('agent_payout_advices','protect_agent_payout_advice_evidence'),
    ('agent_payout_calculation_bands','payout_bands_immutable'),
    ('agent_payout_decision_events','payout_decisions_immutable'),
    ('agent_payout_release_events','payout_releases_immutable'),
    ('agent_social_media_payout_status_versions','agent_social_media_status_no_overlap'),
    ('booking_reservation_extensions','booking_reservation_extensions_immutable'),
    ('booking_status_history','booking_status_history_immutable'),
    ('bookings','bookings_bilateral_acceptance'),
    ('bookings','bookings_reservation_expiry_policy'),
    ('calendly_projection_events','calendly_projection_events_immutable'),
    ('calendly_provider_event_processing','calendly_provider_event_processing_immutable'),
    ('calendly_provider_events','calendly_provider_events_immutable'),
    ('commission_payout_policy_slabs','commission_policy_slabs_draft_only'),
    ('commission_payout_policy_versions','commission_policy_no_overlap'),
    ('commission_payout_policy_versions','commission_policy_validate_slabs'),
    ('commission_receivable_adjustment_requests','receivable_adjustment_protection'),
    ('commission_receivable_collections','receivable_collection_link'),
    ('commission_receivable_collections','receivable_collections_immutable'),
    ('commission_receivable_invoices','receivable_invoice_protection'),
    ('commission_receivable_requests','receivable_requests_immutable'),
    ('commission_receivable_reversals','receivable_reversal_link'),
    ('commission_receivable_reversals','receivable_reversals_immutable'),
    ('commission_receivable_schedules','receivable_schedules_immutable'),
    ('communication_policy_decisions','communication_policy_decisions_immutable'),
    ('customer_response_task_provenance','customer_response_task_provenance_immutable'),
    ('deal_agent_credit_lines','deal_agent_credit_lines_immutable'),
    ('deal_commission_expectation_components','commission_expectation_components_immutable'),
    ('deal_commission_proofs','commission_proofs_immutable'),
    ('deal_commission_proofs','proof_opportunity'),
    ('deal_commission_receipt_confirmations','commission_confirmations_immutable'),
    ('deal_commission_receipt_confirmations','confirmation_opportunity'),
    ('deal_commission_receipts','commission_receipts_immutable'),
    ('deal_commission_receipts','receipt_changes_supersede_confirmation'),
    ('deal_commission_receipts','receipt_opportunity'),
    ('deal_commission_variance_decisions','commission_variance_decisions_immutable'),
    ('deal_document_requirement_instances','deal_document_requirement_instances_immutable'),
    ('deal_inventory_linkages','deal_inventory_linkages_immutable'),
    ('deal_status_history','deal_status_history_immutable'),
    ('deals','deals_bilateral_acceptance'),
    ('deals','deals_current_inventory_linkage_consistency'),
    ('developer_brokerage_arrangement_versions','developer_arrangement_immutable'),
    ('dld_market_observations','dld_observations_immutable'),
    ('dld_market_source_rows','dld_source_rows_immutable'),
    ('document_compliance_evidence_review_events','document_compliance_reviews_immutable'),
    ('document_compliance_evidence_versions','document_compliance_evidence_immutable'),
    ('document_compliance_followup_task_links','document_compliance_task_links_immutable'),
    ('document_compliance_official_evidence_links','document_compliance_official_links_immutable'),
    ('email_message_evidence','email_message_evidence_immutable'),
    ('email_message_state_events','email_message_state_events_immutable'),
    ('email_projection_events','email_projection_events_immutable'),
    ('email_provider_event_processing','email_provider_event_processing_immutable'),
    ('email_provider_events','email_provider_events_immutable'),
    ('external_listing_preparation_versions','external_listing_preparation_versions_immutable'),
    ('external_portal_permit_evidence_versions','external_portal_permit_evidence_versions_immutable'),
    ('inventory_agent_assignment_history','inventory_agent_assignment_history_immutable'),
    ('inventory_assignment_events','inventory_assignment_events_immutable'),
    ('inventory_assignment_expiry_changes','inventory_assignment_expiry_changes_immutable'),
    ('inventory_market_intelligence_review_events','market_snapshot_reviews_immutable'),
    ('inventory_market_intelligence_snapshots','market_snapshots_immutable'),
    ('inventory_match_candidate_assessments','inventory_match_candidate_assessments_immutable'),
    ('inventory_match_decisions','inventory_match_decisions_immutable'),
    ('inventory_match_feedback','inventory_match_feedback_immutable'),
    ('inventory_matching_candidates','inventory_matching_candidates_immutable'),
    ('inventory_matching_runs','inventory_matching_runs_immutable'),
    ('inventory_organization_link_events','inventory_organization_link_events_append_only'),
    ('inventory_organization_link_events','inventory_organization_link_events_validate'),
    ('lead_requirement_confirmations','lead_requirement_confirmations_immutable'),
    ('lead_requirement_conflict_resolutions','lead_requirement_conflict_resolutions_immutable'),
    ('lead_requirement_website_conflicts','lead_requirement_website_conflicts_immutable'),
    ('leads','leads_assign_reference'),
    ('leads','leads_close_follow_ups'),
    ('leads','leads_stage_transition_guard'),
    ('leave_application_decisions','leave_decision_no_self_approval'),
    ('leave_application_decisions','leave_decisions_immutable'),
    ('leave_application_task_links','leave_task_links_immutable'),
    ('leave_balance_ledger','leave_balance_immutable'),
    ('listing_noc_evidence_versions','listing_noc_evidence_immutable'),
    ('marketing_material_media_links','marketing_media_links_immutable'),
    ('marketing_material_official_evidence_links','marketing_official_links_immutable'),
    ('marketing_material_permit_snapshots','marketing_permit_snapshots_immutable'),
    ('marketing_material_review_events','marketing_review_events_immutable'),
    ('marketing_material_task_links','marketing_task_links_immutable'),
    ('marketing_material_versions','marketing_material_version_guard'),
    ('matching_policy_versions','matching_policy_versions_immutable'),
    ('negotiation_events','negotiation_events_immutable'),
    ('offer_replacement_actions','offer_replacement_actions_immutable'),
    ('offer_revisions','offer_revisions_immutable'),
    ('offers','offers_bilateral_acceptance'),
    ('official_document_evidence_review_events','official_document_review_immutable'),
    ('official_document_evidence_versions','official_document_evidence_immutable'),
    ('official_document_followup_task_links','official_document_task_link_immutable'),
    ('opportunities','opportunities_sync_lead_status'),
    ('opportunity_assignment_history','opportunity_assignment_history_immutable'),
    ('opportunity_attribution','opportunity_attribution_immutable'),
    ('opportunity_property_share_events','opportunity_property_share_events_immutable'),
    ('opportunity_property_share_items','opportunity_property_share_items_governed_immutable'),
    ('opportunity_property_shares','opportunity_property_shares_governed_immutable_facts'),
    ('opportunity_stage_history','opportunity_stage_history_immutable'),
    ('partner_organization_versions','partner_organization_versions_immutable_facts'),
    ('property_listing_noc_versions','property_listing_noc_immutable'),
    ('property_match_governed_origins','property_match_governed_origins_immutable'),
    ('property_match_history','property_match_history_immutable'),
    ('tasks','tasks_terminal_lead_follow_up_audit'),
    ('tasks','tasks_terminal_lead_follow_up_guard'),
    ('viewing_status_history','viewing_status_history_immutable')
  ),actual AS (
    SELECT c.relname AS table_name,t.tgname AS trigger_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE NOT t.tgisinternal AND n.nspname=current_schema()
  )
  SELECT COUNT(*) INTO unexpected_count
    FROM actual a LEFT JOIN expected e USING(table_name,trigger_name)
   WHERE e.trigger_name IS NULL;

  IF missing_count<>0 OR unexpected_count<>0 OR disabled_count<>0 OR wrong_function_count<>0 THEN
    RAISE EXCEPTION 'Governed trigger contract mismatch: missing %, unexpected %, disabled %, wrong function %',
      missing_count,unexpected_count,disabled_count,wrong_function_count;
  END IF;

  IF (SELECT COUNT(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE NOT t.tgisinternal AND n.nspname=current_schema())<>108 THEN
    RAISE EXCEPTION 'Governed trigger count mismatch: expected 108';
  END IF;
END
$trigger_contract$;
