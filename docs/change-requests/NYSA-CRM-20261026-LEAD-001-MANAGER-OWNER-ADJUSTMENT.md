# Manager-owned Hot escalation adjustment

27 October 2026. Target: local synthetic verification and updated disabled CRM Test package only. No deployment or provider activation.

Recoverable source baseline: 64d464401fea77898e6117b5b496020d922c0b40, tree 4650ae0882de52f63270e684c92dddc9728f8c3a; DEV240 verified package SHA256 ecdb80c8e2eabbad2a51298d2f893d2b2b61dcfd4c0e7e2a2de1b559ed252223. Migration ledger 154. No remote database used. Synthetic fixture is rebuilt into a new unique schema; existing schemas retained.

Approved behavior: preserve manager ownership, flag overdue Hot, alert the existing reporting manager if distinct and active. Reporting lines in CORE derive from primary team manager (migration 024); do not invent a new hierarchy, traverse self-cycles or select another arbitrary manager. With missing/inactive/self reporting manager, create one owned urgent setup/manual-review task. Ordinary agent-owned escalation continues to use the assigned team's manager. Notification is a CORE task, not a WhatsApp send. Alert recipient receives case-scoped response-board access for review only through that assigned task; unrelated cases remain denied. No automatic reassignment, new role, password or team change.

Candidate DEV241 will supersede DEV240 for CRM Test review. No new schema migration. Before any eventual Test deployment, refresh and verify paired runtime/database/configuration backups and encrypted off-server recovery. Rollback restores that entire pair. Production and installed CRM Test remain unchanged.

Verification: 62 targeted tests passed, zero failures/skips. Actual PostgreSQL exercised manager-as-initial-fallback and manager-as-assigned-owner, distinct reporting manager, self reporting, missing reporting manager, revoked manager, Admin rejection, concurrent workers/idempotency, unchanged owner/team/password marker, recipient-only read access and denial of writes/unrelated cases. All 154 migrations and original synthetic baseline row preservation remain green. Full release regression runs in the mandatory detached-origin package build; its manifest is the authoritative receipt.

The first local fixture launch omitted its dedicated port and was corrected to loopback 55481; no remote database was contacted. A synthetic inactive-manager fixture initially used an unsupported status; corrected to CORE's existing revoked status before the green run. No live credentials or customer data were used.
