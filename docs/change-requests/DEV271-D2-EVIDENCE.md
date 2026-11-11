# DEV271 D-2 evidence checklist — build in progress

Approved D-1 revision 2 covers R1–R8. R8 spec SHA-256
`9ce7e38dec1629d1f06a7312d03c0d05ee707969fd7f9d046524b415882d9898`.
Accepted DEV270 source is `5c1c350151d6ace33377b33526e2bfedf4ae8f6b`.
Candidate package and provenance, hosted sender verification and delivery evidence are pending.

## CRM Test delivery configuration

- Sender confirmed by Ajit: `PROSPECT_DIGEST_SMTP_SENDER=crm@nysarealty.com`.
- CRM Test allow-list for the synthetic digest: `PROSPECT_DIGEST_TEST_RECIPIENTS=admin@nysarealty.com`. Verify inbox delivery and SPF/DKIM in the staff Outlook mailbox. Keep the lead-reply mailbox out of this test.
- The Admin self-test resolves the signed-in Admin address and remains subject to the CRM Test allow-list.
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
