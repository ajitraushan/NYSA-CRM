# NYSA CORE — Website contact verification

**Requirement addendum · 30 October 2026**  
**Reference:** NYSA-CRM-20261030-LEAD-009  
**Status:** Business requirement accepted; technical design recorded for review and future implementation  
**Proposed target:** Staging website and CRM Test only

## 1. Document control and safety boundary

This addendum extends `NYSA-CRM-20261029-LEAD-003-WEB-INTAKE-DETAILED-DESIGN-v1.3-developer.md`. It does not replace or silently amend that signed workflow. It must be implemented together with `NYSA-CRM-20261030-LEAD-008`, which aligns the Contact Form validation, source contract and delivery acknowledgement between the staging website and CORE.

The observed source baseline is application version `2.1.0-dev.247` at Git commit `72f88565be43e76254f022b426531864a269763a`. The motivating CRM Test observation was a staging Contact Form submission retained in the private website outbox but rejected by CORE because the supplied phone did not meet CORE's international-number rule. No customer values are reproduced in this document.

This is a documentation-only change. It changes no application runtime, database, website, provider account, customer record or integration flag. Removal or reversion of this file is the rollback for this documentation change. Production remains outside scope and unchanged.

## 2. Objective

Reduce fake, mistyped and suspicious public website enquiries by proving that the customer controls at least one declared contact channel before CORE accepts the final enquiry.

Supported verification methods are:

1. WhatsApp one-time code when available;
2. SMS one-time code as the phone fallback; and
3. email one-time code when WhatsApp or SMS is unavailable or the customer elects to verify email.

Verification proves control of the selected channel. It does not prove buying intent, identity, marketing consent or eligibility; those remain governed by the normal CORE workflow.

## 3. Confirmed business requirements

| ID | Requirement |
|---|---|
| OTP-001 | A public website enquiry is not accepted as a completed WEB intake until at least one supplied contact channel is successfully verified. |
| OTP-002 | The customer may receive the code through WhatsApp, SMS or email, subject to the channel being supplied, syntactically valid, supported and operational. |
| OTP-003 | WhatsApp is offered when available, SMS is the phone fallback, and email is available when phone channels cannot be used. The customer can choose among the eligible methods shown. |
| OTP-004 | Phone input uses a country selector and is normalized to E.164 format. If the number cannot be normalized unambiguously, the website blocks progression and shows a clear inline error. |
| OTP-005 | Email is normalized and validated before an email code can be requested. |
| OTP-006 | Verification of one channel does not verify another. CORE records WhatsApp/phone and email verification states separately. |
| OTP-007 | The website shows success only after CORE confirms both verification and final intake acceptance. A locally queued or retrying delivery is not described as accepted by CORE. |
| OTP-008 | A verification code is transactional evidence, not marketing consent. Marketing and AI-assisted-contact consent remain separate, explicit fields. |
| OTP-009 | AI and automated outreach may use only a verified channel that is also permitted by consent, restrictions, hours and provider rules. |
| OTP-010 | Unverified attempts do not create a canonical Contact, Customer, Lead, Requirement or ordinary WEB Intake Leads item. |
| OTP-011 | Unverified attempts may be retained only as encrypted provisional verification evidence for abuse control, troubleshooting and resumption, under the existing governed retention policy. |
| OTP-012 | CORE is authoritative for the verification result and final intake acceptance. The website renders the flow but does not become a competing identity or lead authority. |
| OTP-013 | Verification start, verification completion and final intake submission are rate-limited, idempotent and auditable without recording the readable code. |
| OTP-014 | Existing users, passwords, assignments, teams and production configuration remain unchanged. |

## 4. Customer journey

1. The customer enters name and at least one contact method.
2. The website validates the email and/or phone locally using the same versioned rules published by CORE.
3. For phone, the customer selects a country and the website shows the normalized international number for confirmation.
4. The website displays only eligible choices under **How would you like to receive your verification code?**
5. The customer selects WhatsApp, SMS or Email and requests a code.
6. CORE creates an expiring verification challenge and asks the configured provider to deliver the code.
7. The customer enters the code. CORE verifies the challenge and returns a short-lived, single-use verification proof bound to the normalized channel, journey/form and challenge.
8. The website submits the final intake using that proof.
9. CORE revalidates the intake contract and proof, consumes the proof once and returns the WEB intake journey/case acknowledgement.
10. Only then does the website display **Your enquiry has been received by NYSA.**

If delivery fails, the website explains that the selected channel could not be reached and offers another eligible method. It must not claim that the enquiry was accepted.

## 5. Validation and user messages

### 5.1 Phone

- Country selection is mandatory when a phone is entered.
- The normalized value must satisfy CORE's E.164 rule: `+` followed by country code and subscriber digits.
- Spaces, brackets and hyphens may be accepted for display/input convenience but are removed during normalization.
- Ambiguous or impossible numbers are rejected before sending a code.
- Recommended inline message: **Enter a valid phone number with country code, for example +971 50 123 4567.**

### 5.2 Email

- Trim and lowercase the address before matching or verification.
- Reject invalid syntax before requesting a code.
- Recommended inline message: **Enter a valid email address to receive your verification code.**

### 5.3 Code

- Use a cryptographically generated six-digit code.
- The proposed expiry is five minutes and must be configurable.
- The proposed limit is five code-entry attempts per challenge and must be configurable.
- Resend and challenge creation limits must apply by normalized channel, journey, browser/session and network risk signal.
- Messages must not reveal whether the channel already belongs to an existing CORE Contact.

## 6. Authoritative contract

The website and CORE must share one versioned verification/intake contract containing:

- canonical source and form codes;
- phone normalization and email validation rules;
- supported verification methods and provider capability results;
- challenge status and safe error codes;
- verification proof format, expiry, binding and single-use rules;
- final intake field names, enumerations and required fields;
- final acknowledgement fields for the pre-Lead sequential workflow; and
- idempotency keys for challenge creation, verification and intake submission.

The staging bridge must not require an immediate Lead ID. Under the approved sequential workflow, a verified completed intake is acknowledged as an intake journey/case; the governed Lead is created later at pickup.

## 7. Proposed CORE records

The implementation should introduce or reuse governed records equivalent to:

- `contact_verification_challenges`: opaque challenge ID, method, encrypted destination, keyed destination hash, provider reference, expiry, attempt counters, status and safe failure code;
- `contact_verification_proofs`: challenge link, verified method, normalized destination hash, issued/consumed/expired times and journey/form binding; and
- verification evidence on the resolved Contact channel after completed intake acceptance, including method, provider reference and verified time.

Readable OTP values must never be stored. Only a slow, salted verification hash or equivalent provider-managed verification result is retained. Codes, destinations, matching hashes, secrets and provider payloads must not appear in application logs, analytics, screenshots or ordinary UI.

## 8. State and retention rules

- Suggested challenge states: `pending_delivery`, `code_sent`, `verified`, `failed`, `expired`, `locked`, `consumed`.
- A verified proof is short-lived and single-use.
- A successful final intake atomically consumes the proof so retries cannot create duplicate journeys.
- Failed or expired challenges do not create normal intake work.
- Encrypted provisional evidence follows the existing unresolved-provisional-identity retention policy and is de-identified when no governed intake is completed.
- Non-personal aggregate abuse evidence may be retained according to the approved security/audit policy.

## 9. Abuse and suspicious-lead controls

OTP verification must be combined with, not substituted for:

- request throttling by destination, journey/session and network risk signal;
- maximum active challenges and resend limits;
- bot and automation detection;
- duplicate and replay detection;
- provider delivery/reconciliation checks;
- suspicious-pattern flags and a restricted administration view; and
- fail-closed behavior when verification configuration or signing secrets are unavailable.

Phone or email verification confirms reachability only. Qualification, consent, ownership, restrictions and compliance remain CORE decisions.

## 10. Acceptance criteria

- AC-OTP-01: A valid WhatsApp code permits final intake submission and records only WhatsApp/phone as verified.
- AC-OTP-02: A valid SMS code permits final intake submission when WhatsApp is unavailable or not selected.
- AC-OTP-03: A valid email code permits final intake submission when phone channels are unavailable or email is selected.
- AC-OTP-04: The final intake is rejected when no valid, unexpired, correctly bound verification proof is supplied.
- AC-OTP-05: Invalid phone or email input is blocked inline before a code request, using the same effective rules as CORE.
- AC-OTP-06: Wrong, expired, replayed and over-attempt codes fail safely without creating Contacts, Leads or ordinary WEB intake work.
- AC-OTP-07: One verified channel does not mark other channels verified.
- AC-OTP-08: Verification does not grant marketing or AI-contact consent.
- AC-OTP-09: Provider failure offers another eligible channel and never displays a false acceptance message.
- AC-OTP-10: A successful final submission creates one completed intake journey/case and no Lead before pickup.
- AC-OTP-11: Retries with the same idempotency key return the same result and do not send unnecessary extra codes or create duplicate journeys.
- AC-OTP-12: OTP values, full destinations, secrets and matching hashes are absent from logs, analytics, screenshots and ordinary UI.
- AC-OTP-13: Rate limits and lockouts work under parallel requests without allowing bypass through method switching.
- AC-OTP-14: Contract tests fail when website and CORE form codes, enumerations, validation rules or acknowledgement fields diverge.
- AC-OTP-15: Production data, schema, configuration, users, assignments and runtime remain unchanged during staging/CRM Test development and UAT.

## 11. Test matrix

Use synthetic or explicitly approved UAE and India test contacts only. Minimum tests include:

- WhatsApp success, failure, timeout and fallback to SMS/email;
- SMS success, failure, timeout and fallback to email;
- email success, failure, delayed delivery and resend;
- valid local-format phone normalized using selected country;
- ambiguous, impossible and already-international phone inputs;
- valid and invalid email syntax;
- wrong code, expired code, attempt lockout and resend limit;
- replayed proof, mismatched destination, mismatched form/journey and duplicate final submission;
- parallel code requests and parallel final submissions;
- provider ambiguous outcome and reconciliation;
- existing-contact match without disclosing account existence;
- consent denied after verification;
- AI outreach blocked on an unverified or non-consented channel;
- website/CORE contract-version mismatch and truthful error display;
- accessibility, mobile layout, keyboard flow and code autofill where supported; and
- privacy review proving that no readable OTP or private contact value enters logs or test evidence.

## 12. Dependencies and approvals required before build activation

- A verification-capable WhatsApp/SMS provider account or separate approved providers.
- A transactional email delivery route suitable for time-sensitive codes.
- Provider sandbox/test credentials stored only in the approved secret store.
- Approved transactional templates for WhatsApp/SMS/email where the provider or country requires them.
- Approved synthetic UAE and India test numbers and email addresses.
- Confirmed configurable expiry, attempt and resend limits after sandbox evidence.
- Fresh staging/CRM Test baseline, paired backups and verified encrypted private off-server copy before any deployment.
- GitHub-advertised source, mandatory origin-only package and verified provenance before CRM Test deployment.
- Separate exact approval before enabling live provider delivery or making any production change.

## 13. Delivery relationship

This requirement should be delivered in this order:

1. correct `LEAD-008` so the existing Contact Form, source mapping, validation and acknowledgement contract are aligned;
2. implement the shared CORE verification challenge/proof contract;
3. implement the staging website verification UI and provider sandbox adapters;
4. run contract, security, privacy and failure-recovery tests in staging/CRM Test;
5. complete human UAT with live integrations otherwise disabled; and
6. prepare a separate production change request only after UAT and provider/compliance evidence are accepted.

Voice remains deferred. This addendum does not activate WhatsApp, SMS, email, AI outreach or production delivery.
