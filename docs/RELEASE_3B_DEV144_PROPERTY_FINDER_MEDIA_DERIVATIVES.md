# Release 3B dev.144 — governed Property Finder media derivatives

dev.144 adds the missing in-CORE image preparation step identified during the live dev.143 outward UAT. It creates a separate PF-ready JPEG from an explicitly selected approved Inventory image while preserving the original file and record.

## Operator workflow

1. Open the approved Inventory record and its property media.
2. Choose **Create PF-ready copy** on an approved, rights-cleared original.
3. Select no watermark or the code-governed `NYSA REALTY` text watermark, its corner, opacity and scale.
4. Generate and visually review the exact browser-rendered derivative.
5. Confirm creation. CORE saves a separate derivative with `pending` approval; it is not automatically eligible for a PF preflight.
6. An authorized reviewer previews and approves the derivative through the existing media approval control.
7. Return to External Portal Listings and rerun media verification.

## Safety and audit boundary

- Output is a ratio-preserving sRGB JPEG bounded to 1920×1080, using governed JPEG quality of 82–94%.
- Low-resolution sources are never enlarged.
- The original storage object and media row are never overwritten.
- Migration 082 links each derivative to its source with `ON DELETE RESTRICT` and stores the exact versioned transform.
- Audit evidence retains source and derivative SHA-256 values, dimensions, watermark settings, operator, approval state and the fact that no external read, write or publication occurred.
- A derivative is always created as `pending`, even where ordinary uploads can be automatically approved.
- This increment contains no Property Finder listing create, update, delete, publish or unpublish operation and spends no credits.

## Remaining controlled UAT

Create and approve PF-ready derivatives for the explicitly tagged `NYSA-INV-000018` test Inventory, then run the dev.143 outward workflow: profile selection, exact PF location selection, media delivery verification, compliance reconciliation and deterministic no-send payload preview. External reads remain disabled except during that separately confirmed CRM-Test sandbox window.
