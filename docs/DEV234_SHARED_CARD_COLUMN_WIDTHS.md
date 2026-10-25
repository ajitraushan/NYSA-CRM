# DEV234 — shared card and drill-down column sizing

CRM Test only. Baseline DEV233 commit a078133f6376c27f564c73fcdbec882e54b2a7cc, migration137. Current index.html preserved before editing. Prior recoverable server backup /home/nysareal/crm-backups/consolidated-crm-test-dev233-20261025T210030Z. Fresh validated app/database backup before deployment.

User approved column-width correction across cards and drill-downs, retaining functionality. Runtime change is CSS only in public/index.html. No JavaScript, backend, authorization, data, column content, dashboard scope or business-rule changes. Metadata/tests advance to DEV234; supporting release scripts and synthetic layout fixture are included.

Root causes: shared activity-row assumes an icon/content/action grid; single-content hierarchy, qualification and proposal rows were confined to its34px icon column. Two-child content/action rows had the same problem. Grid/flex min-content constraints and uncontained wide tables caused narrow dialogs to overflow or squeeze columns.

Correction: single-child rows span the full grid; non-marker two-child rows use flexible content plus action; icon rows retain their marker/content/action structure. Shared card/form/grid children can shrink. Inventory specification labels wrap. Modals/dashboard panels contain horizontal table overflow; four-plus-column tables have a readable40rem minimum, six-plus56rem. Simple two-column tables keep their existing compact layout. Existing modal max-widths, labels, controls and actions are preserved.

Audit covered26 shared layout rules and all14 exact activity-row occurrences across app.js and offer-ui.js, including history markers, hierarchy, maturity, qualification, requirements, proposal and developer/external-stock review rows. Synthetic browser fixtures cover hierarchy, three-part timeline, two-part row, Inventory specs, summary cards, forms and2/4/6/12-column tables at320/480/768/1280px. Geometry checks verify full-width content, fixed marker, containment and readable scrollable tables; far-right record action is exercised. Full release regression and extracted-package dashboard/scope/prior-enhancement tests plus all10PDF renders. Hosted hierarchy and drill-down verification follows deployment.

No migration/dependency change or operational data mutation. Production and R2 excluded. Rollback restores the fresh pre-DEV234 application archive; no schema reversal/database restore is needed.
