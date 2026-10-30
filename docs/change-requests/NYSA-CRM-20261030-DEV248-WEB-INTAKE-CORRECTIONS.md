# DEV248 — WEB Intake corrections

Status: approved for build, test and CRM Test/staging deployment on 30 October 2026.

Governed references:

- `NYSA-CRM-20261028-NIA-001` — NIA mapping and retained raw evidence.
- `NYSA-CRM-20261029-LEAD-004` — sequential intake ownership and Lead promotion.
- `NYSA-CRM-20261029-LEAD-005` — governed Customer objective, Market stage and Property segment mapping.
- `NYSA-CRM-20261029-LEAD-006` — closed-intake history with reason, time and actor.
- `NYSA-CRM-20261029-LEAD-007` — readable, non-duplicative intake and requirement presentation.
- `NYSA-CRM-20261030-LEAD-008` — Contact Form/CORE contract, phone format and acknowledgement repair.

## Approved sequential boundary

1. A website, NIA or Meta journey enters `WEB Intake Leads` without creating a Lead.
2. Pickup atomically moves responsibility to `My Lead Queue`; it still does not create a Lead.
3. The owner confirms a genuine enquiry and the minimum governed facts.
4. Only that confirmation creates one Lead and Requirement Version 1 in the Lead pipeline.
5. Invalid, spam, duplicate, opted-out and not-genuine intakes close with immutable operational evidence and remain visible in Closed history.

Historical DEV247 test records are retained. DEV248 does not delete or merge existing Leads or Requirements.

## Integration corrections

- `contact_enquiry_v2` is a governed single-step Contact Form source.
- Contact Form market stage and property type are separate fields.
- UAE and India local mobile formats are normalized to E.164; other countries require an explicit international number.
- A successful CORE pre-Lead response is acknowledged by journey and case identifiers; no Lead identifier is expected before confirmation.
- NIA preserves all raw answers in source evidence and maps property type, timing, purpose, bedrooms, readiness, declared country, Customer objective, Market stage and Property segment.
- A syntactically valid email is retained with a separate verification status; DEV248 does not claim OTP verification.

## Explicit exclusions

- Email OTP is DEV249.
- WhatsApp OTP, SMS OTP, voice, AI outreach and every other live integration remain disabled.
- Production is unchanged.
- Existing users, password hashes, teams and assignments are unchanged.

