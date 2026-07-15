# NYSA CRM Project Documents

These documents are the durable source of truth for product, engineering, and
production decisions. Update them in the same commit as the change they
describe.

## Start Here

- [Current status](CURRENT_STATUS.md) - live state, latest verification, and next action
- [Product requirements](PRODUCT_REQUIREMENTS.md) - approved business scope and requirements
- [Roadmap](ROADMAP.md) - phased delivery sequence
- [Decisions](DECISIONS.md) - approved decisions and unresolved items

## Design and Delivery

- [Architecture](ARCHITECTURE.md) - current system and planned module boundaries
- [Data model](DATA_MODEL.md) - current schema and planned entities
- [Permissions matrix](PERMISSIONS_MATRIX.md) - role-based access policy
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md) - release-one definition of done
- [Release 1.1 scope](RELEASE_1_1_SCOPE.md) - Listing Executive workspace and inventory-intake definition of done
- [Requirements review log](REQUIREMENTS_REVIEW_LOG.md) - gaps found during field and label review
- [Deployment runbook](DEPLOYMENT_RUNBOOK.md) - production release and recovery procedure
- [Deployment history](DEPLOYMENT_HISTORY.md) - exact deployed commits, hotfixes, and verification evidence

## Working Agreement

1. `main` represents the latest approved source.
2. `docs/CURRENT_STATUS.md` is updated at every material checkpoint.
3. Decisions that affect scope, architecture, security, or data are recorded in
   `docs/DECISIONS.md`.
4. Applied database migrations are never edited. Add a new numbered migration.
5. Credentials, customer data, identity documents, database dumps, generated
   customer proposals, logs, and temporary files never enter Git.
