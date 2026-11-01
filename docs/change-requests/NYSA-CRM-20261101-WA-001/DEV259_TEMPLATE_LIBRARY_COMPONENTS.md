# DEV259 — Template Library components

Date: 1 November 2026  
Target: CRM Test only  
Scope: WA-001 Stage B, number-independent Template Library increment

## Delivered source scope

- Header type: none, text, image, video or document.
- Header media is selected from the in-scope Materials catalogue. Accepted
  header files are JPG/PNG up to 5 MB, MP4 up to 16 MB and PDF under the
  configured private-document limit.
- Quick-reply and URL buttons use provider limits: ten buttons in total, no
  more than two URL buttons, 25-character labels, grouped button types and
  HTTPS URLs. A dynamic URL may contain one `{{1}}` only at its end and must
  have an approval sample. The form recommends a NYSA redirect such as
  `https://nysarealty.com/go/{{1}}`; no redirect endpoint or click tracking is
  activated in this increment.
- Every named header/body variable requires an approval sample.
- Template names accept lowercase letters, numbers and underscores only.
- Character limits and counters are header 60, body 1,024 and footer 60.
- The live WhatsApp-style preview renders sample-substituted content, selected
  header media, footer, buttons and the resolved dynamic URL example.

## Boundaries and controls

- Meta status remains `Not submitted`.
- There is no provider-template submission route and no message-send route or
  control.
- Private material downloads retain authenticated team scope, no-store headers
  and content-type validation.
- Migration 163 is additive and retains prior versions; it stores the header
  choice, material reference, variable examples and button definition in the
  immutable versioned template record.
- Existing production, website, REM, live number and CRM workflows are not
  changed.

## Local verification

- Focused template/media checks: 13 passed, zero failed.
- Governed release regression: 1,536 passed, 96 intentionally skipped, zero
  failed.
- Synthetic browser interaction and responsive checks: passed at 1280, 768 and
  390 pixels, including samples, counters, dynamic URL preview and controls.

Before deployment, execute migration 163 in an isolated restricted-role
fixture, run the authenticated Agent/Manager/Director lifecycle, build from the
advertised GitHub commit using the mandatory origin builder, verify provenance,
refresh the paired rollback backup and obtain approval for the exact package.
