-- Migration: 117_transaction_completion_documents.sql
-- Transaction completion documents apply to the transaction itself and do not
-- require a buyer, seller, landlord or tenant master record.

ALTER TABLE document_compliance_requirement_versions
  DROP CONSTRAINT document_compliance_requirement_versions_party_role_check,
  DROP CONSTRAINT document_compliance_requirement_versions_party_kind_check;

ALTER TABLE document_compliance_requirement_versions
  ADD CONSTRAINT document_compliance_requirement_versions_party_role_check
    CHECK(party_role IN('transaction','buyer','seller','landlord','tenant')),
  ADD CONSTRAINT document_compliance_requirement_versions_party_kind_check
    CHECK(party_kind IN('transaction','individual','organization')),
  ADD CONSTRAINT document_compliance_requirement_versions_scope_check
    CHECK((party_role='transaction' AND party_kind='transaction') OR
          (party_role<>'transaction' AND party_kind<>'transaction'));

ALTER TABLE deal_document_requirement_instances
  ALTER COLUMN deal_party_id DROP NOT NULL,
  DROP CONSTRAINT deal_document_requirement_instances_party_role_check,
  DROP CONSTRAINT deal_document_requirement_instances_party_kind_check;

ALTER TABLE deal_document_requirement_instances
  ADD CONSTRAINT deal_document_requirement_instances_party_role_check
    CHECK(party_role IN('transaction','buyer','seller','landlord','tenant')),
  ADD CONSTRAINT deal_document_requirement_instances_party_kind_check
    CHECK(party_kind IN('transaction','individual','organization')),
  ADD CONSTRAINT deal_document_requirement_instances_scope_check
    CHECK((party_role='transaction' AND party_kind='transaction' AND deal_party_id IS NULL) OR
          (party_role<>'transaction' AND party_kind<>'transaction' AND deal_party_id IS NOT NULL));

CREATE UNIQUE INDEX deal_document_requirement_transaction_instance_uq
  ON deal_document_requirement_instances(snapshot_id,requirement_version_id)
  WHERE deal_party_id IS NULL;

GRANT SELECT,INSERT,UPDATE ON document_compliance_requirement_versions TO nysareal_nysar2app;
GRANT SELECT,INSERT ON deal_document_requirement_instances TO nysareal_nysar2app;
