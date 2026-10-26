# DEV233 — Agent dashboard lower sections removal

Target CRM Test only. Baseline DEV232 commit 3cc582d3ac33d826bfcf493dc97458bc78745133, schema137. Prior rollback backup /home/nysareal/crm-backups/consolidated-crm-test-dev232-20261025T205015Z. Deployment must create another fresh validated app/database backup.

User requested Agent dashboard retain only top KPI cards, their drill-down and existing controls. Add one Agent-only output guard clearing lower panel HTML before insertion. Manager/Director rendering and backend scope are unchanged. No loading-order or renderer-selection change. The only functional runtime difference is one line in public/app.js. Existing filter, Reset, Call report, Save view, saved views, CSV export and KPI handlers remain bound.

Regression tests assert an empty Agent lower body, retained top-card drill-down and controls; Manager and Director still render eleven summary cards and retained detail content. Existing navigation races, task object compatibility and role-scope tests remain. Canonical GitHub build and extracted-package checks, including all ten templates, precede Test deployment and live Agent verification.

No new migration, customer data correction, permission/backend change or dependency change. Production and R2 excluded. Application rollback restores fresh pre-DEV233 archive; schema remains137.
