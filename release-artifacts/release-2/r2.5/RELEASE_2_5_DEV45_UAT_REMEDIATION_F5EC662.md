# R2.5 dev.45 CRM Test remediation

- Source commit: `f5ec662`
- Version: `2.0.0-dev.45`
- Expected current CRM Test version: `2.0.0-dev.44`
- Expected migration baseline after installation: `050_release2_customer_kyc_uat_corrections.sql`
- Database migration: none; this is a code-only correction
- Automated tests: `208/208` passed

This package is restricted to CRM Test. It does not target Production or the frozen Release 1.1 candidate.

## Upload

Upload the ZIP, checksum file, and installer into the same cPanel home directory.

## Installation

Verify health first and capture the current CRM Test PID. Load the existing CRM Test application database credentials, then run:

```bash
sed -i 's/\r$//' nysa-core-r2-5-uat-remediation-dev45-f5ec662.sha256.txt
sed -i 's/\r$//' deploy-crm-test-r2-5-dev45-f5ec662.sh
sha256sum -c nysa-core-r2-5-uat-remediation-dev45-f5ec662.sha256.txt
```

```bash
bash deploy-crm-test-r2-5-dev45-f5ec662.sh \
./nysa-core-r2-5-uat-remediation-dev45-f5ec662.zip
```

Restart only CRM Test. Confirm health first, then confirm that a new PID replaced the old PID. Finally verify application version `2.0.0-dev.45` and migration baseline `050_release2_customer_kyc_uat_corrections.sql`.

## Retest focus

1. Missing seller/landlord prevents Manager checklist completion.
2. The missing party remains editable until closure approval.
3. Manager can approve, return for correction, or reject.
4. Inventory selected on the Lead appears as an actual Opportunity property match.
5. `+ Add Lead` opens without a false selected-customer scope error.
6. Saving value evidence remains in the Lead workflow.
7. Viewing invitation contains representative phone and email.
8. Inventory and external listing publication readiness are described separately.
