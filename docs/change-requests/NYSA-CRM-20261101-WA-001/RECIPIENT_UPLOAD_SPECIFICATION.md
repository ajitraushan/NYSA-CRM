# WA-001 — WhatsApp recipient upload specification

Date: 1 November 2026  
Status: Approved DEV259a source contract; not deployed  
Applies to: Stage B recipient import and campaign audience preparation

## Purpose and boundary

This specification governs recipient files prepared for the CORE WhatsApp
workspace. Importing a recipient does not create marketing consent, send a
message or automatically create a Customer. Source classification and consent
eligibility are separate controls.

Purchased-source prospects may be imported and retained. They are not
automatically rejected or automatically eligible for WhatsApp outreach.
Eligibility is determined from the recorded consent status and evidence.

## Upload-level fields

| Field | Required | Rule |
| --- | --- | --- |
| Team | Yes | Select one active team in the user's CORE scope. |
| Recipient source type | Yes | Select exactly one controlled value below. One file must contain one source type; split mixed-source files. |
| Original file | Yes | CSV or XLSX, maximum 5,000 data rows. |
| Supplier name | Purchased list only | Legal or trading name of the list supplier. |
| Supplier batch/reference | Purchased list only | Supplier's immutable file, order or acquisition reference. |
| Acquisition date | Purchased list only | Date NYSA obtained the list. |
| Source evidence reference | Purchased list only | Reference to the supplier agreement, provenance record or other governed acquisition evidence. This is not by itself WhatsApp consent. |

## Recipient source type dropdown

The UI must display the following labels and store the corresponding stable
codes. Free-text source values must not replace this classification.

| Display label | Stored code |
| --- | --- |
| Existing CRM | `existing_crm` |
| Website / CTWA | `website_ctwa` |
| Property portal | `property_portal` |
| Event | `event` |
| Referral | `referral` |
| Purchased list | `purchased_list` |
| Other | `other` |

Selecting `Other` requires a source description. Selecting `Purchased list`
requires all purchased-list fields in the upload-level table. A filename,
free-text tag or the generic value `bulk_upload` is not sufficient to identify
a purchased list.

## Supported file formats and workbook rule

- CSV and XLSX are both supported and use the same recipient column contract.
- The approved XLSX template contains a data sheet named `Recipients` and may
  also contain non-data sheets named `Instructions` and `Dropdown values`.
- CORE imports recipient rows only from `Recipients`. It never guesses the
  data sheet from workbook order and never combines rows from several sheets.
- An XLSX file without `Recipients`, or with more than one recipient data
  sheet, is rejected with a clear validation error before preview.
- The `Dropdown values` sheet retains the controlled source and consent values
  and drives Excel data-validation lists in the approved template.
- File extension, media type and workbook structure must be validated. Formula
  execution, macros and external workbook links are not accepted.

## Recipient columns

| Header | Required | Format / meaning |
| --- | --- | --- |
| `name` | Yes | Recipient or prospect name. |
| `phone` | Yes | E.164 number including country code, for example `+971501234567`. |
| `email` | No | Valid email address when known. |
| `tags` | No | Multiple values separated by `|`. |
| `consent_status` | Yes | One controlled consent value below. Absence is treated as `evidence_pending`, never as consent. |
| `consent_evidence_ref` | Conditional | Required when `consent_status` is `verified`. |
| `business_type` | No | Prospect requirement context. |
| `area` | No | Multiple areas separated by `|`. |
| `budget_max` | No | Numeric amount without currency symbols. |
| `source_detail` | No | Portal, event, referrer, supplier-list name or other detail within the selected upload-level source type. |

For XLSX, these headers appear on `Recipients`. For CSV, they appear on the
first row. Header names and validation rules are identical in both formats.

## Consent status dropdown

| Display label | Stored code | WhatsApp campaign effect |
| --- | --- | --- |
| Verified | `verified` | Eligible only when a valid evidence reference is recorded and no suppression applies. |
| Evidence pending | `evidence_pending` | Retained and segmentable, but not eligible to send. |
| Withdrawn | `withdrawn` | Suppressed from WhatsApp campaigns until a later independently verified opt-in is recorded. |
| Denied | `denied` | Suppressed from WhatsApp campaigns. |

Migration 164 performs the controlled value change: existing `documented`
rows, which were already constrained to carry an evidence reference, map to
`verified`; `not_documented` maps to `evidence_pending`; and `withdrawn`
remains `withdrawn`. No migration infers or manufactures consent.

## Purchased-list treatment

- `purchased_list` identifies provenance; it does not automatically grant or
  deny WhatsApp eligibility.
- Each row may record `verified` only when the evidence reference supports the
  recipient-specific consent decision accepted by NYSA's approved policy.
- Rows without sufficient evidence remain `evidence_pending`; they stay in
  CORE for review, duplicate matching and lawful prospect management but are
  excluded from a WhatsApp send audience.
- Generic supplier acquisition evidence and recipient-level WhatsApp consent
  evidence must remain distinguishable.
- A later `STOP` or other opt-out records `withdrawn` and suppression; it does
  not retrospectively validate the first message.

## Preview, validation and audit

Before commit, CORE must show source type, consent state, evidence presence,
duplicates and row errors. The committed batch must retain the selected source
type, conditional purchased-list metadata, file hash, actor, timestamp and row
decisions. Any later consent verification, withdrawal or suppression must be
audited without rewriting the original upload evidence.

