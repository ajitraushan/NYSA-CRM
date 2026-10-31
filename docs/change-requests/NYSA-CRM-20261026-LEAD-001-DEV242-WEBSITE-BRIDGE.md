# NYSA-CRM-20261026-LEAD-001 — DEV242 website bridge

## Authorized scope

- Target: CRM Test and `staging.nysarealty.com` only.
- Baseline: CRM Test `2.1.0-dev.241`, migration 154; staging WordPress source snapshot SHA-256 `a660c06056a2b6bb685791d649c4117883bc0ead98b0dd4fc5f8911cf4b1029a`.
- Production, production data, users, passwords, team assignments and configuration remain unchanged.
- Live Meta, WhatsApp, email and voice transmission remains paused. The staging REM write guard remains active.

## One governed intake path

Both staging entry routes use one authenticated CORE endpoint:

1. The normal Contact Us form first stores its existing WordPress enquiry, then emits `nysa_contact_lead_saved`.
2. NIA first stores its existing local row, then emits the accepted REST request through the bridge.
3. The bridge writes a durable, idempotent WordPress outbox row and signs the exact JSON body with HMAC-SHA256.
4. CRM Test verifies the timestamp/signature and records the immutable website intake event.
5. CORE creates or safely reviews the Customer/Lead, then opens the shared Lead Response case. No WordPress or REM record becomes authoritative for CRM ownership or qualification.

The bridge stores its secret only in server configuration. Accepted outbox payloads are replaced with `{}` after CORE returns the Lead and case references.

## Contact and consent boundaries

- Contact Us requires country, purpose and timeline so CORE does not invent them.
- UAE and India can become automation-eligible only when location is explicitly confirmed and the visitor separately checks the AI-assisted WhatsApp/email consent box.
- NIA is accepted as a partial enquiry. It creates a review case without guessing country, timeline, purpose or contact permission.
- A customer reply still stops scheduled outreach and enters the approved AI-booking/human-handoff workflow. Live transmission remains disabled in CRM Test.

## Where the record lands in CORE

- `Lead Response`: the operational case, labelled **Website / NIA**. Complete, consented UAE/India Contact Us leads can be `Awaiting response`; partial NIA and non-consented enquiries are `Needs review`.
- `Leads` and `Customers`: the canonical CRM records created by the existing governed website-intake rules.
- `Administration > Website intake`: immutable intake status and exception/replay evidence for authorized support users.
- WordPress retains only its local source record and delivery receipt. It does not assign the lead or classify it authoritatively.

## Migration and preservation

Migration 155 allows `website` in the existing source inbox and links one inbox row to one `website_intake_events` row. It is additive: existing rows, owners, passwords, teams, assignments, integration setup and provider state are unchanged.

## Verification

- Governed release suite: 1,549 tests; 1,458 passed; 91 skipped; 0 failed.
- Disposable PostgreSQL rehearsal: all 155 migrations and 20 non-voice workflow checks passed using synthetic data.
- The contact theme patch is hash-gated to the exact staging baseline and creates a same-directory rollback copy before writing.
- The WordPress plugin must pass server-side PHP lint before activation.
- The release must be built only from the GitHub-advertised commit and verified with `npm run release:verify-package` before deployment.

## CRM Test acceptance

1. Submit one clearly marked test enquiry through staging Contact Us. Do not use a real customer's details without their consent.
2. Submit or complete one NIA test enquiry.
3. In CRM Test, open **Lead Response** and confirm the two rows show source **Website / NIA**.
4. Confirm the Contact Us row retains the declared country, purpose, timeline and consent state.
5. Confirm the NIA row is **Needs review** and contains no guessed location or consent.
6. Confirm no WhatsApp, email, Meta, REM or voice message was sent.

## Rollback

- Stop CRM Test, restore the paired pre-DEV242 database dump and application archive, and return it to the prior DEV241 state.
- Restore the staging WordPress database/files backup and the hash-gated `functions.php.dev241-pre-core-bridge` copy; deactivate/remove the bridge plugin if required.
- Restore the previous private server configuration values. Production remains untouched.
