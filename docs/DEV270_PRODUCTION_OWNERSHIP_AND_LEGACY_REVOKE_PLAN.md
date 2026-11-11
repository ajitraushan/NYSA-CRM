# Production ownership review and post-DEV270 privilege plan

## DEV270 ownership gate

The passing RC1 preflight receipt `112bd0b1914306bb650b5dc4befa3f9f1735dca882c90b39e6c6bdf4b1c5a107` identifies 58 public tables owned by `nysareal_nysacrm`. The isolated DEV270 migration rehearsal used app-owned tables. The read-only evidence tool binds to the exact preflight receipt, checks the same owner table set, and queries membership, effective inheritance and SELECT access in one PostgreSQL read-only transaction. It uses the Production application role and records no environment values or table data.

`MEMBER` permits SET ROLE. `USAGE` reports whether owner-role privileges are available without SET ROLE. A SELECT grant establishes read access. ALTER ownership authority comes from the owner role. Review the result alongside `rolinherit` and the actual identity used by `migrate()`. [PostgreSQL 13 privilege inquiries](https://www.postgresql.org/docs/13/functions-info.html) · [PostgreSQL 13 GRANT](https://www.postgresql.org/docs/13/sql-grant.html)

If either `MEMBER` or `USAGE` is false, keep the Production backup and install sequence on hold. Prefer a separately approved, bounded ownership transfer for the specific owner-held objects proven to require DEV270 DDL. Mixed ownership makes running the whole migration sequence as a single owner role a separate proposal that also needs verification against app-owned objects. Before proposing exact statements for approval, reconstruct RC1 on disposable PostgreSQL 13.23 with all 58 preflight table owners and the observed role membership and inheritance. Record and reproduce the relevant schema, relation, sequence, function ownership and ACLs. Run the actual migration entry point from 140 to 171, verify the full catalog and ACL deltas, and rehearse the reverse ownership changes. Confirm which objects require a transfer from the actual migration statements and test results. Preserve data, unrelated owners and grants.

Any Production ownership changes require their own approval, fresh verified rollback evidence and an exact reviewed migration plan. The four-hour validity of the previous preflight is independent of the ownership check. The hosted deployment and worker controls in `AGENTS.md` and `CRM_CHANGE_POLICY.md` continue to apply.

## Legacy role cleanup after DEV270

This plan concerns `nysareal_nysar2app` on the Production database `nysareal_nysacrm`. The preflight observed effective CONNECT and the effective table permissions below.

| Public table | Observed effective privileges |
|---|---|
| agent_area_assignments | SELECT, INSERT, UPDATE |
| deal_checklists | UPDATE |
| deal_parties | SELECT, INSERT, UPDATE |
| external_listing_publications | SELECT, INSERT, UPDATE |
| inventory_agreements | SELECT, INSERT, UPDATE |
| inventory_counterparties | SELECT, INSERT, UPDATE |
| inventory_verification_requests | SELECT, INSERT, UPDATE |
| lead_inventory_selections | SELECT, INSERT, UPDATE |
| lead_month_number_counters | SELECT, INSERT, UPDATE |
| lead_number_counters | SELECT, INSERT, UPDATE |
| listings | SELECT, INSERT, UPDATE |
| opportunity_property_share_items | SELECT, INSERT, UPDATE |
| opportunity_property_shares | SELECT, INSERT, UPDATE |
| opportunity_representation_history | SELECT, INSERT |
| provisional_external_properties | SELECT, INSERT, UPDATE |
| transaction_counterparties | SELECT, INSERT, UPDATE |

1. After DEV270 acceptance, obtain approval for an exact Production read-only ACL inventory. Capture the database ACL, the ACLs and column grants on these 16 tables, grantor, grantee and grant-option flags, relevant role memberships and effective rights for the app role. Expand ACLs with `aclexplode`. Account for default database ACLs, PUBLIC and inherited grants. Record the exact current grants and hashes for review. Capture separate read-only evidence of required CRM Test access before the change.
2. Draft one transaction bound to Production database identity, exact pre-change ACLs, target role and the named objects. Generate only confirmed direct `REVOKE CONNECT ON DATABASE nysareal_nysacrm FROM nysareal_nysar2app RESTRICT` and object-specific `REVOKE <confirmed privileges> ON TABLE public.<reviewed table> FROM nysareal_nysar2app RESTRICT` statements, executed by the recorded authorized grantor. Abort on drift, unexpected additional grants or dependent privileges. Rehearse the exact ACLs and both forward and reverse changes on PostgreSQL 13.23. [PostgreSQL 13 REVOKE](https://www.postgresql.org/docs/13/sql-revoke.html)
3. Verify direct ACL removal and effective privileges independently. If CONNECT survives through PUBLIC or membership, report that source for a separate decision. Changing PUBLIC or role membership can affect other users. Keep CRM Test access and app-role access in the acceptance checks. [PostgreSQL 13 privileges](https://www.postgresql.org/docs/13/ddl-priv.html)
4. Obtain exact Production approval for the reviewed file, hash, grantor, one run and rollback. Verify the baseline before executing. Check the exact ACL delta and confirm the Production app role and CRM Test role retain the required rights. Roll back before commit if any acceptance check fails. For later recovery, use the separately approved inverse grants preserving the original grantor, privileges and grant options.

This is a review plan. No hosted role, owner or privilege change is authorized by it.
