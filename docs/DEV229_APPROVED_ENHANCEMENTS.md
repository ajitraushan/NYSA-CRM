# DEV229 — ENH-004–008, CRM Test

Approved scope: five remaining enhancements. ENH-003 remains withdrawn. Subsequent explicit user instructions extend ENH-005 to fractional Lead/Customer requirement capture and matching calculations. No Production or R2 changes are authorized.

Baseline: deployed DEV228, GitHub commit `09218149d62ed7206fe4dc7546459345c4def281`, 136 migrations through `136_uat_inventory_mandates_and_offer_acceptance.sql`. DEV228 server recovery point: `/home/nysareal/crm-backups/consolidated-crm-test-dev228-20261025T193641Z`. Source archived before editing; a fresh validated database/application backup is mandatory immediately before deployment.

| Reference | Delivered behaviour |
| --- | --- |
| ENH-004 | Inventory cards label authoritative Current status; submitted requests show Pending verification separately from availability/exposure. |
| ENH-005 | Inventory and bulk-unit configurations include 1.5/2.5; exact values persist. Lead/Customer requirement min/max accept fractions, reopen with saved bedroom limits, and retain range validation. Reviewed AI suggestion schema/import validation and both matching calculations preserve fractions. |
| ENH-006 | Completed appointment, reaction and explicit next decision are separate. More viewings/Undecided/Not proceeding do not qualify a new Offer. Same-property pending appointments block progression; unrelated property appointments do not. Existing completed feedback retains its prior eligibility, explicitly confirmed by the user. No historical decisions are inferred or rewritten. |
| ENH-007 | Eligible Agent confirms a seven-day reservation without a file or initial Manager approval. Existing exact-revision bilateral acceptance, permissions, assignment/availability, exclusivity, extension and release controls remain. Cards identify the actual confirming Agent, reservation time and expiry in Dubai time. Historical evidence remains downloadable. |
| ENH-008 | Signed-document summary identifies Deal property and Customer, retaining immutable Deal reference as secondary detail. |

Migration 137 adds nullable viewing decision, relaxes reservation evidence NOT NULL, expands the two Inventory bedroom checks, and changes requirement bedroom limits from integer to numeric without rounding existing data. No row deletion, backfill, historical acceptance rewrite, document-access restriction, routing change or external portal mapping change.

Verification before build: release suite **1,369 passed / 87 skipped / 0 failed** (1,456 total); nine enhancement-focused tests included. Four restricted database checks passed separately, including transactional migration/storage/projection/rollback and prior document issuance/immutability checks. Real authenticated HTTP journeys passed fractional requirement save/reload/reversed-range validation, explicit viewing decision capture/new-Offer blocking, and competing evidence-free Agent reservations (201/409, one winner) followed by exact Deal lineage. Synthetic browser components verified fractional inputs and evidence-free confirmation. All ten existing approved PDF formats rendered successfully. External provider interactions and human UAT are not claimed as completed by these checks.

Regression corrections during development: restored non-ASCII source text after an editing encoding error; converted the booking-list document join to LEFT JOIN so evidence-free reservations remain visible; retained existing reaction choices while separately requiring cancellation/no-show reasons. Old evidence-gate/completion-banner assertions were updated to the approved requirements. The archival G-02 fixture fails the already-existing bilateral acceptance guard; the governed new HTTP fixture supplies both acceptance records and passes. No guard was bypassed.

Only the canonical origin-advertised commit builder may produce the ZIP. Verify provenance and checksums before deployment. Post-build checks must exercise the extracted runtime, repeat the applicable database/HTTP checks and render the ten templates. Hosting deployment must verify exact DEV228/136 baseline, fresh backup, migration 137, runtime hashes, Test worker listener, health/readiness and protected environment snapshots.

Rollback: restore the verified pre-DEV229 application archive and restart only the Test worker. Migration 137 is additive/relaxing; retain it for application recovery rather than narrowing numeric values or deleting new evidence/history. A full coordinated database restore requires pausing writes and reconciling any intervening Test work; the deployer does not automatically discard data. Production and R2 remain excluded.

Source plan and pre-build verification do not themselves prove deployment. Final commit/package hashes, post-build results, backup and hosted evidence are recorded in `uat-evidence/release-dev229-20261026/`.
