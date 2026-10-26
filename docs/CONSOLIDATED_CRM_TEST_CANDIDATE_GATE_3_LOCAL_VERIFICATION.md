# Consolidated CRM Test Candidate — Gate 3 Local Verification

Date: 2026-08-14  
Candidate: `2.1.0-dev.145`  
Target: CRM Test only

## Verification result

The consolidated candidate is locally complete and ready for controlled deployment to CRM Test. Deployment remains pending only because the cPanel session requires the owner's manual sign-in.

- Focused candidate and Email/Calendly tests: **34/34 passed**
- Full automated suite: **999/999 passed**
- Packaged runtime entries: **240**
- Packaged migrations: **94**, through migration `094`
- Deployment script syntax: passed
- Runtime JavaScript syntax checks: passed
- Deterministic package rebuild: passed
- Package SHA-256: `9e0f725611fb34f202a0f9d948c031efb8a5d118c4b9edb5150e753c9b5c378e`

## CRM Test baseline

The public CRM Test health endpoint was checked before deployment and returned healthy on version `2.1.0-dev.144`, with its database ready.

The deployment contract requires the CRM Test application root and rehearsal database only. It also requires application and database backups, checksum verification, migration verification, a single managed worker after restart, and a post-deployment health response reporting `2.1.0-dev.145`.

## Exclusions and safeguards

- Production and the Production/R2 clone were not accessed or changed.
- Property Finder and native WhatsApp integrations are excluded.
- Microsoft 365 and Calendly provider switches remain disabled pending real integration testing.
- No credentials or private owner/contact/authority information were requested, recorded, packaged, or exposed.
- The existing dirty local working tree was preserved; no reset or unrelated-change cleanup was performed.

## Deployment status

**Package ready; CRM Test deployment pending authenticated cPanel access.** The owner must sign in manually in the open browser. Credentials must not be shared in chat.
