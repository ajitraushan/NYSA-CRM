# UAE and India caller-route test setup

Reference NYSA-CRM-20261026-LEAD-001 v1.2 — 27 October 2026

These are setup inputs, not authorization to buy numbers, fund accounts or place calls. Nonvoice development proceeds independently. Do not send passwords, API keys, payment details or full team phone lists in chat/Git.

## What the business needs to arrange

1. NYSA-owned Retell and Vapi accounts, preferably using an NYSA business email with MFA. Two platforms are needed for the agreed comparison. Use limited trial/test credit where suitable; agree a separate total gate-test budget before adding paid credit. The USD 20/day pilot voice cap does not by itself authorize account purchases or test spend.
2. One supported telephony account/route usable with the platforms, or separate routes if required. Vapi outbound calls require an imported provider number; its free number is inbound-only. Retell supports custom telephony/SIP. Do not buy a UAE/India number until the carrier confirms destination calling, lawful caller ID, onboarding requirements and actual rates. No assumption that either platform alone supplies the required local route.
3. Approved NYSA caller identity and any provider-requested business verification, supplied directly through the provider's secure flow. Confirm the route can call UAE and India, and that the account has the necessary destination permissions. Never spoof the calling number.
4. Ideally 5–10 consenting team members/numbers in UAE and 5–10 in India, across available networks and Android/iPhone devices. If fewer are available, disclose the coverage limitation. Arrange English/Hindi testers. Collect phone numbers and actual location/timezone privately during setup, not in repository documentation.
5. A convenient test window when those people will answer and report caller display, spam labels and speech quality. Approve exact participants, routes, call count and total test spending before tests run. The test script includes disclosure, interruption, refusal, wrong person, callback time and unsupported-language handling.
6. Dashboard/settings access through an approved secure session or protected secret configuration. No keys in chat. Configure recording OFF, restricted transcripts, English/Hindi, limited test concurrency/duration and billing controls. Confirm processor settings support the approved retention policy before using any real customer data.

## What development will prepare

A minimal dashboard-configured test agent per platform, identical scripted scenarios, a protected results register, signature/callback checks and route comparison. This gate does not require implementing the production voice adapter first. Measure call connectivity, actual caller ID, spam observations, Hindi/English clarity, outcome correlation and measured cost. Team answer rate is not a forecast of customer conversion. Results are currently NOT RUN.

## Other accounts needed later for nonvoice end-to-end tests

- Meta Business/Page/form access and an approved app connection; publish the new versioned AI-call/WhatsApp/email permission statement and verify the requested phone-verification option actually exists for the selected form/account.
- New 360dialog pilot number and approved English/Hindi templates for steps 0/2/5; no REM number migration.
- lead@nysarealty.com outbound sender and inbound reply mailbox/provider access, with sender-domain authentication and unsubscribe/bounce handling.
- Sunita's calendar connection, operating CRM identity and approved availability. Keep existing teams/users unchanged.
- Make only if needed after testing hosting worker reliability. No separate Claude account is required by this build reference.

## Primary technical references checked 27 October 2026

- https://docs.vapi.ai/phone-calling — free numbers are inbound-only; outbound uses imported telephony numbers.
- https://docs.retellai.com/deploy/custom-telephony — custom provider/SIP connection and number import. Destination support and rates must be confirmed with the actual carrier.

## Full sign-off limits confirmed 27 October

The approved pilot limits are voice USD 20/day, WhatsApp/email combined USD 10/day, Dubai-midnight reset, 8-minute maximum call duration and voice concurrency 2. Responsive chat may stay open up to 24 hours; 10 AI replies without booking progress triggers human handoff. Only confirmed UAE/Asia-Dubai and India/Asia-Kolkata locations can receive pilot automation. These limits do not authorize account funding or test calls; exact test budget/window/participants still require setup authorization. No other-country or DST route tests are required for this pilot.
