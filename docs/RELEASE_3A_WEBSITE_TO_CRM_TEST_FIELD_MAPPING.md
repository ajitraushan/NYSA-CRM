# Release 3A — Website to CRM Test field mapping

Status: **Design checkpoint — not deployed**  
Target: WordPress staging (`/prometheus/`) to CRM Test only  
Requirement: `R3A-WEBSITE-PROFILE-46C` and trusted website intake

## 0. Confirmed integration architecture

All sources pass through one versioned intermediate record before CRM mapping:

```text
Speak to Advisor --------\
Brochure Download --------+--> Source adapters
AI Advisory --------------+       |
AI Property Selection ----/       v
                         Intermediate Website Enquiry v1
                                      |
                             validate and retain
                                      |
                          one CRM Test field mapper
```

CRM mapping therefore depends only on `nysa-intermediate-enquiry-1`, not on
MetForm names such as `mf-name` or an individual AI tool's answer keys. Every
intermediate record retains its source type, source record key, form/version,
raw non-secret evidence, validation result and delivery history.

If a legacy form lacks a controlled value required by CRM, its intermediate
record is marked `needs_mapping`. The connector preserves it but does not invent
a business type, purpose or purchase timeline.

## 1. Forms inspected

| Website capture | Current fields/evidence | Current weakness |
|---|---|---|
| Speak to Advisor | `Name`, `Phone`, `Email Address`, `Message` | The rendered staging form does not mark these inputs as browser-required. It does not capture intent, purchase timeline, preferred channel, consent or attribution fields. |
| Brochure Download | `mf-name`, `mf-email`, `mf-telephone`, `mf-comment` | Labels show Name, Email and Message as required, but the rendered HTML does not carry the native `required` attribute. The property/brochure reference is not a submitted form field. |
| Nysa AI Advisory Diagnostic | Name/contact, recommendation, explanatory message, answer evidence, page URL, immutable `lead_key` | Rich answers are retained in WordPress but are not currently sent to NYSA CRM. |
| Nysa AI Property Selection Tool | Objective, budget, holding period, risk, property status, funding, rental-income need, residency goal, suggested routes, contact, recommendation, page URL and `lead_key` | Rich answers are retained in WordPress but are not currently sent to NYSA CRM. |

## 2. Canonical contact and identity mapping

| Website canonical field | Existing form source | CRM Test destination | Rule |
|---|---|---|---|
| `full_name` | `Name`, `mf-name`, AI `name` | `contact.fullName` → Customer name | Required. Trim only; never invent or replace it with the email address. |
| `email` | `Email Address`, `mf-email`, AI `email` or email-shaped `contact` | `contact.email` → Customer primary Email channel | At least email or phone is required. CRM runs the free credibility checks automatically. It must not claim identity verification. |
| `phone` | `Phone`, `mf-telephone`, AI `phone` or phone-shaped `contact` | `contact.phone` → Customer primary Phone channel | At least email or phone is required. Normalize in CRM; retain raw submitted evidence in the intake event. |
| `preferred_channel` | New controlled choice | `contact.preferredChannel` | Values: Phone, Email, WhatsApp or SMS. If only one usable channel is supplied, that channel may be selected automatically and shown to the user. |
| `customer_match` | Derived by CRM | Existing Customer reuse or identity-review queue | Never selected by WordPress. CRM matches normalized email/phone and sends conflicts for manager review. |
| `apollo_professional_check` | Not a website field | Separate Customer pre-KYC action | Never called during website intake. Apollo remains separately chargeable and broker-triggered. |

### Mobile-first identity and email-only gate

- A valid normalized mobile is the primary Customer matching key.
- Email is the fallback identity key only when the free check returns
  `credible_domain`.
- An email-only disposable, placeholder/test, shared/role, no-MX or temporarily
  unverifiable submission is retained as `email_review`; it creates no Customer
  and no Lead.
- The manager can approve a genuine exception or reject dummy/bot evidence with
  a mandatory reason.
- The immutable event ID still controls transmission retries. Mobile is not used
  as the event ID because one Customer may make several distinct enquiries.
- Matching email and mobile that point to different Customers remains a separate
  identity-conflict review; the system never chooses silently.

## 3. Lead, source and campaign mapping

| Website canonical field | How captured | CRM Test destination | Rule |
|---|---|---|---|
| `event_id` | Server-generated from staging site + immutable form submission/tool `lead_key` | `eventId` → Website intake event and Lead external source ID | Required, signed and idempotent. A retry reuses the exact event ID and exact first payload. |
| `source` | Server constant | `source = Website` | The browser cannot override it. |
| `form_code` | Hidden controlled code | `form` → Lead source form | Proposed codes: `speak_to_advisor_v2`, `brochure_download_v2`, `ai_advisory_v1`, `ai_property_selection_v1`. |
| `form_version` | Hidden controlled version | `sourceEvidence.formVersion` | Required for traceability when website questions change. |
| `page_url` | Browser page URL | `page` → Lead source page | Strip fragments and avoid tokens/private query values. |
| `referrer` | Browser referrer | `sourceEvidence.referrer` | Evidence only. Never use as identity evidence. |
| `campaign_external_code` | `utm_campaign` or controlled page/campaign code | `campaign` → raw Lead campaign code and governed mapping queue | Preserve the exact incoming code. Unknown codes remain visible and do not create Campaign masters automatically. |
| `utm_source`, `utm_medium`, `utm_content`, `utm_term`, click IDs | Hidden attribution fields | `sourceEvidence.attribution` retained in intake payload | Retain first-touch and current-touch evidence separately. Do not overwrite the original evidence on later visits. |
| `submitted_at` | WordPress server time | `sourceEvidence.submittedAt`; CRM records `received_at` independently | Both times are retained so queue and transmission delay are explainable. |
| `business_type` | New controlled choice; AI investment tools use Sale | `businessType` → Lead business type | Values supported by CRM: Sale, Rental, Off-plan or Commercial. Do not infer Rental from a free-text message. |
| `lead_title` | Server-generated summary | `title` → human-readable Lead title | Example: `Sale enquiry · Dubai Marina · Website`. The Customer name remains separate. |

## 4. Requirement mapping

| Website canonical field | Existing/new source | CRM Test destination | Translation rule |
|---|---|---|---|
| `purpose` | New controlled question; AI objective helps explain it | `requirement.purpose` | Values: `own_use`, `investment`, `business`, `other`. “Not sure / discuss with advisor” maps to `other`, not to investment. |
| `property_types` | New multi-select or AI unit/property type | `requirement.propertyTypes` | Controlled labels; allow “Not sure”. |
| `areas` | New multi-select, AI selected/suggested areas | `requirement.areas` | User-selected areas are authoritative. AI suggestions must be labelled as suggestions and kept separately if not selected by the customer. |
| `budget_min`, `budget_max` | New range question or parsed AI budget range | `requirement.budgetMin`, `requirement.budgetMax` | AED numbers. Preserve the original displayed range in `sourceEvidence`. |
| `funding_method` | New controlled choice or AI Funding | `requirement.fundingMethod` | Values: `cash`, `mortgage`, `mixed`, `unknown`. “Not decided” maps to `unknown`. |
| `purchase_timeline` | **New question** | `requirement.timelineCode` | Do not derive this from AI holding period. Proposed values: `0_3_months`, `3_6_months`, `6_12_months`, `12_plus_months`, `to_be_confirmed`. |
| `message` | Message/comment and AI explanatory output | `requirement.notes` | Retain the full useful message within the controlled size limit. Do not treat free text as a controlled answer unless the client confirms it. |
| `property_external_id` | New hidden value on brochure/property pages | `property.externalId` and `sourceEvidence.property` | Retained as original property interest. CRM must revalidate Inventory eligibility before it becomes any active Lead/Opportunity selection. |
| `brochure_code` | New hidden controlled value | `sourceEvidence.brochureCode` | Prevents “downloaded a brochure” from losing which brochure/property was requested. |

## 5. AI profile mapping

| AI tool evidence | CRM structured field | Additional preserved evidence |
|---|---|---|
| Objective | `profile.declaredPriorities` | Original answer and tool wording in `sourceEvidence.answers`. |
| Holding period | `profile.declaredPriorities` | It is an investment horizon, **not** a purchase timeline. |
| Risk | `profile.declaredPriorities` | Original risk label retained. |
| Property status | `profile.preferences` | Ready / near handover / off-plan wording retained. |
| Rental-income need | `profile.preferences` | Original timing/use wording retained. |
| Residency goal | `profile.mustHaves` when definite; otherwise `profile.preferences` | Original answer retained so “Yes” and “Possibly” are not treated the same. |
| Customer-selected area/property preferences | `profile.preferences` and `requirement.areas` | AI-suggested routes remain separately labelled as suggestions. |
| Explicit exclusions | `profile.exclusions` | Never infer an exclusion merely because an option was not selected. |
| Acceptable trade-offs | `profile.acceptableTradeOffs` | Only an explicit customer answer is mapped. |
| Tool identity/version/time | `profile.sourceCode`, `profile.sourceVersion`, `profile.completedAt` | WordPress `lead_key`, status and recommendation retained in `sourceEvidence`. |

## 6. Consent mapping

| Website evidence | CRM Test destination | Rule |
|---|---|---|
| Service-contact notice | Form copy plus `consent.statementVersion` | Intake evidence | Submission permits NYSA to respond to the enquiry; this is distinct from marketing consent. |
| Marketing checkbox | `consent.marketing` | Customer consent evidence | Optional, unticked by default. Absence or unticked records `denied`; it must never be silently set to granted. |
| Consent text/version/time | `consent.statementVersion` plus `sourceEvidence` | Immutable evidence | Store the exact controlled statement version and server capture time. |

## 7. Proposed customer-facing form design

The ordinary contact forms should stay short. Rich profiling is progressive.

### First screen — required to create a usable enquiry

1. Full name.
2. Email and/or phone; at least one required.
3. Preferred contact method.
4. What can NYSA help with? Sale, Rental, Off-plan or Commercial.
5. Purpose: own use, investment, business or not sure.
6. Purchase timeline, including “to be confirmed”.
7. Optional message.
8. Optional unticked marketing consent.

### Context automatically retained

- Exact form and form version.
- Page URL and property/brochure reference.
- Campaign/UTM and referral evidence.
- Submission time and immutable event ID.

### Progressive profile — optional or supplied by the AI tools

- Areas, property type and budget.
- Funding method.
- Objective, risk and holding period.
- Property-status and rental-income preferences.
- Residency objective, must-haves, exclusions and acceptable trade-offs.

The broker can complete missing requirements later in CRM without losing the
original website evidence.

## 8. Changes required before deployment

1. Install the prepared WordPress staging connector that normalizes all four
   capture sources into Intermediate Website Enquiry v1.
2. Add hidden attribution, form-version and property/brochure evidence to the
   ordinary forms.
3. Add the six short controlled questions listed in the first screen, or confirm
   a deliberately shorter variant and accept the resulting CRM “to be confirmed”
   fields.
4. Adjust the prepared AI connector so definite residency requirements map to
   `mustHaves`, while tentative residency goals remain preferences.
5. Keep raw source evidence in the intake event and expose the important mapped
   values in Customer 360 and Lead detail.
6. Configure matching `WEBSITE_INTAKE_SECRET` values and an active
   `WEBSITE_INTAKE_ACTOR_ID` in CRM Test before enabling sync.
7. Run an end-to-end staging test for each form, including retry/idempotency,
   existing-Customer reuse, conflict review, campaign mapping, email credibility
   and property-reference retention.

## 9. Explicitly not automatic

- Website contact data does not verify identity or KYC.
- Email credibility does not prove that the person owns the mailbox.
- Apollo is not called automatically and remains a separate paid action.
- AI suggestions are not treated as customer declarations.
- A website property reference is not an active Inventory selection until CRM
  validates current eligibility.
- Unknown campaign codes are retained for review; they do not create governed
  Campaign masters automatically.

## 10. Final Intermediate Intake to CORE Customer mapping

Only identity, contact, role and consent/credibility evidence creates or updates
the Customer. Enquiry, campaign, property and requirement fields remain on the
Lead or intake event.

| Intermediate Website Enquiry | CORE Customer field/evidence | Creation rule |
|---|---|---|
| `contact.fullName` | `contacts.full_name` | Required. Never replace it with email or phone. |
| `contact.phone` raw | `contacts.phone`, `contact_channels.raw_value` | Preserve the submitted value. |
| normalized valid mobile | `contact_channels.normalized_value` | Primary Customer match key, stored in international format. Not used as the event ID. |
| phone format result | `contacts.phone_status`, `contact_channels.verification_status` | `format_valid` is not ownership verification. |
| preferred WhatsApp | `contacts.preferred_channel`, phone-channel `whatsapp_enabled` | Set only when the client selected WhatsApp or the form explicitly recorded it. |
| `contact.email` raw | `contacts.email`, Email channel `raw_value` | Stored only after validation. |
| normalized email | Email channel `normalized_value` | Fallback Customer match key only for a credible email-only submission. |
| free email check | `email_credibility_status`, reason, checked time and evidence JSON | Disposable/dummy/shared/no-MX/unavailable email-only events stay outside Customer Master in `email_review`. |
| mapped client role | `contacts.contact_type`, `contact_roles` | Rental seeker → tenant; investment purchase → buyer + investor; own-use purchase/off-plan → buyer; uncertain cases → buyer or other with retained evidence. |
| website origin | `contacts.source_first_seen = Website` | Immutable first-source evidence; later enquiries do not overwrite it. |
| intake service account | `contacts.created_by` | Governed active internal intake actor, never a public website identity. |
| assignment state | `contacts.owner_id` | Initially unassigned. Set through governed broker ownership/acceptance, not from a browser-supplied owner. |
| marketing consent | `consent_evidence` linked to Customer | Stores granted/denied, statement version, capture time, source event and evidence hash. It is not a KYC field. |
| no submitted KYC evidence | KYC remains `unverified` | Website contact and email credibility never verify identity. |

### Fields that must not be written into Customer identity

| Intermediate evidence | CORE destination |
|---|---|
| Business type, purpose, budget, areas, property types, funding and timeline | Lead and active Lead Requirement version |
| Campaign, UTM, page, form and referrer | Website intake event and Lead attribution |
| Property/brochure reference | Original Lead/property-interest evidence, subject to Inventory eligibility |
| AI objective, risk, holding period, preferences and residency goal | Customer 360 through the linked Lead Requirement/profile evidence |
| Message | Lead requirement notes; not Customer name or identity notes |

### Customer creation decision order

1. Reject transport replays by immutable event ID and payload hash.
2. Apply honeypot/rate/CAPTCHA controls.
3. Normalize and validate mobile and email.
4. If mobile is valid, match Customer by normalized mobile first.
5. If there is no valid mobile, run the free email check before Customer lookup.
6. A non-credible email-only event enters `email_review`; no Customer or Lead is created.
7. If email and mobile identify different Customers, enter identity review.
8. Reuse one matching Customer or create a new Customer with unverified KYC.
9. Create the separate Lead, Requirement, consent and attribution evidence.
10. Apply the 30-day requirement fingerprint to identify a possible repeated
    Lead without dropping a distinct enquiry from the same Customer.

## 11. Seamless evidence integration into the existing CRM

Website data is not stored as a second customer database. Every submission is
first retained as an immutable Intake Event and a governed Customer Evidence
Ledger. The same accepted event then creates or reuses the Customer, creates the
Lead, creates requirement version 1, records consent and starts the existing
assignment and response clocks.

| Existing CRM surface | How accepted intake evidence is used |
|---|---|
| Customer register | Reuses the Customer by normalized mobile first; credible email is the fallback. No duplicate Customer is created for a new enquiry from the same person. |
| Customer 360 | Shows accepted declarations, source/tool/version and capture time alongside active pursuits. Identity fields already shown on the Customer are not duplicated in the evidence panel. |
| Lead detail | Shows original website declarations and attribution, and links to the same structured requirement used by the normal Lead workflow. |
| Structured requirements | Stores the enquiry-specific purpose, areas, property types, budget, funding, timeline and profile facts as version 1. Later broker confirmation creates the normal governed next version; it does not erase the original intake evidence. |
| Broker priority landing | Uses the standard Lead assignment, acceptance, first-contact, qualification, requirement and next-action clocks created by intake. No separate website task list is needed. |
| Manager leakage recovery | Shows email-only review, identity conflict, possible repeated Lead, failed processing, unassigned ageing and missed response conditions in the existing recovery register. |
| Campaign dashboard | Uses governed campaign mapping while retaining the original external campaign code, page and form. |
| Opportunity and matching | Consume the current governed Lead Requirement. Website evidence never bypasses Opportunity readiness or Inventory eligibility. |

### Evidence states

- `pending_review`: retained but not shown as trusted Customer information and
  not used to create a Customer/Lead when the identity gate is blocking.
- `active`: accepted first-party declaration or system-observed attribution;
  visible in Customer 360 and the connected Lead.
- `rejected`: archived for audit/review but excluded from Customer 360,
  requirements, actions and dashboards as current evidence.
- `superseded`: retained historical evidence after a governed later fact takes
  precedence.

`declared` means the customer submitted the value. `confirmed` and `verified`
are separate higher evidence states and must arise from a controlled CRM action;
neither website intake nor an email-domain check can assign them.

When a valid mobile is supplied with an unusable email, the enquiry can proceed
through the mobile identity, but that email remains archived on the Intake Event
and is not promoted into Customer contact channels. A Manager-approved email-only
exception is auditable. Paid Apollo evidence remains a separate manual action.
