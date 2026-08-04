# NYSA CRM Project Documents

These documents are the durable source of truth for product, engineering, and
production decisions. Update them in the same commit as the change they
describe.

## Start Here

- [Current status](CURRENT_STATUS.md) - live state, latest verification, and next action
- [Product requirements](PRODUCT_REQUIREMENTS.md) - approved business scope and requirements
- [Release 2.1A CRM Test plan](RELEASE_2_1A_TEST_PLAN.md) - connected Agent/Manager flow, coordinated reassignment and reconciliation acceptance
- [Roadmap](ROADMAP.md) - phased delivery sequence
- [Planned enhancements](PLANNED_ENHANCEMENTS.md) - approved planning inputs not yet implemented
- [Decisions](DECISIONS.md) - approved decisions and unresolved items

## Design and Delivery

- [Architecture](ARCHITECTURE.md) - current system and planned module boundaries
- [Data model](DATA_MODEL.md) - current schema and planned entities
- [Permissions matrix](PERMISSIONS_MATRIX.md) - role-based access policy
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md) - release-one definition of done
- [Release 1 acceptance status](RELEASE_1_ACCEPTANCE_STATUS.md) - criterion-by-criterion verification state
- [Release 1 test findings](RELEASE_1_TEST_FINDINGS.md) - numbered manual UAT findings, corrections, and retest conditions
- [Release 1.1 scope](RELEASE_1_1_SCOPE.md) - Listing Executive workspace and inventory-intake definition of done
- [Release 1.1 customer/lifecycle CRM Test deployment](CRM_TEST_R1_1_CUSTOMER_LIFECYCLE_DEPLOYMENT.md) - cPanel deployment and retest instructions for R1.1-AMD-008 and R1.1-AMD-009
- [Release 1.1 listing-intake CRM Test deployment](CRM_TEST_R1_1_LISTING_INTAKE_DEPLOYMENT.md) - cPanel deployment and retest instructions for R1.1-AMD-013
- [Release 1.1 provider-mapping CRM Test deployment](CRM_TEST_R1_1_PROVIDER_MAPPING_DEPLOYMENT.md) - cPanel deployment and retest instructions for R1.1-AMD-014
- [Release 1.1 Agent lifecycle CRM Test deployment](CRM_TEST_R1_1_AGENT_LIFECYCLE_DEPLOYMENT.md) - cPanel deployment and retest instructions for R1.1-AMD-016
- [Release 1.1 production candidate](PRODUCTION_R1_1_RELEASE_CANDIDATE.md) - held production-candidate identity and promotion gates
- [Release 2 scope](RELEASE_2_SCOPE.md) - reconciled Opportunity and Deal Pipeline design, compatibility boundary, delivery slices, acceptance baseline and approval gates
- [Requirements review log](REQUIREMENTS_REVIEW_LOG.md) - gaps found during field and label review
- [Deployment runbook](DEPLOYMENT_RUNBOOK.md) - production release and recovery procedure
- [Deployment history](DEPLOYMENT_HISTORY.md) - exact deployed commits, hotfixes, and verification evidence
- [Governed AI assistance REST API](AI_ASSISTANCE_REST_API.md) - advisory requirement extraction, match explanation and missing-information contracts

## Working Agreement

1. `main` represents the latest approved source.
2. `docs/CURRENT_STATUS.md` is updated at every material checkpoint.
3. Decisions that affect scope, architecture, security, or data are recorded in
   `docs/DECISIONS.md`.
4. Applied database migrations are never edited. Add a new numbered migration.
5. Credentials, customer data, identity documents, database dumps, generated
   customer proposals, logs, and temporary files never enter Git.
6. Every agreed UAT correction records an Amendment ID, related finding, agreed
   requirement, status and retest condition; no finding closes before CRM Test
   deployment and explicit user confirmation.
