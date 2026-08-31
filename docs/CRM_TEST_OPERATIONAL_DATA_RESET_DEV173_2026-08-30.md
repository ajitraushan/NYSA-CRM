# CRM Test operational data reset — dev.173

**Executed:** 30 August 2026  
**Target:** CRM Test only  
**Application:** `2.1.0-dev.173`  
**Database:** `nysareal_nysa_r2_rehearsal`  
**Migration state:** `107_dev169_versioned_opportunity_stage_drafts.sql` (`107` total)  
**Production, R2 and Property Finder:** excluded

## Purpose and boundary

This procedure removes CRM Test operational/business records while retaining Administration and Maintenance
configuration. It is version-bound and fails closed unless the CRM Test application root, database, application
version, migration state and single-worker identity match the expected dev.173 environment.

The protected set contains 65 tables covering:

- users, invitations, access roles, teams, memberships, area assignments, sessions and password-reset maintenance;
- company profile, controlled values, workflow transitions, areas, SLA policies and routing rules;
- qualification, regulatory-fee, matching, listing-mapping and external-portal mapping versions;
- proposal, document, checklist, official-document and compliance configuration;
- dashboard targets and saved dashboard views;
- property-media and listing approval policies;
- classification catalogue and market-community reference configuration;
- commission, employment and leave-policy maintenance;
- integration connection and mapping configuration; and
- the schema migration ledger.

All other public tables are selected automatically as operational data for this exact schema. This includes
Customers/Contacts and Companies, Inventory/Listings and media, Leads and intake history, Opportunities and stage
drafts, tasks and activities, matches and assignments, Viewings, Proposals, Offers and Negotiations, Bookings and
reservations, Deals and compliance evidence, operational documents, audit entries, integration events, marketing
materials, leave applications and payout calculations. Number-counter tables are also reset.

Classification legacy exceptions are operational because they reference Leads. DLD source batches, rows and
observations are operational because their evidence references operational Documents and Document Versions. The
reusable classification catalogue and market-community mappings remain protected.

The authoritative table lists are emitted for every run as `preserved-tables.txt` and `purged-tables.txt`.

## Guarded procedure

Authoritative script:

`release-artifacts/maintenance/reset-crm-test-operational-data-dev173.sh`

SHA-256:

`26d28c7dcfadca8cf1026853aec6a9bcc1710542298cfcf06589b710f3a7a005`

The installed server copy is `/home/nysareal/reset-crm-test-operational-data-dev173.sh` and was observed with the
same checksum.

### 1. Upload and protect the script

```bash
chmod 700 /home/nysareal/reset-crm-test-operational-data-dev173.sh
```

### 2. Run the default dry-run

```bash
cd /home/nysareal
./reset-crm-test-operational-data-dev173.sh
```

The default mode performs no deletion. Review the printed database, version, migration, worker, protected-table and
operational-row observations. Inspect the emitted `before-operational-counts.txt`, `preserved-tables.txt` and
`purged-tables.txt` in the evidence directory. The run fails if a protected table is absent or depends on a table
selected for purge.

### 3. Execute with the exact destructive token

```bash
cd /home/nysareal
./reset-crm-test-operational-data-dev173.sh EXECUTE_CRM_TEST_OPERATIONAL_RESET
```

Before deletion, the script creates:

- a complete custom-format PostgreSQL backup (`pre-reset-full.dump`);
- a data-only snapshot of every protected table (`preserved-before.sql`);
- SHA-256 evidence; and
- exact per-table before counts.

The operational tables are then locked and truncated together in one database transaction with identity sequences
reset. `CASCADE` is deliberately not used. After commit, the procedure requires zero rows across the operational
set, re-dumps the protected set and compares normalized before/after data. PostgreSQL 17 generates a random
`\restrict`/`\unrestrict` restore token on each text dump; only those non-data control lines are removed before the
protected-data comparison.

### 4. Verify

The procedure requires:

- zero operational rows remaining;
- identical normalized protected-data snapshots;
- no unvalidated foreign keys;
- ready health and database endpoints on dev.173; and
- one exact CRM Test LiteSpeed worker.

Do not infer a successful reset if any guard or verifier reports `FAIL`.

## Observed execution result

The clean dry-run observed:

- 65 protected Administration/Maintenance tables;
- 166 operational tables selected for purge;
- 93 operational tables containing rows; and
- 5,085 operational rows before reset.

The first execution evidence is:

`/home/nysareal/crm-backups/crm-test-operational-reset-20260830T135633Z`

Observed results:

- operational rows before: `5085`;
- operational rows after: `0`;
- full backup: `pre-reset-full.dump` (`1.7M` observed);
- full-backup SHA-256: `3692726b369709d33a5c1fb95476e66731ff1cbcd71747c2169789fda82dea37`;
- protected pre-reset SQL SHA-256: `12d586c77be98109a9e1e771c7454402f84b4f9700b83b93a9932fc69b7edd9b`.

The initial byte comparison reported `FAIL: Administration/Maintenance data changed` because PostgreSQL generated
different random restore tokens. Inspection showed those control tokens were the only diff. After normalizing those
lines, both protected snapshots were identical with SHA-256:

`3ad34fdd0ab03d38edfd05462b1f6c817ec916dd5ea962a737ebe50c03e0a8b6`

The corrected verification run is recorded under:

`/home/nysareal/crm-backups/crm-test-operational-reset-20260830T135756Z`

Final observations:

- operational rows remaining: `0`;
- Administration/Maintenance data: unchanged;
- health: `{"ok":true,"process":"ready","version":"2.1.0-dev.173"}`;
- readiness: `{"ok":true,"database":"ready","version":"2.1.0-dev.173"}`;
- exact worker result: `CRM_TEST_WORKER 1835710`.

No Production, R2 or Property Finder endpoint, database or application root was targeted by the procedure.

## Recovery

The pre-reset full dump is the recovery source. Restoration is intentionally not automated by this script. Test the
dump first by restoring it into a newly created isolated recovery database, validate record counts and application
compatibility, then obtain explicit authorization before replacing any live CRM Test database. Never restore this
backup into Production or R2.
