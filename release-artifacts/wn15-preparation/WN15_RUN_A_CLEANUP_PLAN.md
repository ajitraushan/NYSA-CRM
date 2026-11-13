# WN-15 Run A cleanup and deactivation

Review after Run A. Preserve the run UUID, full transcript, load receipt or abort details, verified recovery dump and table-of-contents hashes. Identify any partial team activation from the receipts before approving a corrective step.

1. Confirm CRM Test DEV272 identity, database and role, green readiness, one verified worker and simulator paused with fault mode none.
2. Prepare a separate pinned cleanup invocation with the exact Run A UUID and the reviewed CRM Test database registration. Run the committed whatsapp-simulation-cleanup.mjs in dry-run mode with a fresh receipt path. Review the counts, fingerprint and SHA-256. The launcher must enforce the DEV272 and database guards before importing the application DB module.
3. Approve apply separately against that UUID and dry-run receipt hash. Apply once. The tool checks the scope under lock, refuses campaign links, removes only exact run-generated records, and verifies zero remaining generated rows while retaining the cleaned run, provider events and cleanup audit record.
4. Approve team deactivation separately. Through the audited Admin API, PATCH active:0 for the exact Sales and Leasing teams recorded in the Run A packet. Verify both identities and integer state 0 in the database. If activation was partial, verify the existing states and target only the team or teams still active.
5. Capture full stdout and stderr for each step using agent-only SSH. Commit and push each receipt and send its SHA-256. Retain the private recovery dump until cleanup acceptance. Restoring it requires a separate decision.
