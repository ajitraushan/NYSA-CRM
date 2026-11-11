# DEV271 D-2 evidence checklist — build in progress

Approved D-1 revision 2 covers R1–R8. R8 spec SHA-256
`9ce7e38dec1629d1f06a7312d03c0d05ee707969fd7f9d046524b415882d9898`.
Accepted DEV270 source is `5c1c350151d6ace33377b33526e2bfedf4ae8f6b`.
Candidate package and provenance, hosted sender verification and delivery evidence are pending.

## CRM Test delivery configuration

- Sender confirmed by Ajit: `PROSPECT_DIGEST_SMTP_SENDER=crm@nysarealty.com`.
- CRM Test allow-list for the synthetic digest: `PROSPECT_DIGEST_TEST_RECIPIENTS=admin@nysarealty.com`. Verify inbox delivery and SPF/DKIM in the staff Outlook mailbox. Keep the lead-reply mailbox out of this test.
- The Admin self-test resolves the signed-in Admin address and remains subject to the CRM Test allow-list. Keep `PROSPECT_DIGEST_SCHEDULE_ENABLED` off during the separately approved self-test so the worker only processes the queued Admin test. Enable recurring delivery separately.
- Obtain Ajit's written go separately for hosted configuration, credential setup and the test send. Ajit enters the password himself at the prompt below.

## Password-entry interface

Ajit enters the password in **cPanel → Advanced → Terminal** at a masked
Bash prompt. The example below is for CRM Test, after written approval of
the hosted credential-setup step. Production uses a separately provisioned
file named `production` in the same private directory.

```bash
(
  set +x
  set -e
  umask 077
  set -o noclobber
  secret_dir="$HOME/.nysa-secrets/prospect-digest-smtp"
  mkdir -p -- "$secret_dir"
  unset digest_password
  IFS= builtin read -r -s -p 'Digest mailbox password: ' digest_password
  builtin printf '\n'
  test -n "$digest_password"
  builtin printf '%s\n' "$digest_password" > "$secret_dir/crm-test"
  unset digest_password
)
```

The password is input to `read` with echo disabled. The shell stores the
setup command in history without the prompt input. The value is unexported,
and a shell builtin writes it without creating external command arguments.
The setup refuses to overwrite a file. The app opens the file outside the
app root, rejects symlinks, and requires mode 0600 and ownership by the
worker account. The password goes only to Nodemailer SMTP authentication.
Transport debug and logging are disabled. Delivery results use fixed codes,
and the settings projection contains non-secret fields only. Synthetic
transport tests cover this boundary. A hosted API, log and receipt check
with a synthetic credential remains pending.

## Local migration evidence

[PostgreSQL 13.23 results](DEV271-PG13-LOCAL-MIGRATION.json) cover 171 to 172 on
two synthetic fixtures. The Production fixture reproduces all 58 owner-held
tables from the ownership receipt. Both fixtures have 313 tables after the
migration and accepted a DEV270-shaped call insert without a next step.
The receipt records total, backfilled and past-due deadline counts, as well as append-only interest-history checks. These checks do not exercise the full DEV270 application rollback or reproduce
every Production ACL.

## Real first-call deadline counts

| Environment and phase | Basis | Past due / total prospects and past due / not contacted |
| --- | --- | --- |
| CRM Test rehearsal on approved CRM Test data | Stored deadlines immediately after migration 172 | Pending written go and receipt |
| Production read-only preflight on DEV270 | Projected deadlines using the migration 172 expression | Pending written go and receipt |

Use the approved aggregate-only query at origin commit
`cc5158692e520ff2f377d9440689d4d6513203b8`, file
`tools/dev271-first-call-backfill-evidence.sql`, SHA-256
`4d161878586106f0617c0ade70da3b88b71c0236091e7dde95c1af4e2a044031`.
Fetch it fresh into a new directory for each approved phase, verify with
`sha256sum -c`, and invoke `psql -X -f <verified-file>` by path using
the approved phase's database credential handling. Run inside CRM Test
Phase C immediately after migration 172 and inside Production read-only
preflight before backup and install. The query has no standalone hosted run.
Capture the database, role, measurement timestamp with offset, basis, total prospects,
prospects with deadlines, and count strictly earlier than the measurement
time. Report the count for all prospects and separately for the prospects
still marked not_contacted. The latter is the day-one status-based count;
Today queue eligibility also applies its normal suppression and contact rules. The Production projection
reads no individual prospect fields into the receipt. The synthetic fixture
count is separate. Both hosted reads require the exact phase approval.

## Remaining evidence

- Complete R1–R8 build and tests, including digest scheduling and Admin settings.
- Rehearse migration 172 on PostgreSQL 13.23 on both environment shapes,
  including Production owners and ACLs. Prove DEV270 can log calls after app rollback.
- Benchmark the dashboard and run governed regressions.
- Record the SMTP sender, Email Routing, MX, SPF, DKIM, DMARC, hourly limit
  and throttling. Verify approved CRM Test inbox delivery with SPF and DKIM pass.
- Build from the advertised candidate and verify provenance. Follow the
  hosted worker and separate phase approval controls in AGENTS.md and CRM_CHANGE_POLICY.md.

Production digest email stays off. Each hosted phase requires Ajit's written go.
