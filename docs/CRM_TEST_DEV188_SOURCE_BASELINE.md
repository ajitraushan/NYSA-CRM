# CRM Test dev.188 governed source baseline

Date: 2026-09-05 (Asia/Dubai)

- Source baseline package: `nysa-core-consolidated-crm-test-dev186-r2.zip`.
- Source baseline SHA-256: `c755654a60d7c1574d06a76b3e109dfccb9195b03630bcfe3d472092ef1655d4`.
- Candidate package: `nysa-core-consolidated-crm-test-dev188-r3.zip`.
- Candidate SHA-256: `c94a52e4aa00f7c51e8f9cab187aef700c11d9f413870bf33a75674f7a12c9b4`.
- Candidate manifest: `nysa-core-consolidated-crm-test-dev188-r3.manifest.json`.
- Changed runtime files are exactly: `package.json`, `package-lock.json`, `public/app.js`, `public/index.html`, `public/receivables-ui.js`, `src/commission-receivables.js`, and new `src/commission-invoice-pdf.js`.
- Database migrations are byte-for-byte inherited from the signed dev.186 package. Migration count remains 118 and the latest remains `118_dev186_187_receivable_workflow.sql`.
- The isolated build rejects any runtime delta outside the named files and rejects any historical migration delta.
- The canonical working tree contains unrelated retained work; it was not used wholesale. The candidate was assembled deterministically from the immutable dev.186 package plus only the approved dev.188 files above.
- Target: CRM Test only. Production, R2 clone, Property Finder, Performance Management and Campaign Management are excluded.
