# DEV270 legacy role table ACL change — review draft

The approved inventory evidence has SHA-256
`24d68854cc3c5a383a5dbc448aa24f6c6cb40788af6a8c99882ac4362ace4b7d`.
The draft removes 45 table ACL entries and two column ACL entries for
`nysareal_nysar2app`. The 15 app-owned tables use
`nysareal_nysacrmapp` as grantor. The `listings` table and its two column
entries use `nysareal_nysacrm` via transaction-local role switching. The
inverse transaction restores those same entries without grant option.

Both scripts require the Production database and app login, database owner,
PostgreSQL 13.23, and the owner's role membership. They acquire immediate
exclusive locks on the 16 scoped tables, and compare the full scoped
database/table/column ACLs, table ownership and row-security flags, and both
roles' effective database, public schema, table, and column rights. Each
comparison runs before and after the change. The revoke's postcondition
requires all legacy table and column privileges to be false. Any check or
statement error aborts the transaction before COMMIT. The inverse requires
the verified post-revoke state before restoring anything.

The SQL changes only the named direct grants. Database CONNECT, PUBLIC,
public schema ACLs, and role membership are outside the write scope. Run
during an approved quiet window because the locks block concurrent access to
the scoped tables while held.

## Proposed Production execution

Prepare a dedicated, committed write launcher for this change. Reuse the
reviewed selector credential handling, exact Production identity, PostgreSQL
13.23 checks, exclusive receipt creation, and credential-safe output. Pin the
launcher to the approved origin commit, and hard-code the exact revoke SQL
SHA-256 as its only executable SQL input. Require an explicit approval token
bound to that digest and operation. Verify both files with `sha256sum -c` in
a fresh private directory outside the app. Invoke `psql -X -v ON_ERROR_STOP=1
-f <verified-file>` once as the app login, retaining the read-only default
for the connection and relying on the reviewed SQL's explicit
`BEGIN READ WRITE` for this transaction. Record the output, exit code and
receipt SHA-256. On failure or an ambiguous disconnect at COMMIT, stop and
report. Confirm database state before considering a separate recovery action.

Before seeking execution approval, rehearse the forward and inverse
transactions on PostgreSQL 13.23 with the inventory's owners, columns,
memberships, and grants. Exercise ACL drift and postcondition failure to
confirm rollback. A rollback run would use a separately reviewed launcher
allowlist and explicit approval for the inverse SQL digest.
